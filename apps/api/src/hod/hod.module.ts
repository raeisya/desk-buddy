import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Desk, Presence, User } from '../entities';
import { HodController } from './hod.controller';
import { HodService } from './hod.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Desk, Presence])],
  controllers: [HodController],
  providers: [HodService],
})
export class HodModule {}
