import { 
  Injectable, 
  UnauthorizedException, 
  ConflictException, 
  BadRequestException 
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { AuthSessionEntity } from '../../database/entities/auth-session.entity';
import { 
  LoginDto, 
  RegisterDto, 
  AuthResponseDto, 
  LoginResponseDto, 
  LogoutResponseDto 
} from './dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(AuthSessionEntity)
    private authSessionRepository: Repository<AuthSessionEntity>,
    private jwtService: JwtService,
    private configService: ConfigService,
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
      role: role as unknown as UserRole,
      isVerified: false,
      currentTrustScore: 5.0,
    });

    const savedUser = await this.userRepository.save(newUser);

    // Return user data (không bao gồm password)
    return this.mapToAuthResponse(savedUser);
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
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

    // Lưu auth session
    await this.createAuthSession(user.id, refreshToken);

    return {
      user: this.mapToAuthResponse(user),
      accessToken,
      refreshToken,
    };
  }

  async logout(userId: string, refreshToken?: string): Promise<LogoutResponseDto> {
    if (refreshToken) {
      // Hash refresh token để tìm session
      const refreshTokenHash = await bcrypt.hash(refreshToken, 12);
      await this.authSessionRepository.update(
        { userId, refreshTokenHash },
        { isRevoked: true, revokedAt: new Date() }
      );
    } else {
      // Revoke tất cả sessions của user
      await this.authSessionRepository.update(
        { userId, isRevoked: false },
        { isRevoked: true, revokedAt: new Date() }
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

  private async createAuthSession(userId: string, refreshToken: string): Promise<void> {
    // Revoke session cũ nếu có
    await this.authSessionRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true, revokedAt: new Date() }
    );

    // Hash refresh token
    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

    // Tạo session mới
    const authSession = this.authSessionRepository.create({
      userId,
      refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày
      isRevoked: false,
    });

    await this.authSessionRepository.save(authSession);
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
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}