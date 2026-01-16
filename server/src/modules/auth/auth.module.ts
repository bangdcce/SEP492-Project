import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { CaptchaService } from './captcha.service';
import { JwtStrategy } from './strategies/jwt.strategy';
// import { GoogleStrategy } from './strategies/google.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CaptchaGuard } from '../../common/guards/captcha.guard';
import { UserEntity } from '../../database/entities/user.entity';
import { AuthSessionEntity } from '../../database/entities/auth-session.entity';
import { ProfileEntity } from '../../database/entities/profile.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, AuthSessionEntity, ProfileEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    AuditLogsModule, // Import để dùng AuditLogsService
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const secret = configService.get<string>('jwt.secret');
        const expiresIn = configService.get<string>('jwt.expiresIn');

        if (!secret) {
          throw new Error(
            'JWT_SECRET is not configured. Please set JWT_SECRET environment variable or configure jwt.secret in your config.',
          );
        }

        return {
          secret,
          signOptions: {
            expiresIn: (expiresIn || '15m') as any,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailService,
    CaptchaService,
    JwtStrategy,
    /* GoogleStrategy, */ JwtAuthGuard,
    CaptchaGuard,
  ],
  exports: [AuthService, JwtStrategy, PassportModule, JwtModule, CaptchaService],
})
export class AuthModule {}
