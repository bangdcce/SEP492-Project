import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || 'redis123',
  db: parseInt(process.env.REDIS_DB || '0', 10),
  ttl: 60 * 60 * 24, // 24 hours default TTL
}));
