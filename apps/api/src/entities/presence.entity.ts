import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn,
} from 'typeorm';
import type { PresenceSource, PresenceStatus } from '../common/contracts';
import { User } from './user.entity';

// One row per user per day. A multi-day message ("outstation until Thu") becomes one row per day.
@Entity('presence')
@Unique(['userId', 'date'])
export class Presence {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id', type: 'varchar' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar' })
  status!: PresenceStatus;

  @Column({ type: 'varchar', default: 'manual' })
  source!: PresenceSource;

  @Column({ name: 'raw_message', type: 'text', nullable: true })
  rawMessage!: string | null;

  @Column({ type: 'real', nullable: true })
  confidence!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
