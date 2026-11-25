import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import {
  User,
  UserConfig,
  Application,
  UserApplicationAccess,
} from '../modules/identity/entities';
import { AuthSession, Verification } from '../modules/auth/entities';
import { Accounts } from '../modules/identity/entities';

config();

const ENTITIES = [
  User,
  Accounts,
  UserConfig,
  Application,
  UserApplicationAccess,
  AuthSession,
  Verification,
];

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  schema: 'public',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: ENTITIES,
  migrations: ['src/database/migrations/*.{ts,js}'],
  migrationsTableName: 'migrations',
  synchronize: false,
  migrationsRun: false,
  migrationsTransactionMode: 'each',
});
