import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { EventsModule } from './events/events.module';
import { FloorModule } from './floor/floor.module';
import { HealthController } from './health.controller';
import { PresenceModule } from './presence/presence.module';
import { SeedModule } from './seed/seed.module';
import { SlackModule } from './slack/slack.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // .env lives at the repo root; in the cloud, env vars come from the host.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        ssl: config.get('DATABASE_SSL') === 'true' ? { rejectUnauthorized: false } : false,
        autoLoadEntities: true,
        synchronize: true, // hackathon only
      }),
    }),
    // Serves the built React app (apps/web/dist) from the same origin as the API.
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'web', 'dist'),
      exclude: ['/api/{*path}'],
    }),
    EventsModule,
    CommonModule,
    UsersModule,
    PresenceModule,
    FloorModule,
    SeedModule,
    SlackModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
