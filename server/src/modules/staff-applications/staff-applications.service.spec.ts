import { ForbiddenException } from '@nestjs/common';
import {
  StaffApplicationStatus,
} from '../../database/entities/staff-application.entity';
import { UserRole } from '../../database/entities/user.entity';
import { StaffApplicationsService } from './staff-applications.service';

jest.mock('../../config/supabase.config', () => ({
  supabaseClient: {
    storage: {
      from: jest.fn(() => ({
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://files.example.com/cv.pdf' },
          error: null,
        }),
        getPublicUrl: jest.fn(() => ({
          data: { publicUrl: 'https://files.example.com/cv.pdf' },
        })),
      })),
    },
  },
}));

jest.mock('../../common/utils/supabase-storage.util', () => ({
  downloadWithWatermark: jest.fn().mockResolvedValue(Buffer.from('watermarked-image')),
}));

const createRepositoryMock = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('StaffApplicationsService', () => {
  let service: StaffApplicationsService;
  let staffApplicationRepository: ReturnType<typeof createRepositoryMock>;
  let userRepository: ReturnType<typeof createRepositoryMock>;
  let auditLogsService: { logCustom: jest.Mock };
  let staffApplicationsGateway: { emitApplicationUpdated: jest.Mock };
  let emailService: { sendPlatformNotification: jest.Mock };

  beforeEach(() => {
    staffApplicationRepository = createRepositoryMock();
    userRepository = createRepositoryMock();
    auditLogsService = {
      logCustom: jest.fn().mockResolvedValue(undefined),
    };
    staffApplicationsGateway = {
      emitApplicationUpdated: jest.fn(),
    };
    emailService = {
      sendPlatformNotification: jest.fn().mockResolvedValue(undefined),
    };

    service = new StaffApplicationsService(
      staffApplicationRepository as any,
      userRepository as any,
      auditLogsService as any,
      staffApplicationsGateway as any,
      emailService as any,
    );
  });

  it('returns a synthetic approved application summary for legacy verified staff accounts without an application row', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'staff-1',
      email: 'staff@example.com',
      fullName: 'Legacy Staff',
      phoneNumber: '0987654321',
      role: UserRole.STAFF,
      isVerified: true,
      emailVerifiedAt: new Date('2026-04-01T00:00:00.000Z'),
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      staffApplication: null,
      profile: {
        cvUrl: 'https://files.example.com/cv.pdf',
      },
    });

    const result = await service.getMyApplication('staff-1');

    expect(result).toEqual(
      expect.objectContaining({
        id: null,
        status: StaffApplicationStatus.APPROVED,
        submissionSummary: expect.objectContaining({
          documentType: null,
          maskedDocumentNumber: null,
          hasCv: true,
          hasKyc: false,
        }),
        user: expect.objectContaining({
          id: 'staff-1',
          email: 'staff@example.com',
          isVerified: true,
          isEmailVerified: true,
        }),
      }),
    );
  });

  it('rejects getMyApplication for non-staff accounts', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      role: UserRole.CLIENT,
      staffApplication: null,
    });

    await expect(service.getMyApplication('user-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists staff applications without applying a status filter when the query omits it', async () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 1]),
    };
    staffApplicationRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.getAllApplications({
      page: 1,
      limit: 20,
      search: '',
    } as any);

    expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
      'application.status = :status',
      expect.anything(),
    );
    expect(result).toEqual({
      items: [],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });

  it('returns admin review assets with signed CV URL and watermarked previews', async () => {
    staffApplicationRepository.findOne.mockResolvedValue({
      id: 'application-1',
      userId: 'staff-1',
      status: StaffApplicationStatus.PENDING,
      cvStorageKey: 'cvs/staff-1/cv.pdf',
      cvOriginalFilename: 'resume.pdf',
      cvMimeType: 'application/pdf',
      cvSize: 1024,
      fullNameOnDocument: 'Legacy Staff',
      documentType: 'CCCD',
      documentNumber: '0123456789',
      dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
      address: '123 Example Street',
      idCardFrontStorageKey: 'kyc/staff-1/id-front.jpg.encrypted',
      idCardBackStorageKey: 'kyc/staff-1/id-back.jpg.encrypted',
      selfieStorageKey: 'kyc/staff-1/selfie.jpg.encrypted',
    });

    const result = await service.getApplicationReviewAssets('application-1', {
      reviewerId: 'admin-1',
      reviewerEmail: 'admin@example.com',
      reviewerRole: 'ADMIN',
      ipAddress: '203.0.113.10',
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'application-1',
        cv: expect.objectContaining({
          url: 'https://files.example.com/cv.pdf',
          originalFilename: 'resume.pdf',
        }),
        manualKyc: expect.objectContaining({
          documentType: 'CCCD',
          documentNumber: '0123456789',
        }),
        previews: expect.objectContaining({
          idCardFrontUrl: expect.stringContaining('data:image/jpeg;base64,'),
          idCardBackUrl: expect.stringContaining('data:image/jpeg;base64,'),
          selfieUrl: expect.stringContaining('data:image/jpeg;base64,'),
        }),
      }),
    );
    expect(auditLogsService.logCustom).toHaveBeenCalledWith(
      'STAFF_APPLICATION_REVIEW_ASSETS_VIEWED',
      'StaffApplication',
      'application-1',
      expect.objectContaining({
        applicationId: 'application-1',
        reviewerId: 'admin-1',
      }),
      undefined,
      'admin-1',
    );
  });

  it('approves a pending staff application, verifies the user, and records an audit log', async () => {
    staffApplicationRepository.findOne.mockResolvedValue({
      id: 'application-1',
      userId: 'staff-1',
      status: StaffApplicationStatus.PENDING,
      user: {
        id: 'staff-1',
        email: 'staff@example.com',
        fullName: 'Approved Staff',
      },
    });
    staffApplicationRepository.save.mockImplementation(async (entity: any) => entity);
    userRepository.update.mockResolvedValue({ affected: 1 });
    jest.spyOn(service, 'getApplicationById').mockResolvedValue({
      id: 'application-1',
      status: StaffApplicationStatus.APPROVED,
      reviewedAt: '2026-04-13T00:00:00.000Z',
      rejectionReason: null,
    } as any);

    const result = await service.approveApplication('application-1', 'admin-1');

    expect(staffApplicationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'application-1',
        status: StaffApplicationStatus.APPROVED,
        reviewedBy: 'admin-1',
        reviewedAt: expect.any(Date),
        rejectionReason: null,
      }),
    );
    expect(userRepository.update).toHaveBeenCalledWith('staff-1', { isVerified: true });
    expect(staffApplicationsGateway.emitApplicationUpdated).toHaveBeenCalledWith('staff-1', {
      applicationId: 'application-1',
      status: StaffApplicationStatus.APPROVED,
      reviewedAt: '2026-04-13T00:00:00.000Z',
      rejectionReason: null,
    });
    expect(emailService.sendPlatformNotification).toHaveBeenCalledWith({
      email: 'staff@example.com',
      subject: 'Your staff application has been approved',
      title: 'Staff application approved',
      body: expect.stringContaining('https://localhost:5173/login'),
    });
    expect(result).toEqual({
      id: 'application-1',
      status: StaffApplicationStatus.APPROVED,
      reviewedAt: '2026-04-13T00:00:00.000Z',
      rejectionReason: null,
    });
  });

  it('rejects a pending staff application, keeps the account unverified, and stores the rejection reason', async () => {
    staffApplicationRepository.findOne.mockResolvedValue({
      id: 'application-2',
      userId: 'staff-2',
      status: StaffApplicationStatus.PENDING,
      user: {
        id: 'staff-2',
      },
    });
    staffApplicationRepository.save.mockImplementation(async (entity: any) => entity);
    userRepository.update.mockResolvedValue({ affected: 1 });
    jest.spyOn(service, 'getApplicationById').mockResolvedValue({
      id: 'application-2',
      status: StaffApplicationStatus.REJECTED,
      reviewedAt: '2026-04-13T00:00:00.000Z',
      rejectionReason: 'Need more relevant experience',
    } as any);

    const result = await service.rejectApplication('application-2', 'admin-1', {
      rejectionReason: 'Need more relevant experience',
    });

    expect(userRepository.update).toHaveBeenCalledWith('staff-2', { isVerified: false });
    expect(staffApplicationsGateway.emitApplicationUpdated).toHaveBeenCalledWith('staff-2', {
      applicationId: 'application-2',
      status: StaffApplicationStatus.REJECTED,
      reviewedAt: '2026-04-13T00:00:00.000Z',
      rejectionReason: 'Need more relevant experience',
    });
    expect(emailService.sendPlatformNotification).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: 'application-2',
      status: StaffApplicationStatus.REJECTED,
      reviewedAt: '2026-04-13T00:00:00.000Z',
      rejectionReason: 'Need more relevant experience',
    });
  });

  it('keeps the approval successful when sending the staff approval email fails', async () => {
    staffApplicationRepository.findOne.mockResolvedValue({
      id: 'application-3',
      userId: 'staff-3',
      status: StaffApplicationStatus.PENDING,
      user: {
        id: 'staff-3',
        email: 'staff3@example.com',
        fullName: 'Mail Failure Staff',
      },
    });
    staffApplicationRepository.save.mockImplementation(async (entity: any) => entity);
    userRepository.update.mockResolvedValue({ affected: 1 });
    emailService.sendPlatformNotification.mockRejectedValueOnce(new Error('SMTP down'));
    jest.spyOn(service, 'getApplicationById').mockResolvedValue({
      id: 'application-3',
      status: StaffApplicationStatus.APPROVED,
      reviewedAt: '2026-04-13T01:00:00.000Z',
      rejectionReason: null,
    } as any);
    const loggerErrorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

    const result = await service.approveApplication('application-3', 'admin-1');

    expect(userRepository.update).toHaveBeenCalledWith('staff-3', { isVerified: true });
    expect(emailService.sendPlatformNotification).toHaveBeenCalledWith({
      email: 'staff3@example.com',
      subject: 'Your staff application has been approved',
      title: 'Staff application approved',
      body: expect.stringContaining('https://localhost:5173/login'),
    });
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send staff approval email'),
      expect.any(String),
    );
    expect(result).toEqual({
      id: 'application-3',
      status: StaffApplicationStatus.APPROVED,
      reviewedAt: '2026-04-13T01:00:00.000Z',
      rejectionReason: null,
    });
  });
});
