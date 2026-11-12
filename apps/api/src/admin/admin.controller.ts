import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import type { AdminUser, AdminUserPatch } from '../common/contracts';
import { AdminService } from './admin.service';

/** Admin page (C). `actorId` = the signed-in persona, like bookings' `userId`. */
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** GET /api/admin/users?actorId=u-melissa — everyone, including deactivated, with their desk. */
  @Get('users')
  list(@Query('actorId') actorId?: string): Promise<AdminUser[]> {
    return this.admin.listUsers(actorId);
  }

  /** PATCH /api/admin/users/:id { actorId, team?, role?, active? } */
  @Patch('users/:id')
  update(@Param('id') id: string, @Body() body: AdminUserPatch & { actorId?: string }): Promise<AdminUser> {
    const { actorId, team, role, active } = body ?? {};
    return this.admin.updateUser(actorId, id, { team, role, active });
  }
}

/** Permanent seats (C). */
@Controller('desks')
export class DesksController {
  constructor(private readonly admin: AdminService) {}

  /** PUT /api/desks/:id/owner { actorId, userId|null } — HOD/admin assigns or clears a permanent desk. */
  @Put(':id/owner')
  setOwner(@Param('id') id: string, @Body() body: { actorId?: string; userId?: string | null }) {
    return this.admin.setOwner(body?.actorId, id, body?.userId ?? null);
  }

  /** POST /api/desks/:id/move { userId } — move your own permanent desk here (desk must have no owner). */
  @Post(':id/move')
  @HttpCode(200)
  move(@Param('id') id: string, @Body() body: { userId?: string }) {
    return this.admin.moveMine(body?.userId, id);
  }
}
