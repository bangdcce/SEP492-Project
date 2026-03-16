import { Controller, Get, Patch, Param, ParseUUIDPipe, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserEntity } from '../../database/entities';
import { GetUser, JwtAuthGuard } from '../auth';
import { CreatePaymentMethodDto } from './dto';
import { PaymentMethodsService } from './payment-methods.service';

@Controller('payment-methods')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Get()
  @ApiOperation({ summary: 'List funding payment methods for the authenticated user' })
  async list(@GetUser() user: UserEntity) {
    return {
      success: true,
      data: await this.paymentMethodsService.listForUser(user.id),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a funding payment method for the authenticated user' })
  async create(@GetUser() user: UserEntity, @Body() dto: CreatePaymentMethodDto) {
    return {
      success: true,
      data: await this.paymentMethodsService.createForUser(user.id, dto),
    };
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Set a payment method as the default funding method' })
  async setDefault(@GetUser() user: UserEntity, @Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      data: await this.paymentMethodsService.setDefault(user.id, id),
    };
  }
}
