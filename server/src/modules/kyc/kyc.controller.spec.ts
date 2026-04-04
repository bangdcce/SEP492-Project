import { BadRequestException, NotFoundException } from '@nestjs/common';

import { DocumentType, KycStatus } from '../../database/entities/kyc-verification.entity';
import { KycController } from './kyc.controller';

describe('KycController.submitKyc', () => {
  let controller: KycController;
  let kycService: { submitKyc: jest.Mock; getMyKyc: jest.Mock };

  const dto = {
    fullNameOnDocument: 'Nguyen Gia Bao',
    documentNumber: '001234567890',
    documentType: DocumentType.CCCD,
    dateOfBirth: '1999-01-01',
    documentExpiryDate: '2035-01-01',
    address: '123 Nguyen Trai, Ho Chi Minh City',
  };

  beforeEach(() => {
    kycService = {
      submitKyc: jest.fn().mockResolvedValue({
        id: 'kyc-1',
        status: KycStatus.PENDING,
      }),
      getMyKyc: jest.fn(),
    };

    controller = new KycController(kycService as any);
  });

  it('extracts single files from upload arrays and forwards them to the service', async () => {
    const files = {
      idCardFront: [
        { originalname: 'front.jpg', buffer: Buffer.from('front'), mimetype: 'image/jpeg' },
      ],
      idCardBack: [
        { originalname: 'back.jpg', buffer: Buffer.from('back'), mimetype: 'image/jpeg' },
      ],
      selfie: [{ originalname: 'selfie.jpg', buffer: Buffer.from('selfie'), mimetype: 'image/jpeg' }],
    };

    const result = await controller.submitKyc('user-1', dto as any, files as any);

    expect(kycService.submitKyc).toHaveBeenCalledWith(
      'user-1',
      dto,
      expect.objectContaining({
        idCardFront: files.idCardFront[0],
        idCardBack: files.idCardBack[0],
        selfie: files.selfie[0],
      }),
    );
    expect(result).toEqual({
      id: 'kyc-1',
      status: KycStatus.PENDING,
    });
  });

  it('forwards undefined file values when upload arrays are missing', async () => {
    await controller.submitKyc('user-1', dto as any, {} as any);

    expect(kycService.submitKyc).toHaveBeenCalledWith(
      'user-1',
      dto,
      expect.objectContaining({
        idCardFront: undefined,
        idCardBack: undefined,
        selfie: undefined,
      }),
    );
  });

  it('rethrows service errors for incomplete KYC document submissions', async () => {
    kycService.submitKyc.mockRejectedValueOnce(
      new BadRequestException('All documents are required: ID card front, back, and selfie'),
    );

    await expect(controller.submitKyc('user-1', dto as any, {} as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('KycController.getMyKyc', () => {
  let controller: KycController;
  let kycService: { submitKyc: jest.Mock; getMyKyc: jest.Mock };

  beforeEach(() => {
    kycService = {
      submitKyc: jest.fn(),
      getMyKyc: jest.fn().mockResolvedValue({
        hasSubmission: true,
        status: KycStatus.PENDING,
      }),
    };

    controller = new KycController(kycService as any);
  });

  it('forwards the authenticated user id and returns the current KYC submission', async () => {
    const result = await controller.getMyKyc('user-1');

    expect(kycService.getMyKyc).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      hasSubmission: true,
      status: KycStatus.PENDING,
    });
  });

  it('returns the empty-state payload when the user has not submitted KYC yet', async () => {
    kycService.getMyKyc.mockResolvedValueOnce({
      hasSubmission: false,
      message: 'You have not submitted KYC verification yet',
    });

    const result = await controller.getMyKyc('user-2');

    expect(result).toEqual({
      hasSubmission: false,
      message: 'You have not submitted KYC verification yet',
    });
  });

  it('rethrows not-found errors from the service layer', async () => {
    kycService.getMyKyc.mockRejectedValueOnce(new NotFoundException('KYC record not found'));

    await expect(controller.getMyKyc('missing-user')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('KycController.getAllKyc', () => {
  let controller: KycController;
  let kycService: {
    getAllKyc: jest.Mock;
  };

  beforeEach(() => {
    kycService = {
      getAllKyc: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      }),
    };

    controller = new KycController(kycService as any);
  });

  it('forwards status and pagination filters to the service', async () => {
    const result = await controller.getAllKyc(KycStatus.PENDING, 2, 10);

    expect(kycService.getAllKyc).toHaveBeenCalledWith(KycStatus.PENDING, 2, 10);
    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });
  });

  it('forwards undefined filters when query parameters are omitted', async () => {
    await controller.getAllKyc(undefined, undefined, undefined);

    expect(kycService.getAllKyc).toHaveBeenCalledWith(undefined, undefined, undefined);
  });

  it('rethrows service errors for invalid admin KYC queries', async () => {
    kycService.getAllKyc.mockRejectedValueOnce(new BadRequestException('Invalid status filter'));

    await expect(controller.getAllKyc('INVALID' as any, 1, 20)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('KycController.getKycById', () => {
  let controller: KycController;
  let kycService: {
    getKycById: jest.Mock;
  };

  beforeEach(() => {
    kycService = {
      getKycById: jest.fn().mockResolvedValue({
        id: 'kyc-1',
        status: KycStatus.PENDING,
      }),
    };

    controller = new KycController(kycService as any);
  });

  it('forwards the KYC id to the service and returns the detail payload', async () => {
    const result = await controller.getKycById('kyc-1');

    expect(kycService.getKycById).toHaveBeenCalledWith('kyc-1');
    expect(result).toEqual({
      id: 'kyc-1',
      status: KycStatus.PENDING,
    });
  });

  it('rethrows not-found errors when the KYC record does not exist', async () => {
    kycService.getKycById.mockRejectedValueOnce(
      new NotFoundException('KYC verification not found'),
    );

    await expect(controller.getKycById('missing-kyc')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('KycController.getKycByIdWithWatermark', () => {
  let controller: KycController;
  let kycService: {
    getKycByIdWithWatermark: jest.Mock;
  };

  beforeEach(() => {
    kycService = {
      getKycByIdWithWatermark: jest.fn().mockResolvedValue({
        id: 'kyc-1',
        watermarkInfo: {
          watermarkId: 'wm-1',
        },
      }),
    };

    controller = new KycController(kycService as any);
  });

  it('forwards reviewer metadata, request metadata, and reason fields to the service', async () => {
    const result = await controller.getKycByIdWithWatermark(
      'kyc-1',
      {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'ADMIN',
      },
      {
        ip: '203.0.113.10',
        headers: {
          'user-agent': 'Mozilla/5.0',
          'x-request-id': 'request-123',
        },
      },
      'MANUAL_REVIEW',
      'Suspicious document details',
    );

    expect(kycService.getKycByIdWithWatermark).toHaveBeenCalledWith(
      'kyc-1',
      'admin-1',
      'admin@example.com',
      'ADMIN',
      '203.0.113.10',
      'request-123',
      'Mozilla/5.0',
      'MANUAL_REVIEW',
      'Suspicious document details',
    );
    expect(result).toEqual({
      id: 'kyc-1',
      watermarkInfo: {
        watermarkId: 'wm-1',
      },
    });
  });

  it('falls back to Unknown IP, Unknown Device, and generated session id when request metadata is missing', async () => {
    const result = await controller.getKycByIdWithWatermark(
      'kyc-1',
      {
        id: 'staff-1',
        email: 'staff@example.com',
        role: 'STAFF',
      },
      {
        headers: {},
        connection: {},
      },
      undefined,
      undefined,
    );

    expect(kycService.getKycByIdWithWatermark).toHaveBeenCalledWith(
      'kyc-1',
      'staff-1',
      'staff@example.com',
      'STAFF',
      'Unknown IP',
      expect.stringMatching(/^staff-1-/),
      'Unknown Device',
      undefined,
      undefined,
    );
    expect(result).toEqual({
      id: 'kyc-1',
      watermarkInfo: {
        watermarkId: 'wm-1',
      },
    });
  });

  it('rethrows not-found errors when the service cannot load the KYC record', async () => {
    kycService.getKycByIdWithWatermark.mockRejectedValueOnce(
      new NotFoundException('KYC verification not found'),
    );

    await expect(
      controller.getKycByIdWithWatermark(
        'missing-kyc',
        {
          id: 'admin-1',
          email: 'admin@example.com',
          role: 'ADMIN',
        },
        {
          ip: '203.0.113.10',
          headers: { 'user-agent': 'Mozilla/5.0' },
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('KycController.approveKyc', () => {
  let controller: KycController;
  let kycService: {
    approveKyc: jest.Mock;
  };

  beforeEach(() => {
    kycService = {
      approveKyc: jest.fn().mockResolvedValue({
        id: 'kyc-1',
        status: KycStatus.APPROVED,
      }),
    };

    controller = new KycController(kycService as any);
  });

  it('forwards the KYC id and admin id to the service and returns the approval payload', async () => {
    const result = await controller.approveKyc('kyc-1', 'admin-1');

    expect(kycService.approveKyc).toHaveBeenCalledWith('kyc-1', 'admin-1');
    expect(result).toEqual({
      id: 'kyc-1',
      status: KycStatus.APPROVED,
    });
  });

  it('rethrows bad-request errors when the KYC record is not pending', async () => {
    kycService.approveKyc.mockRejectedValueOnce(
      new BadRequestException('Only pending KYC can be approved'),
    );

    await expect(controller.approveKyc('kyc-1', 'admin-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rethrows not-found errors when the KYC record does not exist', async () => {
    kycService.approveKyc.mockRejectedValueOnce(
      new NotFoundException('KYC verification not found'),
    );

    await expect(controller.approveKyc('missing-kyc', 'admin-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('KycController.rejectKyc', () => {
  let controller: KycController;
  let kycService: {
    rejectKyc: jest.Mock;
  };

  beforeEach(() => {
    kycService = {
      rejectKyc: jest.fn().mockResolvedValue({
        id: 'kyc-1',
        status: KycStatus.REJECTED,
        rejectionReason: 'Document image is unclear',
      }),
    };

    controller = new KycController(kycService as any);
  });

  it('forwards the KYC id, admin id, and rejection payload to the service', async () => {
    const dto = {
      rejectionReason: 'Document image is unclear',
    };

    const result = await controller.rejectKyc('kyc-1', dto as any, 'admin-1');

    expect(kycService.rejectKyc).toHaveBeenCalledWith('kyc-1', 'admin-1', dto);
    expect(result).toEqual({
      id: 'kyc-1',
      status: KycStatus.REJECTED,
      rejectionReason: 'Document image is unclear',
    });
  });

  it('rethrows bad-request errors when the rejection request is invalid', async () => {
    kycService.rejectKyc.mockRejectedValueOnce(
      new BadRequestException('Only pending KYC can be rejected'),
    );

    await expect(
      controller.rejectKyc('kyc-1', { rejectionReason: 'Duplicate' } as any, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rethrows not-found errors when the KYC record cannot be found', async () => {
    kycService.rejectKyc.mockRejectedValueOnce(
      new NotFoundException('KYC verification not found'),
    );

    await expect(
      controller.rejectKyc('missing-kyc', { rejectionReason: 'Duplicate' } as any, 'admin-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
