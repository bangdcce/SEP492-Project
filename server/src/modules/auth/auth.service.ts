import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository, LessThan, MoreThan, In, Not, IsNull, DeepPartial } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { UserEntity, UserRole, UserStatus } from '../../database/entities/user.entity';
import { AuthSessionEntity } from '../../database/entities/auth-session.entity';
import { ProfileEntity } from '../../database/entities/profile.entity';
import { ProjectEntity, ProjectStatus } from '../../database/entities/project.entity';
import { WalletEntity } from '../../database/entities/wallet.entity';
import { EmailService } from './email.service';
import { EmailVerificationService } from './email-verification.service';
import {
  LoginDto,
  RegisterDto,
  AuthResponseDto,
  LoginResponseDto,
  LogoutResponseDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ForgotPasswordResponseDto,
  ResetPasswordResponseDto,
  VerifyOtpDto,
  VerifyOtpResponseDto,
  UpdateProfileDto,
  DeleteAccountDto,
  DeleteAccountResponseDto,
  ActiveObligationsResponseDto,
} from './dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTokenLegacyScanLimit = 5000;

  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(AuthSessionEntity)
    private authSessionRepository: Repository<AuthSessionEntity>,
    @InjectRepository(ProfileEntity)
    private profileRepository: Repository<ProfileEntity>,
    @InjectRepository(ProjectEntity)
    private projectRepository: Repository<ProjectEntity>,
    @InjectRepository(WalletEntity)
    private walletRepository: Repository<WalletEntity>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private emailVerificationService: EmailVerificationService,
    private auditLogsService: AuditLogsService, // Inject AuditLogsService
  ) {}

  async register(
    registerDto: RegisterDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const {
      email,
      password,
      fullName,
      phoneNumber,
      role,
      domainIds,
      skillIds,
      acceptTerms,
      acceptPrivacy,
    } = registerDto;

    // Ki盻ノ tra email ﾄ妥｣ t盻渡 t蘯｡i
    // Ch盻・select cﾃ｡c c盻冲 c蘯ｧn thi蘯ｿt ﾄ黛ｻ・trﾃ｡nh l盻擁 n蘯ｿu cﾃｳ c盻冲 chﾆｰa t盻渡 t蘯｡i
    const existingUser = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'email', 'passwordHash', 'fullName', 'role', 'phoneNumber', 'isVerified'],
    });

    if (existingUser) {
      throw new ConflictException('Email ﾄ妥｣ ﾄ柁ｰ盻｣c s盻ｭ d盻･ng');
    }

    // Validate legal consent
    if (!acceptTerms || !acceptPrivacy) {
      throw new ConflictException(
        'B蘯｡n ph蘯｣i ch蘯･p nh蘯ｭn ﾄ進盻「 kho蘯｣n D盻議h v盻･ vﾃ Chﾃｭnh sﾃ｡ch B蘯｣o m蘯ｭt',
      );
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // T蘯｡o user m盻嬖 v盻嬖 legal consent timestamps
    const now = new Date();
    const newUser = this.userRepository.create({
      email,
      passwordHash,
      fullName,
      phoneNumber,
      role: role,
      isVerified: false,
      currentTrustScore: 2.5,
      termsAcceptedAt: acceptTerms ? now : null,
      privacyAcceptedAt: acceptPrivacy ? now : null,
      registrationIp: ipAddress,
      registrationUserAgent: userAgent,
    } as DeepPartial<UserEntity>);

    const savedUser = await this.userRepository.save(newUser);

    // N蘯ｿu lﾃ BROKER ho蘯ｷc FREELANCER 竊・Lﾆｰu domains vﾃ skills
    if ((role === UserRole.BROKER || role === UserRole.FREELANCER) && (domainIds || skillIds)) {
      const userSkillDomainRepo =
        this.userRepository.manager.getRepository('UserSkillDomainEntity');
      const userSkillRepo = this.userRepository.manager.getRepository('UserSkillEntity');

      // Lﾆｰu domains
      if (domainIds && domainIds.length > 0) {
        const domainRecords = domainIds.map((domainId) => ({
          userId: savedUser.id,
          domainId,
        }));
        await userSkillDomainRepo.save(domainRecords);
      }

      // Lﾆｰu skills
      if (skillIds && skillIds.length > 0) {
        const skillRecords = skillIds.map((skillId) => ({
          userId: savedUser.id,
          skillId,
          priority: 'SECONDARY', // Default to SECONDARY, user can upgrade later
          verificationStatus: 'SELF_DECLARED',
        }));
        await userSkillRepo.save(skillRecords);
      }
    }

    // Send email verification
    try {
      await this.emailVerificationService.sendVerificationEmail(savedUser.id, savedUser.email);
    } catch (error) {
      // Don't fail registration if email fails, user can resend later
    }

    // Audit Log: REGISTRATION EVENT
    this.auditLogsService
      .logRegistration(savedUser.id, {
        role: savedUser.role,
        email: savedUser.email,
        ipAddress,
        userAgent,
        domainCount: domainIds?.length || 0,
        skillCount: skillIds?.length || 0,
      })
      .catch(() => {});

    // Return user data (khﾃｴng bao g盻杜 password)
    return this.mapToAuthResponse(savedUser);
  }

  async login(
    loginDto: LoginDto,
    userAgent?: string,
    ipAddress?: string,
    timeZone?: string,
  ): Promise<LoginResponseDto> {
    const { email, password } = loginDto;

    // Tﾃｬm user theo email v盻嬖 profile relation
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['profile'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check password
    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check user status
    if (user.status === UserStatus.DELETED) {
      throw new UnauthorizedException('This account has been deleted');
    }

    if (user.isBanned) {
      throw new UnauthorizedException('This account has been banned. Please contact support.');
    }

    // Check if email is verified
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException({
        message: 'Please verify your email before logging in. Check your inbox.',
        error: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    if (timeZone && user.timeZone !== timeZone) {
      await this.userRepository.update({ id: user.id }, { timeZone });
      user.timeZone = timeZone;
    }

    // T蘯｡o JWT tokens
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = randomBytes(64).toString('hex');

    // Lﾆｰu auth session v盻嬖 thﾃｴng tin thi蘯ｿt b盻・
    await this.createAuthSession(user.id, refreshToken, userAgent, ipAddress);

    // Ghi Audit Log cho LOGIN
    this.auditLogsService
      .logLogin(
        user.id,
        { success: true, userAgent, ipAddress },
        { ip: ipAddress, headers: { 'user-agent': userAgent } },
      )
      .catch(() => {});

    return {
      user: this.mapToAuthResponse(user),
      accessToken,
      refreshToken,
    };
  }

  async logout(userId: string, refreshToken?: string): Promise<LogoutResponseDto> {
    if (refreshToken) {
      const refreshTokenFingerprint = this.buildRefreshTokenFingerprint(refreshToken);
      const directMatch = await this.authSessionRepository.findOne({
        where: {
          userId,
          refreshTokenFingerprint,
          isRevoked: false,
        },
        select: ['id'],
      });

      if (directMatch) {
        await this.authSessionRepository.update(
          { id: directMatch.id },
          { isRevoked: true, revokedAt: new Date() },
        );
      } else {
        // Tﾃｬm t蘯･t c蘯｣ sessions c盻ｧa user vﾃ ki盻ノ tra refreshToken b蘯ｱng bcrypt.compare
        const userSessions = await this.authSessionRepository.find({
          where: { userId, isRevoked: false },
        });

        // So sﾃ｡nh refreshToken v盻嬖 t盻ｫng session hash
        for (const session of userSessions) {
          const isMatch = await bcrypt.compare(refreshToken, session.refreshTokenHash);
          if (isMatch) {
            if (!session.refreshTokenFingerprint) {
              await this.authSessionRepository.update(
                { id: session.id },
                { refreshTokenFingerprint },
              );
            }

            // Revoke session tﾃｬm th蘯･y
            await this.authSessionRepository.update(
              { id: session.id },
              { isRevoked: true, revokedAt: new Date() },
            );
            break;
          }
        }
      }
    } else {
      // Revoke t蘯･t c蘯｣ sessions c盻ｧa user
      await this.authSessionRepository.update(
        { userId, isRevoked: false },
        { isRevoked: true, revokedAt: new Date() },
      );
    }

    return {
      message: 'ﾄ斉ハg xu蘯･t thﾃnh cﾃｴng',
    };
  }

  async validateUser(userId: string): Promise<UserEntity | null> {
    return await this.userRepository.findOne({
      where: { id: userId },
    });
  }

  async refreshToken(oldRefreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    if (!oldRefreshToken) {
      throw new UnauthorizedException({
        error: 'INVALID_REFRESH',
        message: 'Refresh token is missing',
      });
    }

    const matchedSession = await this.findSessionByRefreshToken(oldRefreshToken);

    if (!matchedSession) {
      this.logger.warn('Refresh rejected: INVALID_REFRESH');
      throw new UnauthorizedException({
        error: 'INVALID_REFRESH',
        message: 'Refresh token is invalid',
      });
    }

    if (matchedSession.isRevoked) {
      this.logger.warn(`Refresh rejected: SESSION_REVOKED user=${matchedSession.userId}`);
      throw new UnauthorizedException({
        error: 'SESSION_REVOKED',
        message: 'Session has been revoked',
      });
    }

    if (matchedSession.expiresAt <= new Date()) {
      await this.authSessionRepository.update(
        { id: matchedSession.id },
        { isRevoked: true, revokedAt: new Date() },
      );
      this.logger.warn(`Refresh rejected: SESSION_EXPIRED user=${matchedSession.userId}`);
      throw new UnauthorizedException({
        error: 'SESSION_EXPIRED',
        message: 'Session has expired',
      });
    }

    const user = await this.userRepository.findOne({
      where: { id: matchedSession.userId },
    });

    if (!user) {
      this.logger.warn(`Refresh rejected: SESSION_REVOKED missing-user=${matchedSession.userId}`);
      throw new UnauthorizedException({
        error: 'SESSION_REVOKED',
        message: 'Session owner no longer exists',
      });
    }

    const payload: JwtPayload = {
      sub: matchedSession.userId,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const newRefreshToken = randomBytes(64).toString('hex');

    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
    const newRefreshTokenFingerprint = this.buildRefreshTokenFingerprint(newRefreshToken);

    await this.authSessionRepository.update(
      { id: matchedSession.id },
      {
        refreshTokenHash: newRefreshTokenHash,
        refreshTokenFingerprint: newRefreshTokenFingerprint,
        lastUsedAt: new Date(),
      },
    );

    return { accessToken, refreshToken: newRefreshToken };
  }

  private buildRefreshTokenFingerprint(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async findSessionByRefreshToken(token: string): Promise<AuthSessionEntity | null> {
    const refreshTokenFingerprint = this.buildRefreshTokenFingerprint(token);
    const byFingerprint = await this.authSessionRepository.findOne({
      where: { refreshTokenFingerprint },
    });

    if (byFingerprint) {
      return byFingerprint;
    }

    // Backward-compatible fallback for sessions created before fingerprint support.
    const legacyCandidates = await this.authSessionRepository.find({
      where: {
        refreshTokenFingerprint: IsNull(),
        expiresAt: MoreThan(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
      },
      order: { createdAt: 'DESC' },
      take: this.refreshTokenLegacyScanLimit,
    });

    for (const session of legacyCandidates) {
      const isMatch = await bcrypt.compare(token, session.refreshTokenHash);
      if (isMatch) {
        await this.authSessionRepository.update({ id: session.id }, { refreshTokenFingerprint });
        return session;
      }
    }

    return null;
  }

  private async createAuthSession(
    userId: string,
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<void> {
    // Ch盻・revoke session cﾃｹng userAgent (cﾃｹng thi蘯ｿt b盻・, khﾃｴng revoke t蘯･t c蘯｣
    if (userAgent) {
      await this.authSessionRepository.update(
        {
          userId,
          userAgent,
          isRevoked: false,
        },
        { isRevoked: true, revokedAt: new Date() },
      );
    }

    // D盻肱 d蘯ｹp sessions h蘯ｿt h蘯｡n c盻ｧa user nﾃy
    await this.cleanupExpiredSessions(userId);

    // Hash refresh token v盻嬖 salt rounds th蘯･p hﾆ｡n cho session
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const refreshTokenFingerprint = this.buildRefreshTokenFingerprint(refreshToken);

    // T蘯｡o session m盻嬖 v盻嬖 thﾃｴng tin thi蘯ｿt b盻・
    const authSession = this.authSessionRepository.create({
      userId,
      refreshTokenHash,
      refreshTokenFingerprint,
      userAgent: userAgent || 'Unknown Device',
      ipAddress: ipAddress || 'Unknown IP',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngﾃy
      isRevoked: false,
      lastUsedAt: new Date(),
    });

    await this.authSessionRepository.save(authSession);
  }

  /**
   * D盻肱 d蘯ｹp cﾃ｡c sessions h蘯ｿt h蘯｡n ho蘯ｷc quﾃ｡ nhi盻「 sessions c盻ｧa user
   */
  private async cleanupExpiredSessions(userId: string): Promise<void> {
    // Xﾃｳa sessions h蘯ｿt h蘯｡n
    await this.authSessionRepository.delete({
      userId,
      expiresAt: LessThan(new Date()),
    });

    // Gi盻嬖 h蘯｡n t盻訴 ﾄ疎 5 sessions active per user (ﾄ黛ｻ・trﾃ｡nh t蘯･n cﾃｴng)
    const activeSessions = await this.authSessionRepository.find({
      where: {
        userId,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    // N蘯ｿu cﾃｳ nhi盻「 hﾆ｡n 5 sessions, revoke nh盻ｯng sessions cﾅｩ nh蘯･t
    if (activeSessions.length >= 5) {
      const sessionsToRevoke = activeSessions.slice(4); // Gi盻ｯ 4 sessions m盻嬖 nh蘯･t

      for (const session of sessionsToRevoke) {
        await this.authSessionRepository.update(session.id, {
          isRevoked: true,
          revokedAt: new Date(),
        });
      }
    }
  }

  /**
   * Request password reset via SMS OTP
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<ForgotPasswordResponseDto> {
    const { email } = forgotPasswordDto;

    // 1. Find user by email
    const user = await this.userRepository.findOne({
      where: { email },
    });

    // Reject non-existent, deleted, or banned accounts immediately
    if (!user || user.status === UserStatus.DELETED || user.isBanned) {
      this.logger.warn(`ForgotPassword: User not found or inactive for email=${email}`);
      throw new BadRequestException('Email does not exist');
    }

    // 2. Generate 6-digit OTP
    const otp = this.emailService.generateOTP();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // 3. Save OTP to database (plain text, short-lived)
    await this.userRepository.update(user.id, {
      resetPasswordOtp: otp,
      resetPasswordOtpExpires: otpExpires,
    });

    // 4. Send OTP via Email
    try {
      await this.emailService.sendOTP(email, otp);
    } catch (error) {
      this.logger.error(`ForgotPassword: Failed to send OTP to ${email}: ${error.message}`);
      // Continue execution even if email fails - user can resend or check logs
    }

    return {
      message: 'OTP code has been sent to your email',
      email: this.emailService.maskEmail(email),
      expiresIn: 300, // 5 minutes in seconds
    };
  }

  /**
   * Verify OTP (optional endpoint to check OTP before resetting password)
   */
  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<VerifyOtpResponseDto> {
    const { email, otp } = verifyOtpDto;

    const user = await this.userRepository.findOne({
      where: { email },
    });

    // Return generic error for deleted/banned/non-existent accounts
    if (
      !user ||
      user.status === UserStatus.DELETED ||
      user.isBanned ||
      !user.resetPasswordOtp ||
      !user.resetPasswordOtpExpires
    ) {
      return {
        message: 'Invalid OTP code',
        isValid: false,
      };
    }

    // Check expiration
    if (new Date() > user.resetPasswordOtpExpires) {
      return {
        message: 'OTP code has expired',
        isValid: false,
      };
    }

    // Verify OTP (plain text comparison)
    const isValidOtp = otp === user.resetPasswordOtp;

    return {
      message: isValidOtp ? 'OTP code is valid' : 'Incorrect OTP code',
      isValid: isValidOtp,
    };
  }

  /**
   * Reset password with OTP
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<ResetPasswordResponseDto> {
    const { email, otp, newPassword, confirmPassword } = resetPasswordDto;

    // 1. Validate password confirmation
    if (newPassword !== confirmPassword) {
      throw new UnauthorizedException('Password confirmation does not match');
    }

    // 2. Tﾃｬm user theo email
    const user = await this.userRepository.findOne({
      where: { email },
    });

    // Return generic error for deleted/banned/non-existent accounts
    if (
      !user ||
      user.status === UserStatus.DELETED ||
      user.isBanned ||
      !user.resetPasswordOtp ||
      !user.resetPasswordOtpExpires
    ) {
      throw new UnauthorizedException('Invalid or expired OTP code');
    }

    // 3. Check OTP expiration
    if (new Date() > user.resetPasswordOtpExpires) {
      throw new UnauthorizedException('OTP code has expired');
    }

    // 4. Verify OTP (plain text comparison)
    if (otp !== user.resetPasswordOtp) {
      throw new UnauthorizedException('Invalid OTP code');
    }

    // 5. Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // 6. Update password vﾃ clear OTP
    await this.userRepository.update(user.id, {
      passwordHash: hashedNewPassword,
      resetPasswordOtp: undefined,
      resetPasswordOtpExpires: undefined,
    });

    // 7. Revoke all existing auth sessions for security
    await this.authSessionRepository.update(
      { userId: user.id, isRevoked: false },
      { isRevoked: true, revokedAt: new Date() },
    );

    return {
      message: 'Password reset successful. Please login again.',
    };
  }

  /**
   * Handle Google OAuth login/signup - TEMPORARILY DISABLED
   * If user exists, login. If not, return profile for frontend to complete signup.
   */
  /* async googleAuth(googleProfile: {
    email: string;
    firstName: string;
    lastName: string;
    picture?: string;
  }): Promise<LoginResponseDto | { isNewUser: true; profile: any }> {
    const { email, firstName, lastName, picture } = googleProfile;

    // Check if user exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      // Existing user - login directly
      const payload: JwtPayload = {
        sub: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
      };

      const accessToken = this.jwtService.sign(payload);
      const refreshToken = randomBytes(64).toString('hex');
      const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

      // Create new auth session
      const session = this.authSessionRepository.create({
        userId: existingUser.id,
        refreshTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      await this.authSessionRepository.save(session);

      return {
        accessToken,
        refreshToken,
        user: this.mapToAuthResponse(existingUser),
      };
    } else {
      // New user - return profile for frontend to complete signup
      return {
        isNewUser: true,
        profile: {
          email,
          fullName: `${firstName} ${lastName}`.trim(),
          picture,
        },
      };
    }
  }

  /**
   * Complete Google OAuth signup with role and phone - TEMPORARILY DISABLED
   */
  /* async completeGoogleSignup(
    email: string,
    fullName: string,
    phoneNumber: string,
    role: string,
    picture?: string,
  ): Promise<LoginResponseDto> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email ﾄ妥｣ ﾄ柁ｰ盻｣c s盻ｭ d盻･ng');
    }

    // Create new user (no password needed for Google OAuth users)
    const newUser = this.userRepository.create({
      email,
      passwordHash: randomBytes(32).toString('hex'), // Random password (won't be used)
      fullName,
      phoneNumber,
      role: role as any,
      isVerified: true, // Google email is already verified
      currentTrustScore: 5.0,
      // Note: Google profile picture stored in picture param but not saved to DB yet
      // Can be added later when ProfileEntity is implemented
    });

    const savedUser = await this.userRepository.save(newUser);

    // Create tokens
    const payload: JwtPayload = {
      sub: savedUser.id,
      email: savedUser.email,
      role: savedUser.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = randomBytes(64).toString('hex');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    // Create auth session
    const session = this.authSessionRepository.create({
      userId: savedUser.id,
      refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await this.authSessionRepository.save(session);

    return {
      accessToken,
      refreshToken,
      user: this.mapToAuthResponse(savedUser),
    };
  }
  */

  async findUserWithProfile(userId: string): Promise<UserEntity | null> {
    return await this.userRepository.findOne({
      where: { id: userId },
      relations: ['profile'],
    });
  }

  async getSessionUser(userId: string): Promise<AuthResponseDto> {
    const user = await this.findUserWithProfile(userId);
    if (!user) {
      throw new UnauthorizedException({
        error: 'SESSION_REVOKED',
        message: 'Authenticated user not found',
      });
    }
    return this.mapToAuthResponse(user);
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<AuthResponseDto> {
    // C蘯ｭp nh蘯ｭt thﾃｴng tin User
    const updateUserData: Partial<UserEntity> = {};
    if (updateProfileDto.fullName) updateUserData.fullName = updateProfileDto.fullName;
    if (updateProfileDto.phoneNumber) updateUserData.phoneNumber = updateProfileDto.phoneNumber;
    if (updateProfileDto.timeZone) updateUserData.timeZone = updateProfileDto.timeZone;

    if (Object.keys(updateUserData).length > 0) {
      await this.userRepository.update({ id: userId }, updateUserData);
    }

    // Tﾃｬm ho蘯ｷc t蘯｡o Profile
    let profile = await this.profileRepository.findOne({ where: { userId } });

    if (!profile) {
      // T蘯｡o profile m盻嬖 n蘯ｿu chﾆｰa cﾃｳ
      profile = this.profileRepository.create({
        userId,
        avatarUrl: updateProfileDto.avatarUrl,
        bio: updateProfileDto.bio,
        companyName: updateProfileDto.companyName,
        skills: updateProfileDto.skills,
        portfolioLinks: updateProfileDto.portfolioLinks,
        linkedinUrl: updateProfileDto.linkedinUrl,
        cvUrl: updateProfileDto.cvUrl,
      });
      await this.profileRepository.save(profile);
    } else {
      // C蘯ｭp nh蘯ｭt profile
      const updateProfileData: Partial<ProfileEntity> = {};
      if (updateProfileDto.avatarUrl !== undefined)
        updateProfileData.avatarUrl = updateProfileDto.avatarUrl;
      if (updateProfileDto.bio !== undefined) updateProfileData.bio = updateProfileDto.bio;
      if (updateProfileDto.companyName !== undefined)
        updateProfileData.companyName = updateProfileDto.companyName;
      if (updateProfileDto.skills !== undefined) updateProfileData.skills = updateProfileDto.skills;
      if (updateProfileDto.portfolioLinks !== undefined)
        updateProfileData.portfolioLinks = updateProfileDto.portfolioLinks;
      if (updateProfileDto.linkedinUrl !== undefined)
        updateProfileData['linkedinUrl'] = updateProfileDto.linkedinUrl;
      if (updateProfileDto.cvUrl !== undefined) updateProfileData['cvUrl'] = updateProfileDto.cvUrl;

      if (Object.keys(updateProfileData).length > 0) {
        await this.profileRepository.update({ userId }, updateProfileData);
      }
    }

    // L蘯･y l蘯｡i user v盻嬖 profile
    const updatedUser = await this.findUserWithProfile(userId);
    if (!updatedUser) {
      throw new Error('User not found after update');
    }
    return this.mapToAuthResponse(updatedUser);
  }

  /**
   * Check active obligations before account deletion
   */
  async checkActiveObligations(userId: string): Promise<{
    hasObligations: boolean;
    activeProjects: number;
    walletBalance: number;
  }> {
    // Check for active projects (as client, broker, or freelancer)
    const activeStatuses = [
      ProjectStatus.INITIALIZING,
      ProjectStatus.PLANNING,
      ProjectStatus.IN_PROGRESS,
      ProjectStatus.TESTING,
      ProjectStatus.DISPUTED,
    ];

    const activeProjectsCount = await this.projectRepository.count({
      where: [
        { clientId: userId, status: In(activeStatuses) },
        { brokerId: userId, status: In(activeStatuses) },
        { freelancerId: userId, status: In(activeStatuses) },
      ],
    });

    // Check wallet balance
    const wallet = await this.walletRepository.findOne({
      where: { userId },
    });

    const walletBalance = wallet ? Number(wallet.balance) + Number(wallet.pendingBalance) : 0;

    return {
      hasObligations: activeProjectsCount > 0 || walletBalance > 0,
      activeProjects: activeProjectsCount,
      walletBalance,
    };
  }

  /**
   * Delete user account after verification
   */
  async deleteAccount(
    userId: string,
    deleteAccountDto: DeleteAccountDto,
  ): Promise<DeleteAccountResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check if user is already deleted
    if (user.status === UserStatus.DELETED) {
      throw new BadRequestException('This account has already been deleted');
    }

    // Verify password
    if (!user.passwordHash) {
      throw new BadRequestException('This account does not have a password');
    }

    const isPasswordValid = await bcrypt.compare(deleteAccountDto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Incorrect password');
    }

    // Check for active obligations
    const obligations = await this.checkActiveObligations(userId);

    if (obligations.hasObligations) {
      throw new BadRequestException({
        message: 'Cannot delete account while having active projects or wallet balance',
        activeProjects: obligations.activeProjects,
        walletBalance: obligations.walletBalance,
      });
    }

    // Revoke all auth sessions
    await this.authSessionRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true, revokedAt: new Date() },
    );

    // Store original data for audit log before anonymization
    const originalEmail = user.email;
    const originalFullName = user.fullName;
    const originalRole = user.role;

    // Generate unique identifier for anonymization
    const anonymousId = randomUUID();
    const deletedAt = new Date();

    // Soft delete with anonymization
    await this.userRepository.update(
      { id: userId },
      {
        status: UserStatus.DELETED,
        deletedAt: deletedAt,
        deletedReason: deleteAccountDto.reason || 'User requested account deletion',
        email: `deleted_${anonymousId}@system.local`,
        phoneNumber: '', // Anonymize phone number
        fullName: 'Deleted User',
        passwordHash: '', // Clear password for security
        isVerified: false,
        // Clear all auth tokens for security
        emailVerificationToken: undefined,
        emailVerificationExpires: undefined,
        resetPasswordOtp: undefined,
        resetPasswordOtpExpires: undefined,
      },
    );

    // Anonymize profile data
    await this.profileRepository.update(
      { userId },
      {
        bio: '',
        linkedinUrl: '',
        cvUrl: '',
        avatarUrl: '',
        portfolioLinks: [],
      },
    );

    // Log the account deletion
    this.auditLogsService
      .log({
        actorId: userId,
        action: 'ACCOUNT_DELETED',
        entityType: 'USER',
        entityId: userId,
        oldData: {
          email: originalEmail,
          fullName: originalFullName,
          role: originalRole,
        },
        newData: {
          status: UserStatus.DELETED,
          deletedAt: deletedAt.toISOString(),
          anonymizedEmail: `deleted_${anonymousId}@system.local`,
        },
      })
      .catch(() => {});

    return {
      message: 'Account has been deleted successfully',
    };
  }

  private mapToAuthResponse(user: UserEntity): AuthResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      timeZone: user.timeZone,
      avatarUrl: user.profile?.avatarUrl,
      bio: user.profile?.bio,
      skills: user.profile?.skills,
      linkedinUrl: user.profile?.linkedinUrl,
      cvUrl: user.profile?.cvUrl,
      companyName: user.profile?.companyName,
      portfolioLinks: user.profile?.portfolioLinks,
      role: user.role,
      isVerified: user.isVerified,
      isEmailVerified: !!user.emailVerifiedAt,
      currentTrustScore: user.currentTrustScore,
      badge: user.badge, // T盻ｫ virtual property c盻ｧa Entity
      stats: user.stats, // T盻ｫ virtual property c盻ｧa Entity
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
