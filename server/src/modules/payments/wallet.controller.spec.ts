import { Test, TestingModule } from '@nestjs/testing';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

describe('WalletController', () => {
  let controller: WalletController;

  const walletService = {
    getWalletSnapshot: jest.fn(),
    listTransactions: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [
        {
          provide: WalletService,
          useValue: walletService,
        },
      ],
    }).compile();

    controller = module.get(WalletController);
  });

  it('returns the authenticated user wallet snapshot', async () => {
    walletService.getWalletSnapshot.mockResolvedValue({
      availableBalance: 1250,
      currency: 'USD',
    });

    const user = { id: 'user-1' } as never;
    const result = await controller.getMyWallet(user);

    expect(walletService.getWalletSnapshot).toHaveBeenCalledWith(user);
    expect(result).toEqual({
      success: true,
      data: {
        availableBalance: 1250,
        currency: 'USD',
      },
    });
  });

  it('returns the authenticated user wallet transactions with paging filters', async () => {
    walletService.listTransactions.mockResolvedValue({
      items: [{ id: 'tx-1' }],
      total: 1,
    });

    const user = { id: 'user-1' } as never;
    const query = { page: 2, limit: 10, range: '30d' } as never;
    const result = await controller.getMyWalletTransactions(user, query);

    expect(walletService.listTransactions).toHaveBeenCalledWith(user, 2, 10, '30d');
    expect(result).toEqual({
      success: true,
      data: {
        items: [{ id: 'tx-1' }],
        total: 1,
      },
    });
  });
});
