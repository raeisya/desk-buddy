import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Desk, User } from '../entities';
import { AdminController, DesksController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Desk])],
  controllers: [AdminController, DesksController],
  providers: [AdminService],
})
export class AdminModule {}
