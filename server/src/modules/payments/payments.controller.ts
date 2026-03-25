import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserEntity } from '../../database/entities';
import { GetUser, JwtAuthGuard } from '../auth';
import { FundMilestoneDto } from './dto';
import { MilestoneFundingService } from './milestone-funding.service';

@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('payments')
export class PaymentsController {
  constructor(private readonly milestoneFundingService: MilestoneFundingService) {}

  @Post('milestones/:milestoneId/fund')
  @ApiOperation({ summary: 'Fund a milestone escrow exactly once with full funding only' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique client-generated key used to deduplicate funding attempts.',
  })
  async fundMilestone(
    @GetUser() user: UserEntity,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: FundMilestoneDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    return {
      success: true,
      data: await this.milestoneFundingService.fundMilestone({
        milestoneId,
        payerId: user.id,
        paymentMethodId: dto.paymentMethodId,
        gateway: dto.gateway,
        idempotencyKey,
      }),
    };
  }
}
