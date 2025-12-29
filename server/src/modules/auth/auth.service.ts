import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from '../../database/entities/user.entity';
import { AuthSessionEntity } from '../../database/entities/auth-session.entity';
import { LoginDto, RegisterDto, AuthResponseDto, LoginResponseDto, LogoutResponseDto } from './dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(AuthSessionEntity)
    private authSessionRepository: Repository<AuthSessionEntity>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditLogsService: AuditLogsService, // Inject AuditLogsService
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, fullName, phoneNumber, role } = registerDto;

    // Kiểm tra email đã tồn tại
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email đã được sử dụng');
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Tạo user mới
    const newUser = this.userRepository.create({
      email,
      passwordHash,
      fullName,
      phoneNumber,
      role: role, // No more type casting needed - RegisterableRole is subset of UserRole
      isVerified: false,
      currentTrustScore: 2.5, // Neutral score cho user mới (chưa có track record)
    });

    const savedUser = await this.userRepository.save(newUser);

    // Return user data (không bao gồm password)
    return this.mapToAuthResponse(savedUser);
  }

  async login(
    loginDto: LoginDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<LoginResponseDto> {
    const { email, password } = loginDto;

    // Tìm user theo email
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // Kiểm tra password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
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

  private mapToAuthResponse(user: UserEntity): AuthResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
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
