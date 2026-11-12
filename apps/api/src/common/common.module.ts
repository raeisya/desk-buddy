import { Global, Module } from '@nestjs/common';
import { ClockController } from './clock.controller';
import { ClockService } from './clock.service';

@Global()
@Module({
  controllers: [ClockController],
  providers: [ClockService],
  exports: [ClockService],
})
export class CommonModule {}
