import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from '../../../database/entities/user.entity';

/**
 * JWT Token Payload Interface
 * 
 * Defines the structure of data stored within JWT tokens for authentication.
 * This payload is embedded in every JWT access token issued by the system.
 */
export interface JwtPayload {
  /**
   * Subject - The user ID that this token belongs to
   * @description Unique identifier of the authenticated user (UUID format)
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  sub: string;

  /**
   * Email address of the authenticated user
   * @description User's email used for identification and communication
   * @example "user@example.com"
   */
  email: string;

  /**
   * User role in the system
   * @description Determines user permissions and access levels
   * @example "CLIENT" | "FREELANCER" | "BROKER" | "ADMIN" | "STAFF"
   */
  role: string;

  /**
   * Issued At - When the token was created
   * @description Unix timestamp indicating when this JWT was issued
   * @optional Automatically populated by JWT library
   * @example 1640995200 (represents 2022-01-01 00:00:00 UTC)
   */
  iat?: number;

  /**
   * Expiration Time - When the token expires
   * @description Unix timestamp indicating when this JWT expires and becomes invalid
   * @optional Automatically populated by JWT library based on expiresIn setting
   * @example 1640998800 (represents 1 hour after iat)
   */
  exp?: number;
}

/**
 * JWT Authentication Strategy
 * 
 * Implements Passport JWT strategy for validating and processing JWT tokens.
 * This strategy is automatically used by guards decorated with @UseGuards(JwtAuthGuard).
 * 
 * @example
 * ```typescript
 * @UseGuards(JwtAuthGuard)
 * @Get('protected')
 * getProtectedData(@Req() req: AuthRequest) {
 *   // req.user is populated by this strategy's validate() method
 *   return `Hello ${req.user.email}`;
 * }
 * ```
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
  ) {
    const jwtSecret = configService.get<string>('jwt.secret');
    
    if (!jwtSecret) {
      throw new Error(
        'JWT_SECRET is not configured. Please set JWT_SECRET environment variable or configure jwt.secret in your config.'
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Validates JWT payload and retrieves user information
   * 
   * This method is automatically called by Passport after JWT signature verification.
   * It ensures the user still exists in the database and hasn't been deleted.
   * 
   * @param payload - Decoded JWT payload containing user information
   * @returns Promise<UserEntity> - Full user object that gets attached to request.user
   * @throws UnauthorizedException - When user is not found in database (deleted/deactivated)
   * 
   * @example
   * Input payload: { sub: "user-id-123", email: "user@example.com", role: "CLIENT" }
   * Output: UserEntity object with all user fields populated
   */
  async validate(payload: JwtPayload): Promise<UserEntity> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}