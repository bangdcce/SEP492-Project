import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserEntity } from '../../database/entities';
import { UserRole } from '../../database/entities/user.entity';
import { GetUser, JwtAuthGuard } from '../auth';
import { hasAnyUserRole } from '../auth/utils/role.utils';
import { CreatePayoutRequestDto, PayoutRequestsQueryDto } from './dto';
import { PayoutRequestsService } from './payout-requests.service';

@Controller('cashout')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('cashout')
export class CashoutController {
  constructor(private readonly payoutRequestsService: PayoutRequestsService) {}

  private assertCanRequestCashout(user: UserEntity): void {
    if (hasAnyUserRole(user?.role, [UserRole.BROKER, UserRole.FREELANCER])) {
      return;
    }

    throw new ForbiddenException('Only broker and freelancer accounts can request cashouts');
  }

  @Get('requests')
  @ApiOperation({ summary: 'List cashout requests for the authenticated user' })
  async list(@GetUser() user: UserEntity, @Query() query: PayoutRequestsQueryDto) {
    this.assertCanRequestCashout(user);
    return {
      success: true,
      data: await this.payoutRequestsService.listForUser(user, query),
    };
  }

  @Post('requests/quote')
  @ApiOperation({ summary: 'Preview fees and net amount for a cashout request' })
  async quote(@GetUser() user: UserEntity, @Body() dto: CreatePayoutRequestDto) {
    this.assertCanRequestCashout(user);
    return {
      success: true,
      data: await this.payoutRequestsService.quoteForUser(user, dto.payoutMethodId, dto.amount),
    };
  }

  @Post('requests')
  @ApiOperation({ summary: 'Create a cashout request for the authenticated user' })
  async create(@GetUser() user: UserEntity, @Body() dto: CreatePayoutRequestDto) {
    this.assertCanRequestCashout(user);
    return {
      success: true,
      data: await this.payoutRequestsService.createForUser(user, dto),
    };
  }
}
