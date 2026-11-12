import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking, User } from '../entities';
import { FloorModule } from '../floor/floor.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, User]), FloorModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
