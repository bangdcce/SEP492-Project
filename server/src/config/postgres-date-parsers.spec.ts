import {
  parsePostgresTimestampWithoutTimeZone,
  configurePostgresDateParsers,
} from './postgres-date-parsers';

describe('postgres-date-parsers', () => {
  it('parses timestamp-without-time-zone values as UTC instants', () => {
    const parsed = parsePostgresTimestampWithoutTimeZone('2026-03-27 13:45:30.123');

    expect(parsed.toISOString()).toBe('2026-03-27T13:45:30.123Z');
  });

  it('can be configured multiple times without throwing', () => {
    expect(() => configurePostgresDateParsers()).not.toThrow();
    expect(() => configurePostgresDateParsers()).not.toThrow();
  });
});
