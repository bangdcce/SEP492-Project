import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { DocumentType, KycStatus } from '../../database/entities/kyc-verification.entity';
import { UserRole } from '../../database/entities/user.entity';
import { KycService } from './kyc.service';

jest.mock('../../common/utils/supabase-storage.util', () => ({
  uploadEncryptedFile: jest.fn(),
  getSignedUrl: jest.fn(),
  downloadWithWatermark: jest.fn(),
}));

jest.mock('../../common/utils/encryption.util', () => ({
  hashDocumentNumber: jest.fn(),
}));

import {
  uploadEncryptedFile,
  getSignedUrl,
} from '../../common/utils/supabase-storage.util';
import { hashDocumentNumber } from '../../common/utils/encryption.util';

const mockedUploadEncryptedFile = uploadEncryptedFile as jest.MockedFunction<
  typeof uploadEncryptedFile
>;
const mockedGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;
const mockedHashDocumentNumber = hashDocumentNumber as jest.MockedFunction<typeof hashDocumentNumber>;

const createRepositoryMock = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data) => ({ ...data })),
  save: jest.fn(),
  update: jest.fn(),
});

describe('KycService', () => {
  let service: KycService;
  let kycRepo: ReturnType<typeof createRepositoryMock>;
  let userRepo: ReturnType<typeof createRepositoryMock>;
  let auditLogRepo: ReturnType<typeof createRepositoryMock>;
  let fptAiService: { verifyKyc: jest.Mock };

  const fixedNow = new Date('2026-04-02T03:00:00.000Z');

  const dto = {
    fullNameOnDocument: 'Nguyen Gia Bao',
    documentNumber: '001234567890',
    documentType: DocumentType.CCCD,
    dateOfBirth: '1999-01-01',
    documentExpiryDate: '2035-01-01',
    address: '123 Nguyen Trai, Ho Chi Minh City',
  };

  const files = {
    idCardFront: {
      buffer: Buffer.from('front'),
      mimetype: 'image/jpeg',
    },
    idCardBack: {
      buffer: Buffer.from('back'),
      mimetype: 'image/jpeg',
    },
    selfie: {
      buffer: Buffer.from('selfie'),
      mimetype: 'image/jpeg',
    },
  };

  beforeEach(() => {
    kycRepo = createRepositoryMock();
    userRepo = createRepositoryMock();
    auditLogRepo = createRepositoryMock();
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      role: UserRole.CLIENT,
    });
    fptAiService = {
      verifyKyc: jest.fn().mockResolvedValue({
        decision: 'AUTO_APPROVED',
        confidence: 0.99,
        extractedData: {
          fullName: 'Nguyen Gia Bao',
          idNumber: '001234567890',
          dateOfBirth: '1999-01-01',
          address: '123 Nguyen Trai, Ho Chi Minh City',
        },
        issues: [],
      }),
    };

    mockedUploadEncryptedFile.mockReset();
    mockedUploadEncryptedFile
      .mockResolvedValueOnce('secure/front')
      .mockResolvedValueOnce('secure/back')
      .mockResolvedValueOnce('secure/selfie');

    mockedGetSignedUrl.mockReset();
    mockedGetSignedUrl.mockImplementation(async (path: string) => `signed:${path}`);

    mockedHashDocumentNumber.mockReset();
    mockedHashDocumentNumber.mockImplementation((value: string) => `hash:${value}`);

    kycRepo.save.mockImplementation(async (entity: any) => {
      if (Array.isArray(entity)) {
        return entity;
      }

      return {
        id: entity.id ?? 'kyc-new',
        createdAt: fixedNow,
        updatedAt: fixedNow,
        ...entity,
      };
    });

    service = new KycService(
      kycRepo as any,
      userRepo as any,
      auditLogRepo as any,
      fptAiService as any,
    );
  });

  it('rejects a new submission when the latest KYC is still pending', async () => {
    kycRepo.findOne.mockResolvedValueOnce({
      id: 'kyc-pending',
      userId: 'user-1',
      status: KycStatus.PENDING,
      createdAt: fixedNow,
    });

    await expect(service.submitKyc('user-1', dto as any, files as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fptAiService.verifyKyc).not.toHaveBeenCalled();
  });

  it('rejects self-KYC submissions from staff accounts', async () => {
    userRepo.findOne.mockResolvedValueOnce({
      id: 'user-1',
      role: UserRole.STAFF,
    });

    await expect(service.submitKyc('user-1', dto as any, files as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(kycRepo.findOne).not.toHaveBeenCalled();
    expect(fptAiService.verifyKyc).not.toHaveBeenCalled();
  });

  it('allows users with an approved KYC to submit an updated verification and expires the old approval when auto-approved', async () => {
    const existingApproved = {
      id: 'kyc-approved',
      userId: 'user-1',
      status: KycStatus.APPROVED,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
    };

    kycRepo.findOne.mockResolvedValueOnce(existingApproved);
    kycRepo.find.mockResolvedValueOnce([
      existingApproved,
      {
        id: 'kyc-new',
        userId: 'user-1',
        status: KycStatus.APPROVED,
        createdAt: fixedNow,
      },
    ]);

    const result = await service.submitKyc('user-1', dto as any, files as any);

    expect(result).toEqual(
      expect.objectContaining({
        id: 'kyc-new',
        status: KycStatus.APPROVED,
        isResubmission: true,
        replacesApprovedKycId: 'kyc-approved',
      }),
    );
    expect(kycRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'kyc-approved',
          status: KycStatus.EXPIRED,
        }),
      ]),
    );
    expect(userRepo.update).toHaveBeenCalledWith('user-1', { isVerified: true });
  });

  it('returns the current approved KYC while a newer update is pending review', async () => {
    const pendingUpdate = {
      id: 'kyc-update',
      userId: 'user-1',
      status: KycStatus.PENDING,
      documentType: DocumentType.CCCD,
      documentFrontUrl: 'secure/update-front',
      documentBackUrl: 'secure/update-back',
      selfieUrl: 'secure/update-selfie',
      fullNameOnDocument: 'Nguyen Gia Bao',
      documentNumber: 'hash:001234567890',
      dateOfBirth: new Date('1999-01-01'),
      address: '123 Nguyen Trai',
      rejectionReason: undefined,
      createdAt: fixedNow,
      updatedAt: fixedNow,
      reviewedAt: null,
    };
    const approvedKyc = {
      id: 'kyc-approved',
      userId: 'user-1',
      status: KycStatus.APPROVED,
      documentType: DocumentType.CCCD,
      documentFrontUrl: 'secure/front',
      documentBackUrl: 'secure/back',
      selfieUrl: 'secure/selfie',
      fullNameOnDocument: 'Nguyen Gia Bao',
      documentNumber: 'hash:001234567890',
      dateOfBirth: new Date('1999-01-01'),
      address: '123 Nguyen Trai',
      rejectionReason: undefined,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      reviewedAt: new Date('2026-03-02T00:00:00.000Z'),
    };

    kycRepo.findOne
      .mockResolvedValueOnce(pendingUpdate)
      .mockResolvedValueOnce(approvedKyc);

    const result = await service.getMyKyc('user-1');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'kyc-approved',
        status: KycStatus.APPROVED,
        latestSubmissionStatus: KycStatus.PENDING,
        hasPendingUpdate: true,
        updateSubmittedAt: fixedNow,
      }),
    );
    expect(result.documentFrontUrl).toBe('signed:secure/front');
  });

  it('expires older approved records when an admin approves a newer pending submission', async () => {
    const pendingKyc = {
      id: 'kyc-pending',
      userId: 'user-1',
      status: KycStatus.PENDING,
      reviewedBy: null,
      reviewedAt: null,
    };
    const previousApproved = {
      id: 'kyc-approved',
      userId: 'user-1',
      status: KycStatus.APPROVED,
      reviewedBy: 'admin-old',
      reviewedAt: new Date('2026-03-02T00:00:00.000Z'),
    };

    kycRepo.findOne.mockResolvedValueOnce(pendingKyc);
    kycRepo.find.mockResolvedValueOnce([
      {
        id: 'kyc-pending',
        userId: 'user-1',
        status: KycStatus.APPROVED,
      },
      previousApproved,
    ]);

    const result = await service.approveKyc('kyc-pending', 'admin-1');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'kyc-pending',
        status: KycStatus.APPROVED,
        reviewedBy: 'admin-1',
      }),
    );
    expect(kycRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'kyc-approved',
          status: KycStatus.EXPIRED,
        }),
      ]),
    );
    expect(userRepo.update).toHaveBeenCalledWith('user-1', { isVerified: true });
  });
});
