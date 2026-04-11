import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserEntity } from '../../database/entities';
import { UserRole } from '../../database/entities/user.entity';
import { GetUser, JwtAuthGuard } from '../auth';
import { hasAnyUserRole } from '../auth/utils/role.utils';
import { CreatePayoutMethodDto } from './dto';
import { PayoutMethodsService } from './payout-methods.service';

@Controller('payout-methods')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('payout-methods')
export class PayoutMethodsController {
  constructor(private readonly payoutMethodsService: PayoutMethodsService) {}

  private assertCanManagePayoutMethods(user: UserEntity): void {
    if (
      hasAnyUserRole(user?.role, [
        UserRole.CLIENT,
        UserRole.BROKER,
        UserRole.FREELANCER,
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'Only client, broker, and freelancer accounts can manage payout methods',
    );
  }

  @Get()
  @ApiOperation({ summary: 'List payout methods for the authenticated user' })
  async list(@GetUser() user: UserEntity) {
    this.assertCanManagePayoutMethods(user);
    return {
      success: true,
      data: await this.payoutMethodsService.listForUser(user.id),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a payout method for the authenticated user' })
  async create(@GetUser() user: UserEntity, @Body() dto: CreatePayoutMethodDto) {
    this.assertCanManagePayoutMethods(user);
    return {
      success: true,
      data: await this.payoutMethodsService.createForUser(user.id, dto),
    };
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Set a payout method as the default cashout destination' })
  async setDefault(@GetUser() user: UserEntity, @Param('id', ParseUUIDPipe) id: string) {
    this.assertCanManagePayoutMethods(user);
    return {
      success: true,
      data: await this.payoutMethodsService.setDefault(user.id, id),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a payout method for the authenticated user' })
  async update(
    @GetUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePayoutMethodDto,
  ) {
    this.assertCanManagePayoutMethods(user);
    return {
      success: true,
      data: await this.payoutMethodsService.updateForUser(user.id, id, dto),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a payout method for the authenticated user' })
  async remove(@GetUser() user: UserEntity, @Param('id', ParseUUIDPipe) id: string) {
    this.assertCanManagePayoutMethods(user);
    return {
      success: true,
      data: await this.payoutMethodsService.deleteForUser(user.id, id),
    };
  }
}
