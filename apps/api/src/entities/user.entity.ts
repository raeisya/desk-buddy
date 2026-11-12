import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { AvatarConfig, Role } from '../common/contracts';

@Entity('users')
export class User {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'slack_id', type: 'varchar', unique: true, nullable: true })
  slackId!: string | null;

  @Column({ type: 'varchar' })
  email!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  team!: string;

  @Column({ type: 'varchar', default: 'staff' })
  role!: Role;

  /** Admin can deactivate someone (left, never onboarded): hidden from login and counts, desk freed. */
  @Column({ type: 'boolean', default: true })
  active!: boolean;

  /** Character customization: the look this person chose. null = default preset for their id. */
  @Column({ type: 'jsonb', nullable: true })
  avatar!: AvatarConfig | null;

  /**
   * Slack user token (users.profile:write) from "Connect Slack" on the Me page, so a status changed in
   * DeskBuddy is mirrored to Slack. Never selected by default and never sent to the browser.
   */
  @Column({ name: 'slack_user_token', type: 'varchar', nullable: true, select: false })
  slackUserToken!: string | null;
}
