import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Desk, Presence, User } from '../entities';
import { SeedService } from './seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Desk, Presence])],
  providers: [SeedService],
})
export class SeedModule {}
