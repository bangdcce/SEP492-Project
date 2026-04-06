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
import { CreatePaymentMethodDto } from './dto';
import { PaymentMethodsService } from './payment-methods.service';

@Controller('payment-methods')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  private assertCanManagePaymentMethods(user: UserEntity): void {
    if (hasAnyUserRole(user?.role, [UserRole.CLIENT, UserRole.BROKER, UserRole.FREELANCER])) {
      return;
    }

    throw new ForbiddenException(
      'Only client, broker, and freelancer accounts can manage saved payment methods',
    );
  }

  @Get()
  @ApiOperation({ summary: 'List saved payment methods for the authenticated user' })
  async list(@GetUser() user: UserEntity) {
    this.assertCanManagePaymentMethods(user);
    return {
      success: true,
      data: await this.paymentMethodsService.listForUser(user.id),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a saved payment method for the authenticated user' })
  async create(@GetUser() user: UserEntity, @Body() dto: CreatePaymentMethodDto) {
    this.assertCanManagePaymentMethods(user);
    return {
      success: true,
      data: await this.paymentMethodsService.createForUser(user.id, dto),
    };
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Set a saved payment method as the default method' })
  async setDefault(@GetUser() user: UserEntity, @Param('id', ParseUUIDPipe) id: string) {
    this.assertCanManagePaymentMethods(user);
    return {
      success: true,
      data: await this.paymentMethodsService.setDefault(user.id, id),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a saved payment method for the authenticated user' })
  async update(
    @GetUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePaymentMethodDto,
  ) {
    this.assertCanManagePaymentMethods(user);
    return {
      success: true,
      data: await this.paymentMethodsService.updateForUser(user.id, id, dto),
    };
  }

  @Patch(':id/reset-checkout')
  @ApiOperation({ summary: 'Forget the saved PayPal buyer and clear Vault checkout state' })
  async resetCheckout(@GetUser() user: UserEntity, @Param('id', ParseUUIDPipe) id: string) {
    this.assertCanManagePaymentMethods(user);
    return {
      success: true,
      data: await this.paymentMethodsService.resetPayPalCheckoutForUser(user.id, id),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a saved payment method for the authenticated user' })
  async remove(@GetUser() user: UserEntity, @Param('id', ParseUUIDPipe) id: string) {
    this.assertCanManagePaymentMethods(user);
    return {
      success: true,
      data: await this.paymentMethodsService.deleteForUser(user.id, id),
    };
  }
}
