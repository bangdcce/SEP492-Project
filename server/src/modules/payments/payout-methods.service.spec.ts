import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  PayoutMethodEntity,
  PayoutMethodType,
  PayoutRequestEntity,
} from '../../database/entities';
import { PayoutMethodsService } from './payout-methods.service';

describe('PayoutMethodsService', () => {
  let service: PayoutMethodsService;

  const payoutMethodRepository = {
    find: jest.fn(),
  };
  const repoInTransaction = {
    count: jest.fn(),
    update: jest.fn(),
    create: jest.fn((data: Partial<PayoutMethodEntity>) => data),
    save: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
  };
  const payoutRequestRepoInTransaction = {
    count: jest.fn(),
    exist: jest.fn(),
  };
  const payoutRequestQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  const payoutRequestReadRepository = {
    createQueryBuilder: jest.fn(() => payoutRequestQueryBuilder),
  };
  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity === PayoutMethodEntity) return repoInTransaction;
      if (entity === PayoutRequestEntity) return payoutRequestRepoInTransaction;
      throw new Error('Unexpected repository');
    }),
  };
  const dataSource = {
    transaction: jest.fn((callback: (entityManager: typeof manager) => Promise<unknown>) =>
      callback(manager),
    ),
    getRepository: jest.fn((entity) => {
      if (entity === PayoutRequestEntity) {
        return payoutRequestReadRepository;
      }
      throw new Error('Unexpected repository');
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    payoutRequestQueryBuilder.getRawMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutMethodsService,
        {
          provide: getRepositoryToken(PayoutMethodEntity),
          useValue: payoutMethodRepository,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get(PayoutMethodsService);
  });

  it('creates the first PayPal payout method as default', async () => {
    repoInTransaction.count.mockResolvedValue(0);
    repoInTransaction.save.mockImplementation((value: Partial<PayoutMethodEntity>) => ({
      id: 'method-1',
      isVerified: false,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
      ...value,
    }));

    const result = await service.createForUser('user-1', {
      type: PayoutMethodType.PAYPAL_EMAIL,
      paypalEmail: 'cashout@example.com',
    });

    expect(repoInTransaction.update).toHaveBeenCalledWith(
      { userId: 'user-1', isDefault: true },
      { isDefault: false },
    );
    expect(result).toMatchObject({
      type: PayoutMethodType.PAYPAL_EMAIL,
      paypalEmail: 'cashout@example.com',
      isDefault: true,
    });
  });

  it('lists bank payout methods with masked account numbers', async () => {
    payoutMethodRepository.find.mockResolvedValue([
      {
        id: 'method-2',
        type: PayoutMethodType.BANK_ACCOUNT,
        isDefault: false,
        isVerified: false,
        paypalEmail: null,
        bankName: 'Vietcombank',
        bankCode: 'VCB',
        accountNumber: '0123456789',
        accountHolderName: 'Nguyen Van A',
        branchName: 'District 1',
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
        updatedAt: new Date('2026-03-13T00:00:00.000Z'),
      },
    ]);

    const result = await service.listForUser('user-1');

    expect(result[0]).toMatchObject({
      bankName: 'Vietcombank',
      accountNumberMasked: '******6789',
      canDelete: true,
    });
  });

  it('updates a bank payout method without clearing preserved fields', async () => {
    repoInTransaction.findOne.mockResolvedValue({
      id: 'method-9',
      userId: 'user-1',
      type: PayoutMethodType.BANK_ACCOUNT,
      bankName: 'Vietcombank',
      bankCode: 'VCB',
      accountNumber: '0123456789',
      accountHolderName: 'NGUYEN VAN A',
      branchName: 'District 1',
      isDefault: false,
      isVerified: false,
      paypalEmail: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    payoutRequestRepoInTransaction.exist.mockResolvedValue(false);
    repoInTransaction.save.mockImplementation((value: PayoutMethodEntity) => value);

    const result = await service.updateForUser('user-1', 'method-9', {
      type: PayoutMethodType.BANK_ACCOUNT,
      bankName: 'Techcombank',
      isDefault: true,
    });

    expect(repoInTransaction.save).toHaveBeenCalledWith(
      expect.objectContaining({
        bankName: 'Techcombank',
        accountNumber: '0123456789',
        accountHolderName: 'NGUYEN VAN A',
      }),
    );
    expect(result.bankName).toBe('Techcombank');
    expect(result.accountNumberMasked).toBe('******6789');
  });

  it('rejects deleting a payout method with request history', async () => {
    repoInTransaction.findOne.mockResolvedValue({
      id: 'method-8',
      userId: 'user-1',
      type: PayoutMethodType.PAYPAL_EMAIL,
      isDefault: true,
    });
    payoutRequestRepoInTransaction.count.mockResolvedValue(2);

    await expect(service.deleteForUser('user-1', 'method-8')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('throws when updating a missing payout method', async () => {
    repoInTransaction.findOne.mockResolvedValue(null);

    await expect(
      service.updateForUser('user-1', 'missing', {
        type: PayoutMethodType.PAYPAL_EMAIL,
        paypalEmail: 'cashout@example.com',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects incomplete PayPal payloads', async () => {
    await expect(
      service.createForUser('user-1', {
        type: PayoutMethodType.PAYPAL_EMAIL,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
