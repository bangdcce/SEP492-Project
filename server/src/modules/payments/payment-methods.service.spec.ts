import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  FundingIntentEntity,
  PaymentMethodEntity,
  PaymentMethodType,
} from '../../database/entities';
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
    delete: jest.fn(),
    find: jest.fn(),
  };
  const fundingIntentRepoInTransaction = {
    count: jest.fn(),
    exist: jest.fn(),
  };
  const fundingIntentQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  const fundingIntentReadRepository = {
    createQueryBuilder: jest.fn(() => fundingIntentQueryBuilder),
  };
  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity === PaymentMethodEntity) return repoInTransaction;
      if (entity === FundingIntentEntity) return fundingIntentRepoInTransaction;
      throw new Error('Unexpected repository');
    }),
  };
  const dataSource = {
    transaction: jest.fn((callback: (entityManager: typeof manager) => Promise<unknown>) =>
      callback(manager),
    ),
    getRepository: jest.fn((entity) => {
      if (entity === FundingIntentEntity) {
        return fundingIntentReadRepository;
      }
      throw new Error('Unexpected repository');
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    fundingIntentQueryBuilder.getRawMany.mockResolvedValue([]);

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
      canDelete: true,
    });
    expect(result[0]).not.toHaveProperty('accountNumber');
    expect(result[0]).not.toHaveProperty('accountHolderName');
  });

  it('returns an empty list when the user has no saved payment methods', async () => {
    paymentMethodRepository.find.mockResolvedValue([]);

    const result = await service.listForUser('user-1');

    expect(result).toEqual([]);
  });

  it('falls back to the vaulted payer email when paypalEmail is empty', () => {
    const result = service.toPaymentMethodView({
      id: 'method-vault-1',
      userId: 'user-1',
      type: PaymentMethodType.PAYPAL_ACCOUNT,
      displayName: 'Primary PayPal',
      isDefault: true,
      isVerified: true,
      paypalEmail: null,
      cardBrand: null,
      cardLast4: null,
      cardholderName: null,
      cardExpiryMonth: null,
      cardExpiryYear: null,
      bankName: null,
      bankCode: null,
      accountNumber: null,
      accountHolderName: null,
      branchName: null,
      metadata: {
        paypalVault: {
          customerId: 'cust-1',
          payerEmail: 'buyer@example.com',
          status: 'VAULTED',
        },
      },
      isDeleted: false,
      verifiedAt: new Date('2026-03-13T00:00:00.000Z'),
      deletedAt: null,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    } as PaymentMethodEntity);

    expect(result).toMatchObject({
      paypalEmail: 'buyer@example.com',
      fastCheckoutReady: true,
      vaultStatus: 'VAULTED',
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
    fundingIntentRepoInTransaction.exist.mockResolvedValue(false);
    repoInTransaction.save.mockImplementation((value: PaymentMethodEntity) => value);

    const result = await service.setDefault('user-1', 'method-3');

    expect(repoInTransaction.update).toHaveBeenCalledWith(
      { userId: 'user-1', isDefault: true },
      { isDefault: false },
    );
    expect(result.isDefault).toBe(true);
  });

  it('updates a PayPal method without changing its type', async () => {
    repoInTransaction.findOne.mockResolvedValue({
      id: 'method-9',
      userId: 'user-1',
      type: PaymentMethodType.PAYPAL_ACCOUNT,
      displayName: 'Old PayPal',
      isDefault: false,
      isVerified: true,
      verifiedAt: new Date('2026-03-13T00:00:00.000Z'),
      paypalEmail: 'old@example.com',
      bankName: null,
      bankCode: null,
      accountNumber: null,
      accountHolderName: null,
      branchName: null,
      metadata: {
        paypalVault: {
          customerId: 'cust-9',
          payerEmail: 'old@example.com',
          status: 'VAULTED',
        },
        source: 'subscription-checkout',
      },
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    fundingIntentRepoInTransaction.exist.mockResolvedValue(false);
    repoInTransaction.save.mockImplementation((value: PaymentMethodEntity) => value);

    const result = await service.updateForUser('user-1', 'method-9', {
      type: PaymentMethodType.PAYPAL_ACCOUNT,
      paypalEmail: 'new@example.com',
      displayName: 'Primary PayPal',
      isDefault: true,
    });

    expect(repoInTransaction.update).toHaveBeenCalledWith(
      { userId: 'user-1', isDefault: true },
      { isDefault: false },
    );
    expect(result).toMatchObject({
      id: 'method-9',
      paypalEmail: 'new@example.com',
      displayName: 'Primary PayPal',
      isDefault: true,
      isVerified: false,
      fastCheckoutReady: false,
    });
    expect(repoInTransaction.save).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { source: 'subscription-checkout' },
        verifiedAt: null,
      }),
    );
  });

  it('keeps hidden bank account details when updating non-sensitive fields', async () => {
    repoInTransaction.findOne.mockResolvedValue({
      id: 'bank-1',
      userId: 'user-1',
      type: PaymentMethodType.BANK_ACCOUNT,
      displayName: 'Operations account',
      isDefault: false,
      isVerified: false,
      bankName: 'Vietcombank',
      bankCode: 'VCB',
      accountNumber: '0123456789',
      accountHolderName: 'NGUYEN VAN A',
      branchName: 'District 1',
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    fundingIntentRepoInTransaction.exist.mockResolvedValue(false);
    repoInTransaction.save.mockImplementation((value: PaymentMethodEntity) => value);

    const result = await service.updateForUser('user-1', 'bank-1', {
      type: PaymentMethodType.BANK_ACCOUNT,
      bankName: 'Vietcombank Business',
      isDefault: false,
    });

    expect(repoInTransaction.save).toHaveBeenCalledWith(
      expect.objectContaining({
        bankName: 'Vietcombank Business',
        accountNumber: '0123456789',
        accountHolderName: 'NGUYEN VAN A',
      }),
    );
    expect(result.bankName).toBe('Vietcombank Business');
    expect(result.accountNumberMasked).toBe('******6789');
    expect(result).not.toHaveProperty('accountNumber');
    expect(result).not.toHaveProperty('accountHolderName');
  });

  it('creates a card method with masked card metadata', async () => {
    repoInTransaction.count.mockResolvedValue(1);
    repoInTransaction.save.mockImplementation((value: Partial<PaymentMethodEntity>) => ({
      id: 'card-1',
      isVerified: false,
      createdAt: new Date('2026-03-20T00:00:00.000Z'),
      updatedAt: new Date('2026-03-20T00:00:00.000Z'),
      ...value,
    }));

    const result = await service.createForUser('user-1', {
      type: PaymentMethodType.CARD_ACCOUNT,
      cardBrand: 'Visa',
      cardLast4: '4242',
      cardholderName: 'NGUYEN VAN A',
      cardExpiryMonth: 12,
      cardExpiryYear: 2028,
    });

    expect(result).toMatchObject({
      type: PaymentMethodType.CARD_ACCOUNT,
      cardBrand: 'Visa',
      cardLast4: '4242',
      cardholderName: 'NGUYEN VAN A',
      displayName: 'Visa •••• 4242',
      isDefault: false,
    });
  });

  it('rejects expired card payloads', async () => {
    const now = new Date();
    const expiredMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const expiredYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    await expect(
      service.createForUser('user-1', {
        type: PaymentMethodType.CARD_ACCOUNT,
        cardBrand: 'Visa',
        cardLast4: '4242',
        cardholderName: 'NGUYEN VAN A',
        cardExpiryMonth: expiredMonth,
        cardExpiryYear: expiredYear,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
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

  it('deletes an unused payment method', async () => {
    repoInTransaction.findOne.mockResolvedValue({
      id: 'method-4',
      userId: 'user-1',
      type: PaymentMethodType.BANK_ACCOUNT,
      displayName: 'Spare bank',
      isDefault: false,
    });
    fundingIntentRepoInTransaction.count.mockResolvedValue(0);

    const result = await service.deleteForUser('user-1', 'method-4');

    expect(repoInTransaction.delete).toHaveBeenCalledWith({
      id: 'method-4',
      userId: 'user-1',
    });
    expect(result).toEqual({
      deletedId: 'method-4',
      nextDefaultMethodId: null,
    });
  });

  it('promotes another PayPal method when deleting the default method', async () => {
    repoInTransaction.findOne.mockResolvedValue({
      id: 'method-5',
      userId: 'user-1',
      type: PaymentMethodType.PAYPAL_ACCOUNT,
      displayName: 'Primary PayPal',
      isDefault: true,
    });
    fundingIntentRepoInTransaction.count.mockResolvedValue(0);
    repoInTransaction.find.mockResolvedValue([
      {
        id: 'method-6',
        userId: 'user-1',
        type: PaymentMethodType.BANK_ACCOUNT,
        displayName: 'Bank',
        isDefault: false,
      },
      {
        id: 'method-7',
        userId: 'user-1',
        type: PaymentMethodType.PAYPAL_ACCOUNT,
        displayName: 'Backup PayPal',
        isDefault: false,
      },
    ]);
    repoInTransaction.save.mockImplementation((value: PaymentMethodEntity) => value);

    const result = await service.deleteForUser('user-1', 'method-5');

    expect(repoInTransaction.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'method-7',
        isDefault: true,
      }),
    );
    expect(result).toEqual({
      deletedId: 'method-5',
      nextDefaultMethodId: 'method-7',
    });
  });

  it('does not promote a bank account when deleting the last default funding method', async () => {
    repoInTransaction.findOne.mockResolvedValue({
      id: 'method-11',
      userId: 'user-1',
      type: PaymentMethodType.PAYPAL_ACCOUNT,
      displayName: 'Primary PayPal',
      isDefault: true,
    });
    fundingIntentRepoInTransaction.count.mockResolvedValue(0);
    repoInTransaction.find.mockResolvedValue([
      {
        id: 'method-12',
        userId: 'user-1',
        type: PaymentMethodType.BANK_ACCOUNT,
        displayName: 'Bank',
        isDefault: false,
      },
    ]);

    const result = await service.deleteForUser('user-1', 'method-11');

    expect(repoInTransaction.save).not.toHaveBeenCalled();
    expect(result).toEqual({
      deletedId: 'method-11',
      nextDefaultMethodId: null,
    });
  });

  it('rejects deleting a payment method with funding history', async () => {
    repoInTransaction.findOne.mockResolvedValue({
      id: 'method-8',
      userId: 'user-1',
      type: PaymentMethodType.PAYPAL_ACCOUNT,
      displayName: 'Used PayPal',
      isDefault: true,
    });
    fundingIntentRepoInTransaction.count.mockResolvedValue(2);

    await expect(service.deleteForUser('user-1', 'method-8')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects changing the payment method type during update', async () => {
    repoInTransaction.findOne.mockResolvedValue({
      id: 'method-10',
      userId: 'user-1',
      type: PaymentMethodType.PAYPAL_ACCOUNT,
      displayName: 'Used PayPal',
      isDefault: false,
    });

    await expect(
      service.updateForUser('user-1', 'method-10', {
        type: PaymentMethodType.BANK_ACCOUNT,
        bankName: 'VCB',
        accountNumber: '1234567890',
        accountHolderName: 'Test User',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forgets the saved PayPal buyer without deleting funding history', async () => {
    repoInTransaction.findOne.mockResolvedValue({
      id: 'method-12',
      userId: 'user-1',
      type: PaymentMethodType.PAYPAL_ACCOUNT,
      displayName: 'buyer@example.com',
      isDefault: true,
      isVerified: true,
      verifiedAt: new Date('2026-03-13T00:00:00.000Z'),
      paypalEmail: 'buyer@example.com',
      metadata: {
        paypalVault: {
          customerId: 'cust-1',
          vaultId: 'vault-1',
          payerEmail: 'buyer@example.com',
        },
        notes: {
          source: 'seed',
        },
      },
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    fundingIntentRepoInTransaction.exist.mockResolvedValue(true);
    repoInTransaction.save.mockImplementation((value: PaymentMethodEntity) => value);

    const result = await service.resetPayPalCheckoutForUser('user-1', 'method-12');

    expect(repoInTransaction.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'method-12',
        displayName: 'PayPal checkout',
        paypalEmail: null,
        isVerified: false,
        verifiedAt: null,
        metadata: {
          notes: {
            source: 'seed',
          },
        },
      }),
    );
    expect(result).toMatchObject({
      id: 'method-12',
      paypalEmail: null,
      fastCheckoutReady: false,
      vaultStatus: null,
      canDelete: false,
    });
  });
});
