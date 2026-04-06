import { DataSource } from 'typeorm';
import './config/postgres-date-parsers';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const parseNumberEnv = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const poolMax = parseNumberEnv(process.env.DB_POOL_MAX, 20);
const poolIdleMs = parseNumberEnv(process.env.DB_POOL_IDLE_MS, 30000);
const poolConnTimeoutMs = parseNumberEnv(process.env.DB_POOL_CONN_TIMEOUT_MS, 10000);

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseNumberEnv(process.env.DB_PORT, 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  entities: [path.join(__dirname, '**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, 'database/migrations/*{.ts,.js}')],
  migrationsRun: false,
  extra: {
    max: poolMax,
    idleTimeoutMillis: poolIdleMs,
    connectionTimeoutMillis: poolConnTimeoutMs,
    keepAlive: true,
  },
});

export default AppDataSource;
