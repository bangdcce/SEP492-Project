import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => {
  const secret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is required but not set. Please configure JWT_SECRET in your environment variables.',
    );
  }

  if (!refreshSecret) {
    throw new Error(
      'JWT_REFRESH_SECRET environment variable is required but not set. Please configure JWT_REFRESH_SECRET in your environment variables.',
    );
  }

  return {
    secret,
    expiresIn: process.env.JWT_EXPIRATION || '15m', // Shorter default for better security
    refreshSecret,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
  };
});
