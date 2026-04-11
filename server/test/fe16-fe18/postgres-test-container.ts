import { execFile } from 'child_process';
import { promisify } from 'util';
import { Client } from 'pg';
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from 'testcontainers';

const execFileAsync = promisify(execFile);

export interface PostgresTestContainerHandle {
  container: StartedTestContainer | null;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  connectionString: string;
  transport: 'testcontainers' | 'docker-cli';
  stop: () => Promise<void>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForPostgres = async (connectionString: string): Promise<void> => {
  const deadline = Date.now() + 120_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    const client = new Client({ connectionString });
    try {
      await client.connect();
      await client.end();
      return;
    } catch (error) {
      lastError = error;
      try {
        await client.end();
      } catch {
        // ignore
      }
      await sleep(1_000);
    }
  }

  throw lastError ?? new Error('Timed out waiting for Postgres to become ready');
};

const parseDockerPort = (output: string): number => {
  const firstLine = output.trim().split(/\r?\n/)[0] ?? '';
  const match = firstLine.match(/:(\d+)\s*$/);
  if (!match) {
    throw new Error(`Unable to parse docker port output: ${output}`);
  }

  return Number(match[1]);
};

const startViaDockerCli = async (
  username: string,
  password: string,
  database: string,
): Promise<PostgresTestContainerHandle> => {
  const { stdout } = await execFileAsync('docker', [
    'run',
    '-d',
    '-P',
    '-e',
    `POSTGRES_USER=${username}`,
    '-e',
    `POSTGRES_PASSWORD=${password}`,
    '-e',
    `POSTGRES_DB=${database}`,
    'postgres:16-alpine',
  ]);

  const containerId = stdout.trim();

  try {
    const { stdout: portOutput } = await execFileAsync('docker', [
      'port',
      containerId,
      '5432/tcp',
    ]);
    const port = parseDockerPort(portOutput);
    const host = '127.0.0.1';
    const connectionString = `postgresql://${username}:${password}@${host}:${port}/${database}`;

    await waitForPostgres(connectionString);

    return {
      container: null,
      host,
      port,
      username,
      password,
      database,
      connectionString,
      transport: 'docker-cli',
      stop: async () => {
        await execFileAsync('docker', ['rm', '-f', containerId]);
      },
    };
  } catch (error) {
    await execFileAsync('docker', ['rm', '-f', containerId]).catch(() => undefined);
    throw error;
  }
};

export const startPostgresTestContainer =
  async (): Promise<PostgresTestContainerHandle> => {
    const username = 'test_user';
    const password = 'test_password';
    const database = 'test_db';

    try {
      const container = await new GenericContainer('postgres:16-alpine')
        .withEnvironment({
          POSTGRES_USER: username,
          POSTGRES_PASSWORD: password,
          POSTGRES_DB: database,
        })
        .withExposedPorts(5432)
        .withWaitStrategy(
          Wait.forLogMessage(/database system is ready to accept connections/i, 2),
        )
        .withStartupTimeout(120_000)
        .start();

      const host = container.getHost();
      const port = container.getMappedPort(5432);

      return {
        container,
        host,
        port,
        username,
        password,
        database,
        connectionString: `postgresql://${username}:${password}@${host}:${port}/${database}`,
        transport: 'testcontainers',
        stop: async () => {
          await container.stop();
        },
      };
    } catch (error) {
      return startViaDockerCli(username, password, database);
    }
  };
