import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { resolveDatabaseRuntimeConfig } from '../config/database-runtime.config';

dotenv.config({ path: '.env' });

const runtime = resolveDatabaseRuntimeConfig(process.env);

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: runtime.host || 'localhost',
  port: runtime.port,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'postgres',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: true,
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
