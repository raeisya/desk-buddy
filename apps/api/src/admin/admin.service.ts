import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { ClockService } from '../common/clock.service';
import { ROLES, type AdminUser, type AdminUserPatch, type Role } from '../common/contracts';
import { Desk, User } from '../entities';
import { EventsService } from '../events/events.service';

/**
 * Admin page and permanent seats (C).
 *
 * - Admin: list everyone, change team/role, deactivate (desk is freed; hidden from login and counts).
 * - HOD (or admin): give a teammate a permanent desk, or take it back. Only desks with no owner.
 * - Staff: move their own permanent desk to a desk with no owner, instantly.
 *
 * Seat changes are conditional updates ("only if it still has no owner") inside a transaction, so two
 * people clicking the same desk can't both win. Identity is the persona id from the client for now,
 * like bookings: the roles are enforced here, but who you are is not verified until real sessions.
 */
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Desk) private readonly desks: Repository<Desk>,
    private readonly db: DataSource,
    private readonly events: EventsService,
    private readonly clock: ClockService,
  ) {}

  async listUsers(actorId: string | undefined): Promise<AdminUser[]> {
    await this.actor(actorId, ['admin']);
    const [users, owned] = await Promise.all([
      this.users.find({ order: { team: 'ASC', name: 'ASC' } }),
      this.desks.find({ where: { ownerId: Not(IsNull()) }, select: { id: true, ownerId: true } }),
    ]);
    const deskByOwner = new Map(owned.map((d) => [d.ownerId!, d.id]));
    return users.map((u) => toAdminUser(u, deskByOwner.get(u.id) ?? null));
  }

  async updateUser(actorId: string | undefined, userId: string, patch: AdminUserPatch): Promise<AdminUser> {
    const actor = await this.actor(actorId, ['admin']);
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException(`No user ${userId}`);

    if (patch.role !== undefined && !ROLES.includes(patch.role)) throw new BadRequestException(`Unknown role ${patch.role}`);
    if (patch.team !== undefined && !patch.team.trim()) throw new BadRequestException('Team cannot be empty');
    if (user.id === actor.id && (patch.active === false || (patch.role !== undefined && patch.role !== 'admin'))) {
      throw new BadRequestException("You can't deactivate or demote yourself: ask another admin.");
    }

    if (patch.team !== undefined) user.team = patch.team.trim();
    if (patch.role !== undefined) user.role = patch.role;
    if (patch.active !== undefined) user.active = patch.active;

    await this.db.transaction(async (tx) => {
      await tx.save(user);
      // Deactivated: their permanent desk goes back to the pool straight away.
      if (patch.active === false) await tx.update(Desk, { ownerId: user.id }, { ownerId: null });
    });
    this.changed();
    const desk = await this.desks.findOneBy({ ownerId: user.id });
    return toAdminUser(user, desk?.id ?? null);
  }

  /** HOD/admin: give `userId` this desk as their permanent seat (moving them off any old one), or clear it. */
  async setOwner(actorId: string | undefined, deskId: string, userId: string | null): Promise<{ deskId: string; ownerId: string | null }> {
    const actor = await this.actor(actorId, ['hod', 'admin']);
    const desk = await this.desks.findOne({ where: { id: deskId }, relations: { owner: true } });
    if (!desk) throw new NotFoundException(`No desk ${deskId}`);

    if (userId === null) {
      if (!desk.owner) return { deskId, ownerId: null };
      if (actor.role === 'hod' && desk.owner.team !== actor.team) throw new ForbiddenException(`${deskId} belongs to another team.`);
      await this.desks.update({ id: deskId }, { ownerId: null });
      this.changed();
      return { deskId, ownerId: null };
    }

    const target = await this.users.findOneBy({ id: userId, active: true });
    if (!target) throw new NotFoundException(`No active user ${userId}`);
    if (actor.role === 'hod' && target.team !== actor.team) throw new ForbiddenException(`${target.name} isn't in your team.`);

    await this.db.transaction(async (tx) => {
      await tx.update(Desk, { ownerId: target.id }, { ownerId: null });
      const res = await tx.update(Desk, { id: deskId, ownerId: IsNull() }, { ownerId: target.id });
      if (!res.affected) throw new ConflictException(`${deskId} already has an owner. Pick another desk.`);
    });
    this.changed();
    return { deskId, ownerId: target.id };
  }

  /** Staff: move your own permanent desk to `deskId` (must have no owner). Your old desk is freed. */
  async moveMine(userId: string | undefined, deskId: string): Promise<{ from: string; to: string }> {
    const user = await this.actor(userId, ['staff', 'hod', 'admin']);
    const current = await this.desks.findOneBy({ ownerId: user.id });
    if (!current) throw new ForbiddenException("You don't have a permanent desk yet. Your HOD assigns one.");
    if (current.id === deskId) throw new BadRequestException(`${deskId} is already your desk.`);
    if (!(await this.desks.existsBy({ id: deskId }))) throw new NotFoundException(`No desk ${deskId}`);

    await this.db.transaction(async (tx) => {
      const res = await tx.update(Desk, { id: deskId, ownerId: IsNull() }, { ownerId: user.id });
      if (!res.affected) throw new ConflictException(`${deskId} already has an owner. Pick another desk.`);
      await tx.update(Desk, { id: current.id }, { ownerId: null });
    });
    this.changed();
    return { from: current.id, to: deskId };
  }

  private async actor(id: string | undefined, roles: Role[]): Promise<User> {
    if (!id) throw new BadRequestException('actorId is required');
    const user = await this.users.findOneBy({ id });
    if (!user || !user.active) throw new ForbiddenException('Unknown or inactive user');
    if (!roles.includes(user.role)) throw new ForbiddenException('Your role cannot do this.');
    return user;
  }

  private changed(): void {
    this.events.emit({ type: 'floor-changed', date: this.clock.today() });
  }
}

function toAdminUser(u: User, deskId: string | null): AdminUser {
  return { id: u.id, name: u.name, team: u.team, role: u.role, active: u.active, deskId };
}
