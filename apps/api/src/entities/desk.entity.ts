import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { DeskFacing } from '../common/contracts';
import { User } from './user.entity';

// Desk ownership lives ONLY here (desks.owner_id). There is no users.home_desk_id,
// so the two can never disagree.
@Entity('desks')
export class Desk {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'int' }) x!: number;
  @Column({ type: 'int' }) y!: number;
  @Column({ type: 'int' }) w!: number;
  @Column({ type: 'int' }) h!: number;

  @Column({ type: 'varchar' })
  zone!: string;

  @Column({ type: 'varchar', default: 'down' })
  facing!: DeskFacing;

  @Column({ name: 'owner_id', type: 'varchar', nullable: true })
  ownerId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_id' })
  owner!: User | null;
}
