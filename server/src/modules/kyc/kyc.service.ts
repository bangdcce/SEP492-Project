import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KycVerificationEntity, KycStatus } from '../../database/entities/kyc-verification.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { SubmitKycDto, RejectKycDto } from './dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class KycService {
  constructor(
    @InjectRepository(KycVerificationEntity)
    private kycRepo: Repository<KycVerificationEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
  ) {}

  /**
   * User submit KYC verification
   */
  async submitKyc(
    userId: string,
    dto: SubmitKycDto,
    files: {
      idCardFront: Express.Multer.File;
      idCardBack: Express.Multer.File;
      selfie: Express.Multer.File;
    },
  ) {
    // Check if user already has pending or approved KYC
    const existingKyc = await this.kycRepo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    if (existingKyc && existingKyc.status === KycStatus.PENDING) {
      throw new BadRequestException('You already have a pending KYC verification');
    }

    if (existingKyc && existingKyc.status === KycStatus.APPROVED) {
      throw new BadRequestException('Your KYC is already verified');
    }

    // Validate files
    if (!files.idCardFront || !files.idCardBack || !files.selfie) {
      throw new BadRequestException('All documents are required: ID card front, back, and selfie');
    }

    // Save files to disk
    const uploadDir = path.join(process.cwd(), 'uploads', 'kyc', userId);
    
    // Create directory if not exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Save files
    const frontPath = path.join(uploadDir, files.idCardFront.originalname);
    const backPath = path.join(uploadDir, files.idCardBack.originalname);
    const selfiePath = path.join(uploadDir, files.selfie.originalname);

    fs.writeFileSync(frontPath, files.idCardFront.buffer);
    fs.writeFileSync(backPath, files.idCardBack.buffer);
    fs.writeFileSync(selfiePath, files.selfie.buffer);

    // Generate URLs
    const documentFrontUrl = `/uploads/kyc/${userId}/${files.idCardFront.originalname}`;
    const documentBackUrl = `/uploads/kyc/${userId}/${files.idCardBack.originalname}`;
    const selfieUrl = `/uploads/kyc/${userId}/${files.selfie.originalname}`;

    // Create KYC record
    const kyc = this.kycRepo.create({
      userId,
      fullNameOnDocument: dto.fullNameOnDocument,
      documentNumber: dto.documentNumber,
      documentType: dto.documentType,
      dateOfBirth: new Date(dto.dateOfBirth),
      documentExpiryDate: dto.documentExpiryDate ? new Date(dto.documentExpiryDate) : null,
      documentFrontUrl,
      documentBackUrl,
      selfieUrl,
      status: KycStatus.PENDING,
    });

    return await this.kycRepo.save(kyc);
  }

  /**
   * Get user's KYC status
   */
  async getMyKyc(userId: string) {
    const kyc = await this.kycRepo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    if (!kyc) {
      return {
        status: 'NOT_STARTED',
        message: 'You have not submitted KYC verification yet',
      };
    }

    return kyc;
  }

  /**
   * Admin: Get all KYC submissions with filters
   */
  async getAllKyc(status?: KycStatus, page = 1, limit = 20) {
    const query = this.kycRepo.createQueryBuilder('kyc')
      .leftJoinAndSelect('kyc.user', 'user')
      .leftJoinAndSelect('kyc.reviewer', 'reviewer');

    if (status) {
      query.where('kyc.status = :status', { status });
    }

    query
      .orderBy('kyc.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await query.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Admin: Get KYC by ID
   */
  async getKycById(id: string) {
    const kyc = await this.kycRepo.findOne({
      where: { id },
      relations: ['user', 'reviewer'],
    });

    if (!kyc) {
      throw new NotFoundException('KYC verification not found');
    }

    return kyc;
  }

  /**
   * Admin: Approve KYC
   */
  async approveKyc(id: string, adminId: string) {
    const kyc = await this.getKycById(id);

    if (kyc.status !== KycStatus.PENDING) {
      throw new BadRequestException('Only pending KYC can be approved');
    }

    kyc.status = KycStatus.APPROVED;
    kyc.reviewedBy = adminId;
    kyc.reviewedAt = new Date();

    await this.kycRepo.save(kyc);

    // Update user's isVerified status
    await this.userRepo.update(kyc.userId, { isVerified: true });

    return kyc;
  }

  /**
   * Admin: Reject KYC
   */
  async rejectKyc(id: string, adminId: string, dto: RejectKycDto) {
    const kyc = await this.getKycById(id);

    if (kyc.status !== KycStatus.PENDING) {
      throw new BadRequestException('Only pending KYC can be rejected');
    }

    kyc.status = KycStatus.REJECTED;
    kyc.rejectionReason = dto.rejectionReason;
    kyc.reviewedBy = adminId;
    kyc.reviewedAt = new Date();

    await this.kycRepo.save(kyc);

    return kyc;
  }

  /**
   * Check if user has verified KYC
   */
  async hasVerifiedKyc(userId: string): Promise<boolean> {
    const kyc = await this.kycRepo.findOne({
      where: { userId, status: KycStatus.APPROVED },
    });

    return !!kyc;
  }
}
