import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Desk, Presence, User } from '../entities';
import { PresenceModule } from '../presence/presence.module';
import { SlackUsersService } from './slack-users.service';
import { SlackController } from './slack.controller';
import { SlackService } from './slack.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Desk, Presence]), PresenceModule],
  controllers: [SlackController],
  providers: [SlackService, SlackUsersService],
})
export class SlackModule {}
