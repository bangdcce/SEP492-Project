import { Body, Controller, Param, Post, UseGuards, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ContractsService } from './contracts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserEntity } from '../../database/entities/user.entity';

@Controller('contracts')
@UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get('list')
  async listContracts(@GetUser() user: UserEntity) {
    return this.contractsService.listByUser(user.id);
  }

  @Get(':id')
  async getContract(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @Post('initialize/:specId')
  async initializeContract(
    @GetUser() user: UserEntity,
    @Param('specId') specId: string,
  ) {
    return this.contractsService.initializeProjectAndContract(user, specId);
  }

  @Post('sign/:contractId')
  async signContract(
    @GetUser() user: UserEntity,
    @Param('contractId') contractId: string,
    @Body('signatureHash') signatureHash: string,
  ) {
    return this.contractsService.signContract(user, contractId, signatureHash);
  }

  @Post('activate/:contractId')
  async activateProject(
    @GetUser() user: UserEntity,
    @Param('contractId') contractId: string,
  ) {
    return this.contractsService.activateProject(user, contractId);
  }

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.contractsService.generatePdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=contract-${id}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
