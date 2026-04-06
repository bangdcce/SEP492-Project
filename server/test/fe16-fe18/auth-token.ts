import { JwtService } from '@nestjs/jwt';

const TEST_JWT_SECRET = 'fe16-fe18-jwt-secret';

export const ensureJwtEnv = (): void => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || TEST_JWT_SECRET;
  process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET || 'fe16-fe18-refresh-secret';
  process.env.JWT_EXPIRATION = process.env.JWT_EXPIRATION || '1h';
  process.env.JWT_REFRESH_EXPIRATION =
    process.env.JWT_REFRESH_EXPIRATION || '7d';
};

export const signAccessToken = (input: {
  id: string;
  email: string;
  role: string;
}): string => {
  ensureJwtEnv();

  return new JwtService({ secret: process.env.JWT_SECRET }).sign({
    sub: input.id,
    email: input.email,
    role: input.role,
  });
};
