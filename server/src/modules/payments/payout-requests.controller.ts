import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserEntity } from '../../database/entities';
import { UserRole } from '../../database/entities/user.entity';
import { GetUser, JwtAuthGuard } from '../auth';
import { hasAnyUserRole } from '../auth/utils/role.utils';
import { CreatePayoutRequestDto, PayoutRequestsQueryDto, RejectPayoutRequestDto } from './dto';
import { PayoutRequestsService } from './payout-requests.service';

@Controller('payout-requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('payout-requests')
export class PayoutRequestsController {
  constructor(private readonly payoutRequestsService: PayoutRequestsService) {}

  private assertCanRequestCashout(user: UserEntity): void {
    if (hasAnyUserRole(user?.role, [UserRole.BROKER, UserRole.FREELANCER])) {
      return;
    }

    throw new ForbiddenException('Only broker and freelancer accounts can request cashouts');
  }

  private assertCanRejectCashout(user: UserEntity): void {
    if (hasAnyUserRole(user?.role, [UserRole.ADMIN, UserRole.STAFF])) {
      return;
    }

    throw new ForbiddenException('Only staff and admin accounts can reject payout requests');
  }

  @Get()
  @ApiOperation({ summary: 'List payout requests for the authenticated user' })
  async list(@GetUser() user: UserEntity, @Query() query: PayoutRequestsQueryDto) {
    this.assertCanRequestCashout(user);
    return {
      success: true,
      data: await this.payoutRequestsService.listForUser(user, query),
    };
  }

  @Post('quote')
  @ApiOperation({ summary: 'Preview fees and net amount for a cashout request' })
  async quote(
    @GetUser() user: UserEntity,
    @Body() dto: CreatePayoutRequestDto,
  ) {
    this.assertCanRequestCashout(user);
    return {
      success: true,
      data: await this.payoutRequestsService.quoteForUser(user, dto.payoutMethodId, dto.amount),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a payout request for the authenticated user' })
  async create(@GetUser() user: UserEntity, @Body() dto: CreatePayoutRequestDto) {
    this.assertCanRequestCashout(user);
    return {
      success: true,
      data: await this.payoutRequestsService.createForUser(user, dto),
    };
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a payout request as staff or admin' })
  async reject(
    @GetUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPayoutRequestDto,
  ) {
    this.assertCanRejectCashout(user);
    return {
      success: true,
      data: await this.payoutRequestsService.rejectForAdmin(id, user, dto.reason),
    };
  }
}
