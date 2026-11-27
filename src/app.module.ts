import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { IdentityModule } from './modules/identity/identity.module';
import { DatabaseModule } from './database/database.module';
import { ConfigService } from '@nestjs/config';
import {
  User,
  UserConfig,
  Application,
  UserApplicationAccess,
} from './modules/identity/entities';
import { AuthSession, Verification } from './modules/auth/entities';
import { Accounts } from './modules/identity/entities';
import { HealthModule } from './modules/health';
import { AppsModule } from './modules/apps';
import { ChallengesModule } from './modules/challenges';
import { MessagingModule } from './modules/messaging';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.getOrThrow<string>('DB_PASS'),
        database: config.getOrThrow<string>('DB_NAME'),
        schema: 'public',
        ssl:
          config.get<string>('DB_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,
        synchronize: false,
        migrationsRun: false,
        migrationsTableName: 'migrations',
        migrationsTransactionMode: 'each' as const,
        entities: [
          User,
          Accounts,
          UserConfig,
          Application,
          UserApplicationAccess,
          AuthSession,
          Verification,
        ],
        migrations: ['dist/database/migrations/*.js'],
      }),
    }),
    DatabaseModule,
    AuthModule,
    AppsModule,
    IdentityModule,
    HealthModule,
    ChallengesModule,
    MessagingModule,
  ],
})
export class AppModule {}
