import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserEntity } from '../../database/entities';
import { UserRole } from '../../database/entities/user.entity';
import { GetUser, JwtAuthGuard } from '../auth';
import { hasAnyUserRole } from '../auth/utils/role.utils';
import { WalletTransactionsQueryDto } from './dto';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  private assertCanViewPlatformFinance(user: UserEntity): void {
    if (hasAnyUserRole(user?.role, [UserRole.ADMIN])) {
      return;
    }

    throw new ForbiddenException('Only admin accounts can view platform finance');
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user wallet snapshot' })
  async getMyWallet(@GetUser() user: UserEntity) {
    return {
      success: true,
      data: await this.walletService.getWalletSnapshot(user),
    };
  }

  @Get('me/transactions')
  @ApiOperation({ summary: 'List the authenticated user wallet transactions' })
  async getMyWalletTransactions(
    @GetUser() user: UserEntity,
    @Query() query: WalletTransactionsQueryDto,
  ) {
    return {
      success: true,
      data: await this.walletService.listTransactions(user, query.page, query.limit, query.range),
    };
  }

  @Get('platform')
  @ApiOperation({ summary: 'Get the platform treasury wallet snapshot for finance admins' })
  async getPlatformWallet(@GetUser() user: UserEntity) {
    this.assertCanViewPlatformFinance(user);

    return {
      success: true,
      data: await this.walletService.getPlatformWalletSnapshot(),
    };
  }

  @Get('platform/transactions')
  @ApiOperation({ summary: 'List platform treasury wallet transactions for finance admins' })
  async getPlatformWalletTransactions(
    @GetUser() user: UserEntity,
    @Query() query: WalletTransactionsQueryDto,
  ) {
    this.assertCanViewPlatformFinance(user);

    return {
      success: true,
      data: await this.walletService.listPlatformTransactions(query.page, query.limit, query.range),
    };
  }
}
