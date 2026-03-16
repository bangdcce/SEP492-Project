import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { resolveDatabaseRuntimeConfig } from './config/database-runtime.config';

dotenv.config();

const runtime = resolveDatabaseRuntimeConfig(process.env);

const AppDataSource = new DataSource({
  type: 'postgres',
  host: runtime.host,
  port: runtime.port,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  entities: [path.join(__dirname, '**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, 'database/migrations/*{.ts,.js}')],
  migrationsRun: false,
  extra: {
    max: runtime.poolMax,
    idleTimeoutMillis: runtime.poolIdleMs,
    connectionTimeoutMillis: runtime.poolConnTimeoutMs,
    maxUses: runtime.poolMaxUses,
    allowExitOnIdle: runtime.poolAllowExitOnIdle,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    query_timeout: runtime.queryTimeoutMs,
    statement_timeout: runtime.statementTimeoutMs,
  },
});

export default AppDataSource;
