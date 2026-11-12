import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Desk } from './desk.entity';
import { User } from './user.entity';

// A booking is "active" while released_at IS NULL.
// The DB enforces at most one active booking per desk per day and per user per day,
// so concurrent claims can't double-book (the loser gets a unique violation → 409).
@Entity('bookings')
@Index('uq_bookings_active_desk', ['deskId', 'date'], { unique: true, where: '"released_at" IS NULL' })
@Index('uq_bookings_active_user', ['userId', 'date'], { unique: true, where: '"released_at" IS NULL' })
export class Booking {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'desk_id', type: 'varchar' })
  deskId!: string;

  @ManyToOne(() => Desk, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'desk_id' })
  desk!: Desk;

  @Column({ name: 'user_id', type: 'varchar' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'date' })
  date!: string;

  @Column({ name: 'checked_in_at', type: 'timestamptz', nullable: true })
  checkedInAt!: Date | null;

  @Column({ name: 'released_at', type: 'timestamptz', nullable: true })
  releasedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
