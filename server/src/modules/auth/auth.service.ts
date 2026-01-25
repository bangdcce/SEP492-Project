import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from '../../database/entities/user.entity';
import { AuthSessionEntity } from '../../database/entities/auth-session.entity';
import { ProfileEntity } from '../../database/entities/profile.entity';
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
} from './dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(AuthSessionEntity)
    private authSessionRepository: Repository<AuthSessionEntity>,
    @InjectRepository(ProfileEntity)
    private profileRepository: Repository<ProfileEntity>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private emailVerificationService: EmailVerificationService,
    private auditLogsService: AuditLogsService, // Inject AuditLogsService
  ) { }

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

    // Kiểm tra email đã tồn tại
    // Chỉ select các cột cần thiết để tránh lỗi nếu có cột chưa tồn tại
    const existingUser = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'email', 'passwordHash', 'fullName', 'role', 'phoneNumber', 'isVerified'],
    });

    if (existingUser) {
      throw new ConflictException('Email đã được sử dụng');
    }

    // Validate legal consent
    if (!acceptTerms || !acceptPrivacy) {
      throw new ConflictException('Bạn phải chấp nhận Điều khoản Dịch vụ và Chính sách Bảo mật');
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Tạo user mới với legal consent timestamps
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
    });

    const savedUser = await this.userRepository.save(newUser);

    // Nếu là BROKER hoặc FREELANCER → Lưu domains và skills
    if ((role === 'BROKER' || role === 'FREELANCER') && (domainIds || skillIds)) {
      const userSkillDomainRepo = this.userRepository.manager.getRepository('UserSkillDomainEntity');
      const userSkillRepo = this.userRepository.manager.getRepository('UserSkillEntity');

      // Lưu domains
      if (domainIds && domainIds.length > 0) {
        const domainRecords = domainIds.map(domainId => ({
          userId: savedUser.id,
          domainId,
        }));
        await userSkillDomainRepo.save(domainRecords);
      }

      // Lưu skills
      if (skillIds && skillIds.length > 0) {
        const skillRecords = skillIds.map(skillId => ({
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
      console.error('Failed to send verification email:', error);
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
      .catch(err => console.error('Failed to log registration:', err));

    // Return user data (không bao gồm password)
    return this.mapToAuthResponse(savedUser);
  }

  async login(
    loginDto: LoginDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<LoginResponseDto> {
    const { email, password } = loginDto;

    // Tìm user theo email với profile relation
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['profile'],
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // Kiểm tra password
    if (!user.passwordHash) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // Check if email is verified
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException({
        message: 'Please verify your email before logging in. Check your inbox.',
        error: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    // Tạo JWT tokens
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = randomBytes(64).toString('hex');

    // Lưu auth session với thông tin thiết bị
    await this.createAuthSession(user.id, refreshToken, userAgent, ipAddress);

    // Ghi Audit Log cho LOGIN
    this.auditLogsService
      .logLogin(
        user.id,
        { success: true, userAgent, ipAddress },
        { ip: ipAddress, headers: { 'user-agent': userAgent } },
      )
      .catch((err) => console.error('Lỗi ghi audit log:', err));

    return {
      user: this.mapToAuthResponse(user),
      accessToken,
      refreshToken,
    };
  }

  async logout(userId: string, refreshToken?: string): Promise<LogoutResponseDto> {
    if (refreshToken) {
      // Tìm tất cả sessions của user và kiểm tra refreshToken bằng bcrypt.compare
      const userSessions = await this.authSessionRepository.find({
        where: { userId, isRevoked: false },
      });

      // So sánh refreshToken với từng session hash
      for (const session of userSessions) {
        const isMatch = await bcrypt.compare(refreshToken, session.refreshTokenHash);
        if (isMatch) {
          // Revoke session tìm thấy
          await this.authSessionRepository.update(
            { id: session.id },
            { isRevoked: true, revokedAt: new Date() },
          );
          break;
        }
      }
    } else {
      // Revoke tất cả sessions của user
      await this.authSessionRepository.update(
        { userId, isRevoked: false },
        { isRevoked: true, revokedAt: new Date() },
      );
    }

    return {
      message: 'Đăng xuất thành công',
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
    // 1. Tìm session với refresh token này
    const sessions = await this.authSessionRepository.find({
      where: { isRevoked: false },
    });

    let validSession: AuthSessionEntity | null = null;
    for (const session of sessions) {
      // Kiểm tra token chưa hết hạn và so sánh với hash
      if (session.expiresAt > new Date()) {
        const isMatch = await bcrypt.compare(oldRefreshToken, session.refreshTokenHash);
        if (isMatch) {
          validSession = session;
          break;
        }
      }
    }

    if (!validSession) {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    // Lấy thông tin user từ session
    const user = await this.userRepository.findOne({
      where: { id: validSession.userId },
    });

    if (!user) {
      throw new UnauthorizedException('User không tồn tại');
    }

    // 2. Tạo tokens mới
    const payload: JwtPayload = {
      sub: validSession.userId,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const newRefreshToken = randomBytes(64).toString('hex');

    // 3. Rotate refresh token (security best practice)
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);

    await this.authSessionRepository.update(
      { id: validSession.id },
      {
        refreshTokenHash: newRefreshTokenHash,
        lastUsedAt: new Date(),
      },
    );

    return { accessToken, refreshToken: newRefreshToken };
  }

  private async createAuthSession(
    userId: string,
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<void> {
    // Chỉ revoke session cùng userAgent (cùng thiết bị), không revoke tất cả
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

    // Dọn dẹp sessions hết hạn của user này
    await this.cleanupExpiredSessions(userId);

    // Hash refresh token với salt rounds thấp hơn cho session
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    // Tạo session mới với thông tin thiết bị
    const authSession = this.authSessionRepository.create({
      userId,
      refreshTokenHash,
      userAgent: userAgent || 'Unknown Device',
      ipAddress: ipAddress || 'Unknown IP',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày
      isRevoked: false,
      lastUsedAt: new Date(),
    });

    await this.authSessionRepository.save(authSession);
  }

  /**
   * Dọn dẹp các sessions hết hạn hoặc quá nhiều sessions của user
   */
  private async cleanupExpiredSessions(userId: string): Promise<void> {
    // Xóa sessions hết hạn
    await this.authSessionRepository.delete({
      userId,
      expiresAt: LessThan(new Date()),
    });

    // Giới hạn tối đa 5 sessions active per user (để tránh tấn công)
    const activeSessions = await this.authSessionRepository.find({
      where: {
        userId,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    // Nếu có nhiều hơn 5 sessions, revoke những sessions cũ nhất
    if (activeSessions.length >= 5) {
      const sessionsToRevoke = activeSessions.slice(4); // Giữ 4 sessions mới nhất

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

    // 1. Tìm user theo email
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      // Security: Không tiết lộ email có tồn tại hay không
      return {
        message: 'If the email exists, you will receive an OTP code',
        email: this.emailService.maskEmail(email),
        expiresIn: 300,
      };
    }

    // 2. Generate 6-digit OTP
    const otp = this.emailService.generateOTP();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // 3. Lưu OTP vào database (plain text, short-lived)
    await this.userRepository.update(user.id, {
      resetPasswordOtp: otp,
      resetPasswordOtpExpires: otpExpires,
    });

    // 4. Gửi OTP qua Email
    try {
      await this.emailService.sendOTP(email, otp);
      console.log(`✅ OTP sent successfully to: ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send OTP to ${email}:`, error);
      // Continue execution even if email fails
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

    if (!user || !user.resetPasswordOtp || !user.resetPasswordOtpExpires) {
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

    // 2. Tìm user theo email
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user || !user.resetPasswordOtp || !user.resetPasswordOtpExpires) {
      throw new UnauthorizedException('Invalid or expired OTP code');
    }

    // 3. Check OTP expiration
    if (new Date() > user.resetPasswordOtpExpires) {
      throw new UnauthorizedException('OTP code has expired');
    }

    // 4. Verify OTP (plain text comparison)
    if (otp !== user.resetPasswordOtp) {
      throw new UnauthorizedException('Mã OTP không đúng');
    }

    // 5. Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // 6. Update password và clear OTP
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

    console.log(`✅ Password reset successful for user: ${user.email}`);

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
      throw new ConflictException('Email đã được sử dụng');
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

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<AuthResponseDto> {
    // Cập nhật thông tin User
    const updateUserData: Partial<UserEntity> = {};
    if (updateProfileDto.fullName) updateUserData.fullName = updateProfileDto.fullName;
    if (updateProfileDto.phoneNumber) updateUserData.phoneNumber = updateProfileDto.phoneNumber;

    if (Object.keys(updateUserData).length > 0) {
      await this.userRepository.update({ id: userId }, updateUserData);
    }

    // Tìm hoặc tạo Profile
    let profile = await this.profileRepository.findOne({ where: { userId } });

    if (!profile) {
      // Tạo profile mới nếu chưa có
      profile = this.profileRepository.create({
        userId,
        avatarUrl: updateProfileDto.avatarUrl,
        bio: updateProfileDto.bio,
        companyName: updateProfileDto.companyName,
        skills: updateProfileDto.skills,
        portfolioLinks: updateProfileDto.portfolioLinks,
      });
      await this.profileRepository.save(profile);
    } else {
      // Cập nhật profile
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

    // Lấy lại user với profile
    const updatedUser = await this.findUserWithProfile(userId);
    if (!updatedUser) {
      throw new Error('User not found after update');
    }
    return this.mapToAuthResponse(updatedUser);
  }

  private mapToAuthResponse(user: UserEntity): AuthResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      avatarUrl: user.profile?.avatarUrl,
      bio: user.profile?.bio,
      skills: user.profile?.skills,
      linkedinUrl: user.profile?.linkedinUrl,
      cvUrl: user.profile?.cvUrl,
      companyName: user.profile?.companyName,
      portfolioLinks: user.profile?.portfolioLinks,
      role: user.role,
      isVerified: user.isVerified,
      currentTrustScore: user.currentTrustScore,
      badge: user.badge, // Từ virtual property của Entity
      stats: user.stats, // Từ virtual property của Entity
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
