import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { PublicSkillsController } from './public-skills.controller';
import { ProfileController } from './profile.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { EmailVerificationService } from './email-verification.service';
import { CaptchaService } from './captcha.service';
import { JwtStrategy } from './strategies/jwt.strategy';
// import { GoogleStrategy } from './strategies/google.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CaptchaGuard } from '../../common/guards/captcha.guard';
import { UserEntity } from '../../database/entities/user.entity';
import { AuthSessionEntity } from '../../database/entities/auth-session.entity';
import { ProfileEntity } from '../../database/entities/profile.entity';
import { UserSkillEntity } from '../../database/entities/user-skill.entity';
import { UserSkillDomainEntity } from '../../database/entities/user-skill-domain.entity';
import { SkillDomainEntity } from '../../database/entities/skill-domain.entity';
import { SkillEntity } from '../../database/entities/skill.entity';
import { ProjectEntity } from '../../database/entities/project.entity';
import { WalletEntity } from '../../database/entities/wallet.entity';
import { UserSigningCredentialEntity } from '../../database/entities/user-signing-credential.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { SigningCredentialsService } from './signing-credentials.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      AuthSessionEntity,
      ProfileEntity,
      UserSkillEntity,
      UserSkillDomainEntity,
      SkillDomainEntity,
      SkillEntity,
      ProjectEntity,
      WalletEntity,
      UserSigningCredentialEntity,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    AuditLogsModule, // Imported to use AuditLogsService
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
  controllers: [AuthController, PublicSkillsController, ProfileController],
  providers: [
    AuthService,
    EmailService,
    EmailVerificationService,
    CaptchaService,
    JwtStrategy,
    /* GoogleStrategy, */ JwtAuthGuard,
    CaptchaGuard,
    SigningCredentialsService,
  ],
  exports: [
    AuthService,
    JwtStrategy,
    PassportModule,
    JwtModule,
    CaptchaService,
    EmailService,
    SigningCredentialsService,
  ],
})
export class AuthModule {}
