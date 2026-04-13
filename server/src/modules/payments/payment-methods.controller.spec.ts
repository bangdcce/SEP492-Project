import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../../database/entities/user.entity';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';

describe('PaymentMethodsController', () => {
  let controller: PaymentMethodsController;

  const paymentMethodsService = {
    listForUser: jest.fn(),
    createForUser: jest.fn(),
    setDefault: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentMethodsController],
      providers: [
        {
          provide: PaymentMethodsService,
          useValue: paymentMethodsService,
        },
      ],
    }).compile();

    controller = module.get(PaymentMethodsController);
  });

  it('lists saved payment methods for an allowed role', async () => {
    paymentMethodsService.listForUser.mockResolvedValue([{ id: 'pm-1' }]);

    const result = await controller.list({
      id: 'user-1',
      role: UserRole.CLIENT,
    } as never);

    expect(paymentMethodsService.listForUser).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      success: true,
      data: [{ id: 'pm-1' }],
    });
  });

  it('forbids listing payment methods for unsupported roles', async () => {
    await expect(
      controller.list({
        id: 'user-1',
        role: UserRole.ADMIN,
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(paymentMethodsService.listForUser).not.toHaveBeenCalled();
  });

  it('creates a payment method for allowed roles', async () => {
    paymentMethodsService.createForUser.mockResolvedValue({ id: 'pm-2', brand: 'visa' });

    const dto = {
      type: 'CARD',
      provider: 'STRIPE',
      label: 'Visa ending 4242',
    };

    const result = await controller.create(
      {
        id: 'user-1',
        role: UserRole.BROKER,
      } as never,
      dto as never,
    );

    expect(paymentMethodsService.createForUser).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual({
      success: true,
      data: { id: 'pm-2', brand: 'visa' },
    });
  });

  it('forbids creating payment methods for unsupported roles', async () => {
    await expect(
      controller.create(
        {
          id: 'user-1',
          role: UserRole.ADMIN,
        } as never,
        {
          type: 'CARD',
        } as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(paymentMethodsService.createForUser).not.toHaveBeenCalled();
  });

  it('sets the default payment method for allowed roles', async () => {
    paymentMethodsService.setDefault.mockResolvedValue({ id: 'pm-1', isDefault: true });

    const result = await controller.setDefault(
      {
        id: 'user-1',
        role: UserRole.FREELANCER,
      } as never,
      'pm-1',
    );

    expect(paymentMethodsService.setDefault).toHaveBeenCalledWith('user-1', 'pm-1');
    expect(result).toEqual({
      success: true,
      data: { id: 'pm-1', isDefault: true },
    });
  });

  it('forbids setting the default payment method for unsupported roles', async () => {
    await expect(
      controller.setDefault(
        {
          id: 'user-1',
          role: UserRole.ADMIN,
        } as never,
        'pm-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(paymentMethodsService.setDefault).not.toHaveBeenCalled();
  });
});
