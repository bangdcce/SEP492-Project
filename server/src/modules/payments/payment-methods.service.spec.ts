import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PaymentMethodEntity, PaymentMethodType } from '../../database/entities';
import { PaymentMethodsService } from './payment-methods.service';

describe('PaymentMethodsService', () => {
  let service: PaymentMethodsService;

  const paymentMethodRepository = {
    find: jest.fn(),
  };
  const repoInTransaction = {
    count: jest.fn(),
    update: jest.fn(),
    create: jest.fn((data: Partial<PaymentMethodEntity>) => data),
    save: jest.fn(),
    findOne: jest.fn(),
  };
  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity === PaymentMethodEntity) return repoInTransaction;
      throw new Error('Unexpected repository');
    }),
  };
  const dataSource = {
    transaction: jest.fn((callback: (entityManager: typeof manager) => Promise<unknown>) =>
      callback(manager),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentMethodsService,
        {
          provide: getRepositoryToken(PaymentMethodEntity),
          useValue: paymentMethodRepository,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get(PaymentMethodsService);
  });

  it('creates the first PayPal method as default', async () => {
    repoInTransaction.count.mockResolvedValue(0);
    repoInTransaction.save.mockImplementation((value: Partial<PaymentMethodEntity>) => ({
      id: 'method-1',
      isVerified: false,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
      ...value,
    }));

    const result = await service.createForUser('user-1', {
      type: PaymentMethodType.PAYPAL_ACCOUNT,
      paypalEmail: 'client@example.com',
    });

    expect(repoInTransaction.update).toHaveBeenCalledWith(
      { userId: 'user-1', isDefault: true },
      { isDefault: false },
    );
    expect(result).toMatchObject({
      type: PaymentMethodType.PAYPAL_ACCOUNT,
      paypalEmail: 'client@example.com',
      displayName: 'client@example.com',
      isDefault: true,
    });
  });

  it('masks bank account numbers in the response', async () => {
    paymentMethodRepository.find.mockResolvedValue([
      {
        id: 'method-2',
        type: PaymentMethodType.BANK_ACCOUNT,
        displayName: 'Vietcombank',
        isDefault: false,
        isVerified: false,
        paypalEmail: null,
        bankName: 'Vietcombank',
        accountNumber: '0123456789',
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
        updatedAt: new Date('2026-03-13T00:00:00.000Z'),
      },
    ]);

    const result = await service.listForUser('user-1');

    expect(result[0]).toMatchObject({
      bankName: 'Vietcombank',
      accountNumberMasked: '******6789',
    });
  });

  it('sets the selected method as default', async () => {
    repoInTransaction.findOne.mockResolvedValue({
      id: 'method-3',
      userId: 'user-1',
      type: PaymentMethodType.PAYPAL_ACCOUNT,
      displayName: 'Primary PayPal',
      isDefault: false,
      isVerified: false,
      paypalEmail: 'client@example.com',
      bankName: null,
      accountNumber: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    repoInTransaction.save.mockImplementation((value: PaymentMethodEntity) => value);

    const result = await service.setDefault('user-1', 'method-3');

    expect(repoInTransaction.update).toHaveBeenCalledWith(
      { userId: 'user-1', isDefault: true },
      { isDefault: false },
    );
    expect(result.isDefault).toBe(true);
  });

  it('rejects incomplete bank account payloads', async () => {
    await expect(
      service.createForUser('user-1', {
        type: PaymentMethodType.BANK_ACCOUNT,
        bankName: 'VCB',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when setting a missing method as default', async () => {
    repoInTransaction.findOne.mockResolvedValue(null);

    await expect(service.setDefault('user-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
