import { types } from 'pg';

const PG_TIMESTAMP_OID = 1114;

let configured = false;

export function parsePostgresTimestampWithoutTimeZone(value: string): Date {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const withUtcSuffix = normalized.endsWith('Z') ? normalized : `${normalized}Z`;
  return new Date(withUtcSuffix);
}

export function configurePostgresDateParsers(): void {
  if (configured) {
    return;
  }

  types.setTypeParser(PG_TIMESTAMP_OID, parsePostgresTimestampWithoutTimeZone);
  configured = true;
}

configurePostgresDateParsers();
