import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository, LessThan, MoreThan, In, Not, IsNull, DeepPartial } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import { UserEntity, UserRole, UserStatus } from '../../database/entities/user.entity';
import { AuthSessionEntity } from '../../database/entities/auth-session.entity';
import { ProfileEntity } from '../../database/entities/profile.entity';
import {
  StaffApplicationEntity,
  StaffApplicationStatus,
} from '../../database/entities/staff-application.entity';
import { ProjectEntity, ProjectStatus } from '../../database/entities/project.entity';
import { WalletEntity } from '../../database/entities/wallet.entity';
import { SkillDomainEntity } from '../../database/entities/skill-domain.entity';
import { SkillEntity, SkillCategory } from '../../database/entities/skill.entity';
import { EmailService } from './email.service';
import { EmailVerificationService } from './email-verification.service';
import { CaptchaService } from './captcha.service';
import {
  LoginDto,
  RegisterDto,
  RegisterStaffDto,
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
import { normalizeAuthEmail } from './utils/email.utils';
import { supabaseClient } from '../../config/supabase.config';
import { uploadEncryptedFile } from '../../common/utils/supabase-storage.util';
import { MulterFile } from '../../common/types/multer.type';

interface StaffRegistrationFiles {
  cv?: MulterFile;
  idCardFront?: MulterFile;
  idCardBack?: MulterFile;
  selfie?: MulterFile;
}

interface UploadedCvAsset {
  storageKey: string;
  publicUrl: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTokenLegacyScanLimit = 5000;
  private readonly customDomainPrefix = '__other_domain__:';
  private readonly customSkillPrefix = '__other_skill__:';

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
    @Optional() private captchaService?: CaptchaService,
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

    if (role === UserRole.STAFF) {
      throw new BadRequestException('Staff registrations must use /auth/register/staff');
    }

    const normalizedEmail = normalizeAuthEmail(email);

    // Check whether the email already exists.
    // Select only the fields we need to avoid issues when optional relations are missing.
    const existingUser = await this.userRepository.findOne({
      where: { email: normalizedEmail },
      select: ['id', 'email', 'passwordHash', 'fullName', 'role', 'phoneNumber', 'isVerified'],
    });

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    // Validate legal consent
    if (!acceptTerms || !acceptPrivacy) {
      throw new ConflictException(
        'You must accept the Terms of Service and Privacy Policy',
      );
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create the user and store legal-consent timestamps.
    const now = new Date();
    const newUser = this.userRepository.create({
      email: normalizedEmail,
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

    const parsedDomains = this.parseTaggedSelections(domainIds, this.customDomainPrefix);
    const parsedSkills = this.parseTaggedSelections(skillIds, this.customSkillPrefix);
    let selectedDomainCount = parsedDomains.ids.length;
    let selectedSkillCount = parsedSkills.ids.length;

    // Save role-specific domains/skills, including free-text "Other" values.
    if (
      (role === UserRole.BROKER || role === UserRole.FREELANCER) &&
      (parsedDomains.ids.length > 0 || parsedSkills.ids.length > 0 || parsedDomains.custom.length > 0 || parsedSkills.custom.length > 0)
    ) {
      const userSkillDomainRepo =
        this.userRepository.manager.getRepository('UserSkillDomainEntity');
      const userSkillRepo = this.userRepository.manager.getRepository('UserSkillEntity');
      const skillDomainRepo = this.userRepository.manager.getRepository(SkillDomainEntity);
      const skillRepo = this.userRepository.manager.getRepository(SkillEntity);

      const selectedDomainIds = new Set(parsedDomains.ids);
      const selectedSkillIds = new Set(parsedSkills.ids);
      const normalizedCustomDomains = this.normalizeCustomEntries(parsedDomains.custom);
      const normalizedCustomSkills = this.normalizeCustomEntries(parsedSkills.custom);

      for (const domainName of normalizedCustomDomains) {
        // Only reuse official/public domains. User-added entries stay private per account.
        const domain = await skillDomainRepo
          .createQueryBuilder('domain')
          .where('LOWER(domain.name) = LOWER(:name)', { name: domainName })
          .andWhere('domain.isActive = :isActive', { isActive: true })
          .andWhere('(domain.description IS NULL OR domain.description NOT ILIKE :customPrefix)', {
            customPrefix: 'User-added%',
          })
          .getOne();

        if (domain) {
          selectedDomainIds.add(domain.id);
          continue;
        }

        const privateDomain = await skillDomainRepo.save(
          skillDomainRepo.create({
            name: domainName,
            slug: this.toSafeSlug(domainName, 'custom-domain'),
            description: 'User-added during registration (private)',
            isActive: false,
            sortOrder: 9999,
          }),
        );

        selectedDomainIds.add(privateDomain.id);
      }

      for (const skillName of normalizedCustomSkills) {
        // Only reuse official/public skills. User-added entries stay private per account.
        const skill = await skillRepo
          .createQueryBuilder('skill')
          .where('LOWER(skill.name) = LOWER(:name)', { name: skillName })
          .andWhere('skill.isActive = :isActive', { isActive: true })
          .andWhere('(skill.description IS NULL OR skill.description NOT ILIKE :customPrefix)', {
            customPrefix: 'User-added%',
          })
          .getOne();

        if (skill) {
          const needsRoleFlagUpdate =
            (role === UserRole.FREELANCER && !skill.forFreelancer) ||
            (role === UserRole.BROKER && !skill.forBroker);

          if (needsRoleFlagUpdate) {
            if (role === UserRole.FREELANCER) skill.forFreelancer = true;
            if (role === UserRole.BROKER) skill.forBroker = true;
            await skillRepo.save(skill);
          }

          selectedSkillIds.add(skill.id);
          continue;
        }

        const privateSkill = await skillRepo.save(
          skillRepo.create({
            name: skillName,
            slug: this.toSafeSlug(skillName, 'custom-skill'),
            category: SkillCategory.OTHER,
            description: 'User-added during registration (private)',
            isActive: false,
            sortOrder: 9999,
            forFreelancer: role === UserRole.FREELANCER,
            forBroker: role === UserRole.BROKER,
          }),
        );

        selectedSkillIds.add(privateSkill.id);
      }

      // Save domains.
      if (selectedDomainIds.size > 0) {
        const domainRecords = [...selectedDomainIds].map((domainId) => ({
          userId: savedUser.id,
          domainId,
        }));
        await userSkillDomainRepo.save(domainRecords);
      }

      // Save skills.
      if (selectedSkillIds.size > 0) {
        const skillRecords = [...selectedSkillIds].map((skillId) => ({
          userId: savedUser.id,
          skillId,
          priority: 'SECONDARY', // Default to SECONDARY, user can upgrade later
          verificationStatus: 'SELF_DECLARED',
        }));
        await userSkillRepo.save(skillRecords);
      }

      selectedDomainCount = selectedDomainIds.size;
      selectedSkillCount = selectedSkillIds.size;
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
        domainCount: selectedDomainCount,
        skillCount: selectedSkillCount,
      })
      .catch(() => {});

    // Return public user data without any password fields.
    return this.mapToAuthResponse(savedUser);
  }

  async registerStaff(
    registerDto: RegisterStaffDto,
    files: StaffRegistrationFiles,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    this.validateStaffRegistrationFiles(files);
    await this.validateStaffRecaptcha(registerDto.recaptchaToken);

    const normalizedEmail = normalizeAuthEmail(registerDto.email);
    const existingUser = await this.userRepository.findOne({
      where: { email: normalizedEmail },
      select: ['id', 'email', 'passwordHash', 'fullName', 'role', 'phoneNumber', 'isVerified'],
    });

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    if (!registerDto.acceptTerms || !registerDto.acceptPrivacy) {
      throw new ConflictException(
        'You must accept the Terms of Service and Privacy Policy',
      );
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);
    const now = new Date();

    const newUser = this.userRepository.create({
      email: normalizedEmail,
      passwordHash,
      fullName: registerDto.fullName,
      phoneNumber: registerDto.phoneNumber,
      role: UserRole.STAFF,
      isVerified: false,
      currentTrustScore: 2.5,
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
      registrationIp: ipAddress,
      registrationUserAgent: userAgent,
    } as DeepPartial<UserEntity>);

    const savedUser = await this.userRepository.save(newUser);

    const cvAsset = await this.uploadStaffCv(savedUser.id, files.cv!);
    const [idCardFrontStorageKey, idCardBackStorageKey, selfieStorageKey] = await Promise.all([
      uploadEncryptedFile(
        files.idCardFront!.buffer,
        savedUser.id,
        'id-front',
        files.idCardFront!.mimetype,
      ),
      uploadEncryptedFile(
        files.idCardBack!.buffer,
        savedUser.id,
        'id-back',
        files.idCardBack!.mimetype,
      ),
      uploadEncryptedFile(
        files.selfie!.buffer,
        savedUser.id,
        'selfie',
        files.selfie!.mimetype,
      ),
    ]);

    const profile = await this.profileRepository.save({
      userId: savedUser.id,
      cvUrl: cvAsset.publicUrl,
    } as DeepPartial<ProfileEntity>);

    const staffApplicationRepository =
      this.userRepository.manager.getRepository(StaffApplicationEntity);
    const staffApplication = await staffApplicationRepository.save(
      staffApplicationRepository.create({
        userId: savedUser.id,
        status: StaffApplicationStatus.PENDING,
        cvStorageKey: cvAsset.storageKey,
        cvOriginalFilename: this.limitLength(files.cv!.originalname, 255),
        cvMimeType: files.cv!.mimetype,
        cvSize: files.cv!.size,
        fullNameOnDocument: registerDto.fullNameOnDocument,
        documentType: registerDto.documentType,
        documentNumber: registerDto.documentNumber,
        dateOfBirth: new Date(registerDto.dateOfBirth),
        address: registerDto.address,
        idCardFrontStorageKey,
        idCardBackStorageKey,
        selfieStorageKey,
      }),
    );

    try {
      await this.emailVerificationService.sendVerificationEmail(savedUser.id, savedUser.email);
    } catch (error) {
      // Don't fail registration if email fails, user can resend later.
    }

    this.auditLogsService
      .logCustom(
        'STAFF_APPLICATION_SUBMITTED',
        'StaffApplication',
        staffApplication.id,
        {
          applicationId: staffApplication.id,
          userId: savedUser.id,
          email: savedUser.email,
          cvStorageKey: staffApplication.cvStorageKey,
          documentType: staffApplication.documentType,
          submittedAt: staffApplication.createdAt,
        },
        undefined,
        savedUser.id,
      )
      .catch(() => {});

    this.auditLogsService
      .logRegistration(savedUser.id, {
        role: savedUser.role,
        email: savedUser.email,
        ipAddress,
        userAgent,
        domainCount: 0,
        skillCount: 0,
      })
      .catch(() => {});

    savedUser.profile = profile;
    savedUser.staffApplication = staffApplication;

    return this.mapToAuthResponse(savedUser);
  }

  private normalizeCustomEntries(values?: string[]): string[] {
    if (!values || values.length === 0) {
      return [];
    }

    const unique = new Map<string, string>();
    for (const rawValue of values) {
      const trimmed = String(rawValue || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!trimmed) {
        continue;
      }

      const normalizedKey = trimmed.toLowerCase();
      if (!unique.has(normalizedKey)) {
        unique.set(normalizedKey, trimmed.slice(0, 100));
      }
    }

    return [...unique.values()];
  }

  private parseTaggedSelections(values: string[] | undefined, prefix: string): {
    ids: string[];
    custom: string[];
  } {
    if (!values || values.length === 0) {
      return { ids: [], custom: [] };
    }

    const ids: string[] = [];
    const custom: string[] = [];

    for (const rawValue of values) {
      const value = String(rawValue || '').trim();
      if (!value) {
        continue;
      }

      if (value.startsWith(prefix)) {
        const label = value.slice(prefix.length).trim();
        if (label) {
          custom.push(label);
        }
        continue;
      }

      ids.push(value);
    }

    return { ids, custom };
  }

  private toSafeSlug(value: string, fallbackPrefix: string): string {
    const normalized = String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    const suffix = randomUUID().slice(0, 8);
    return `${normalized || fallbackPrefix}-${suffix}`;
  }

  private validateStaffRegistrationFiles(files: StaffRegistrationFiles): void {
    const cv = files.cv;
    if (!cv) {
      throw new BadRequestException('CV is required');
    }

    const allowedCvMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedCvMimeTypes.includes(cv.mimetype)) {
      throw new BadRequestException('Only PDF and DOCX files are allowed');
    }

    const maxCvSize = 5 * 1024 * 1024;
    if (cv.size > maxCvSize) {
      throw new BadRequestException('File size must not exceed 5MB');
    }

    const requiredImages: Array<[keyof StaffRegistrationFiles, string]> = [
      ['idCardFront', 'ID card front image is required'],
      ['idCardBack', 'ID card back image is required'],
      ['selfie', 'Selfie image is required'],
    ];

    requiredImages.forEach(([field, message]) => {
      if (!files[field]) {
        throw new BadRequestException(message);
      }
    });

    requiredImages.forEach(([field]) => {
      const file = files[field];
      if (file && !file.mimetype.startsWith('image/')) {
        throw new BadRequestException(`Only image files are allowed for ${field}`);
      }
    });
  }

  private async validateStaffRecaptcha(recaptchaToken?: string): Promise<void> {
    const captchaEnabled = this.configService.get<string>('RECAPTCHA_ENABLED') === 'true';
    if (!captchaEnabled) {
      return;
    }

    if (!recaptchaToken) {
      throw new BadRequestException('Vui lòng hoàn thành reCAPTCHA');
    }

    if (!this.captchaService) {
      throw new BadRequestException('reCAPTCHA verification is currently unavailable');
    }

    const isValid = await this.captchaService.verifyRecaptcha(recaptchaToken);
    if (!isValid) {
      throw new BadRequestException('reCAPTCHA verification failed. Please try again.');
    }
  }

  private async uploadStaffCv(userId: string, file: MulterFile): Promise<UploadedCvAsset> {
    try {
      const extension =
        path.extname(file.originalname) ||
        (file.mimetype === 'application/pdf' ? '.pdf' : '.docx');
      const filename = `cv-${Date.now()}-${randomUUID().slice(0, 8)}${extension}`;
      const storageKey = `cvs/${userId}/${filename}`;

      const { error } = await supabaseClient.storage.from('cvs').upload(storageKey, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false,
      });

      if (error) {
        throw new Error(error.message);
      }

      const { data: urlData } = supabaseClient.storage.from('cvs').getPublicUrl(storageKey);

      return {
        storageKey,
        publicUrl: urlData.publicUrl,
      };
    } catch (error) {
      this.logger.error(
        `Failed to upload staff CV for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new BadRequestException('Failed to upload CV');
    }
  }

  private limitLength(value: string | undefined | null, maxLength: number): string | null {
    if (!value) {
      return null;
    }

    return value.slice(0, maxLength);
  }

  async login(
    loginDto: LoginDto,
    userAgent?: string,
    ipAddress?: string,
    timeZone?: string,
  ): Promise<LoginResponseDto> {
    const { email, password } = loginDto;
    const normalizedEmail = normalizeAuthEmail(email);

    // Find the user by email together with the profile relation.
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
      relations: ['profile', 'staffApplication'],
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

    // Create JWT tokens.
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = randomBytes(64).toString('hex');

    // Store the auth session together with device information.
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
        // Scan active user sessions and compare the refresh token with bcrypt.
        const userSessions = await this.authSessionRepository.find({
          where: { userId, isRevoked: false },
        });

        // Compare the refresh token against each session hash.
        for (const session of userSessions) {
          const isMatch = await bcrypt.compare(refreshToken, session.refreshTokenHash);
          if (isMatch) {
            if (!session.refreshTokenFingerprint) {
              await this.authSessionRepository.update(
                { id: session.id },
                { refreshTokenFingerprint },
              );
            }

            // Revoke the matched session.
            await this.authSessionRepository.update(
              { id: session.id },
              { isRevoked: true, revokedAt: new Date() },
            );
            break;
          }
        }
      }
    } else {
      // Revoke all active sessions for this user.
      await this.authSessionRepository.update(
        { userId, isRevoked: false },
        { isRevoked: true, revokedAt: new Date() },
      );
    }

    return {
      message: 'Logout successful',
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
    // Revoke sessions for the same device only; do not revoke every session.
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

    // Clean up expired sessions for this user.
    await this.cleanupExpiredSessions(userId);

    // Hash the refresh token with a lower cost suitable for session storage.
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const refreshTokenFingerprint = this.buildRefreshTokenFingerprint(refreshToken);

    // Create a new session with device metadata.
    const authSession = this.authSessionRepository.create({
      userId,
      refreshTokenHash,
      refreshTokenFingerprint,
      userAgent: userAgent || 'Unknown Device',
      ipAddress: ipAddress || 'Unknown IP',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      isRevoked: false,
      lastUsedAt: new Date(),
    });

    await this.authSessionRepository.save(authSession);
  }

  /**
   * Clean up expired sessions and cap the number of active sessions per user.
   */
  private async cleanupExpiredSessions(userId: string): Promise<void> {
    // Delete expired sessions.
    await this.authSessionRepository.delete({
      userId,
      expiresAt: LessThan(new Date()),
    });

    // Limit each user to at most 5 active sessions.
    const activeSessions = await this.authSessionRepository.find({
      where: {
        userId,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    // If there are more than 5 sessions, revoke the oldest ones.
    if (activeSessions.length >= 5) {
      const sessionsToRevoke = activeSessions.slice(4); // Keep the 4 newest sessions.

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
    const normalizedEmail = normalizeAuthEmail(email);

    // 1. Find user by email
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    // Reject non-existent, deleted, or banned accounts immediately
    if (!user || user.status === UserStatus.DELETED || user.isBanned) {
      this.logger.warn(`ForgotPassword: User not found or inactive for email=${normalizedEmail}`);
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
      await this.emailService.sendOTP(user.email, otp);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`ForgotPassword: Failed to send OTP to ${user.email}: ${errorMessage}`);
      // Continue execution even if email fails - user can resend or check logs
    }

    return {
      message: 'OTP code has been sent to your email',
      email: this.emailService.maskEmail(user.email),
      expiresIn: 300, // 5 minutes in seconds
    };
  }

  /**
   * Verify OTP (optional endpoint to check OTP before resetting password)
   */
  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<VerifyOtpResponseDto> {
    const { email, otp } = verifyOtpDto;
    const normalizedEmail = normalizeAuthEmail(email);

    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
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
    const normalizedEmail = normalizeAuthEmail(email);

    // 1. Validate password confirmation
    if (newPassword !== confirmPassword) {
      throw new UnauthorizedException('Password confirmation does not match');
    }

    // 2. Find the user by email.
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
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

    // 6. Update the password and clear the OTP fields.
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
      throw new ConflictException('Email already in use');
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
      relations: ['profile', 'staffApplication'],
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
    // Update core user information.
    const updateUserData: Partial<UserEntity> = {};
    if (updateProfileDto.fullName) updateUserData.fullName = updateProfileDto.fullName;
    if (updateProfileDto.phoneNumber) updateUserData.phoneNumber = updateProfileDto.phoneNumber;
    if (updateProfileDto.timeZone) updateUserData.timeZone = updateProfileDto.timeZone;

    if (Object.keys(updateUserData).length > 0) {
      await this.userRepository.update({ id: userId }, updateUserData);
    }

    // Find or create the profile record.
    let profile = await this.profileRepository.findOne({ where: { userId } });

    if (!profile) {
      const initialBankInfo =
        updateProfileDto.certifications !== undefined
          ? { certifications: updateProfileDto.certifications }
          : undefined;

      // Create a new profile if one does not exist.
      profile = this.profileRepository.create({
        userId,
        avatarUrl: updateProfileDto.avatarUrl,
        bio: updateProfileDto.bio,
        companyName: updateProfileDto.companyName,
        skills: updateProfileDto.skills,
        portfolioLinks: updateProfileDto.portfolioLinks,
        linkedinUrl: updateProfileDto.linkedinUrl,
        cvUrl: updateProfileDto.cvUrl,
        bankInfo: initialBankInfo,
      });
      await this.profileRepository.save(profile);
    } else {
      // Update the existing profile.
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
      if (updateProfileDto.certifications !== undefined) {
        const existingBankInfo =
          profile.bankInfo && typeof profile.bankInfo === 'object' ? profile.bankInfo : {};
        updateProfileData.bankInfo = {
          ...existingBankInfo,
          certifications: updateProfileDto.certifications,
        };
      }

      if (Object.keys(updateProfileData).length > 0) {
        await this.profileRepository.update({ userId }, updateProfileData);
      }
    }

    // Reload the user together with the profile.
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

    if (user.role === UserRole.ADMIN || user.role === UserRole.STAFF) {
      throw new BadRequestException('Admin and staff accounts cannot be self-deleted');
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
    const certifications = this.extractCertifications(user.profile?.bankInfo);
    const staffApprovalStatus = this.resolveStaffApprovalStatus(user);

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
      ...(certifications !== undefined ? { certifications } : {}),
      role: user.role,
      isVerified: user.isVerified,
      isEmailVerified: !!user.emailVerifiedAt,
      ...(staffApprovalStatus
        ? {
            staffApprovalStatus,
            staffApplicationReviewedAt: user.staffApplication?.reviewedAt ?? null,
            staffRejectionReason: user.staffApplication?.rejectionReason ?? null,
          }
        : {}),
      currentTrustScore: user.currentTrustScore,
      badge: user.badge, // Virtual property exposed by the entity.
      stats: user.stats, // Virtual property exposed by the entity.
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private resolveStaffApprovalStatus(user: UserEntity): StaffApplicationStatus | undefined {
    if (user.role !== UserRole.STAFF) {
      return undefined;
    }

    if (user.staffApplication?.status) {
      return user.staffApplication.status;
    }

    return user.isVerified
      ? StaffApplicationStatus.APPROVED
      : StaffApplicationStatus.PENDING;
  }

  private extractCertifications(bankInfo?: Record<string, any> | null) {
    if (!bankInfo || typeof bankInfo !== 'object' || !Array.isArray(bankInfo.certifications)) {
      return undefined;
    }

    return bankInfo.certifications;
  }
}
