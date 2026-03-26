import { Body, Controller, Param, Post, UseGuards, Get, Res, Patch, Req } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ContractsService } from './contracts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserEntity } from '../../database/entities/user.entity';
import {
  CreateSignatureSessionDto,
  InitializeContractDto,
  SignContractDto,
  UpdateContractDraftDto,
} from './dto';

@Controller('contracts')
@UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get('list')
  async listContracts(@GetUser() user: UserEntity) {
    return this.contractsService.listByUser(user.id);
  }

  @Get(':id')
  async getContract(@GetUser() user: UserEntity, @Param('id') id: string) {
    return this.contractsService.findOneForUser(user, id);
  }

  @Post('initialize')
  async initializeContractWithBody(
    @GetUser() user: UserEntity,
    @Body() dto: InitializeContractDto,
  ) {
    return this.contractsService.initializeProjectAndContract(user, dto.specId, dto.freelancerId);
  }

  @Post('initialize/:specId')
  async initializeContract(@GetUser() user: UserEntity, @Param('specId') specId: string) {
    return this.contractsService.initializeProjectAndContract(user, specId);
  }

  @Post('sign/:contractId')
  async signContract(
    @GetUser() user: UserEntity,
    @Req() req: Request,
    @Param('contractId') contractId: string,
    @Body() dto: SignContractDto,
  ) {
    return this.contractsService.signContract(user, contractId, dto.contentHash, req);
  }

  @Patch(':id/draft')
  async updateDraft(
    @GetUser() user: UserEntity,
    @Param('id') id: string,
    @Body() dto: UpdateContractDraftDto,
  ) {
    return this.contractsService.updateDraft(user, id, dto);
  }

  @Post(':id/send')
  async sendDraft(@GetUser() user: UserEntity, @Param('id') id: string) {
    return this.contractsService.sendDraft(user, id);
  }

  @Post(':id/signature-sessions')
  async createSignatureSession(
    @GetUser() user: UserEntity,
    @Param('id') id: string,
    @Body() dto: CreateSignatureSessionDto,
  ) {
    return this.contractsService.createSignatureSession(user, id, dto);
  }

  @Post(':id/discard')
  async discardDraft(@GetUser() user: UserEntity, @Param('id') id: string) {
    return this.contractsService.discardDraft(user, id);
  }

  @Post('activate/:contractId')
  async activateProject(@GetUser() user: UserEntity, @Param('contractId') contractId: string) {
    return this.contractsService.activateProject(user, contractId);
  }

  @Get(':id/pdf')
  async downloadPdf(
    @GetUser() user: UserEntity,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.contractsService.generatePdfForUser(user, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=contract-${id}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
