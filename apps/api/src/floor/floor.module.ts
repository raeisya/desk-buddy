import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking, Desk, Presence } from '../entities';
import { FloorController } from './floor.controller';
import { FloorService } from './floor.service';

@Module({
  imports: [TypeOrmModule.forFeature([Desk, Presence, Booking])],
  controllers: [FloorController],
  providers: [FloorService],
  exports: [FloorService],
})
export class FloorModule {}
