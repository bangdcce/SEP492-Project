import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'interdev_db',
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  entities: [path.join(__dirname, '../modules/**/entities/*.entity.ts')],
  migrations: [path.join(__dirname, './migrations/*.ts')],
  migrationsRun: false,
});
