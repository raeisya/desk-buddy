import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { Role } from '../common/contracts';

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
}
