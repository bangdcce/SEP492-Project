import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserEntity } from '../../database/entities';
import { GetUser, JwtAuthGuard } from '../auth';
import { WalletTransactionsQueryDto } from './dto';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user wallet snapshot' })
  async getMyWallet(@GetUser() user: UserEntity) {
    return {
      success: true,
      data: await this.walletService.getWalletSnapshot(user.id),
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
      data: await this.walletService.listTransactions(user.id, query.page, query.limit),
    };
  }
}
