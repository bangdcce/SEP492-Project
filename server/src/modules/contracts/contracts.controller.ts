import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { UserEntity } from '../../database/entities/user.entity';
import type { Request } from 'express';
import { InitializeContractDto, SignContractDto } from './dto';

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  /**
   * PHASE 1: Initialize Project and Contract from an Approved Spec
   * Creates Project (INITIALIZING) + Contract (DRAFT)
   */
  @Post('initialize')
  @ApiOperation({ summary: 'Initialize Project and Contract from Approved Spec' })
  @ApiResponse({ status: 201, description: 'Project and Contract created successfully' })
  @ApiResponse({ status: 400, description: 'Spec not approved or contract already exists' })
  @ApiResponse({ status: 404, description: 'Spec not found' })
  async initializeContract(
    @GetUser() user: UserEntity,
    @Body() dto: InitializeContractDto,
    @Req() req: Request,
  ) {
    const result = await this.contractsService.initializeProjectAndContract(user, dto, req);
    return {
      success: true,
      message: 'Project and Contract initialized successfully. Awaiting signatures.',
      data: result,
    };
  }

  /**
   * Sign a contract (Client or Freelancer)
   */
  @Post(':id/sign')
  @ApiOperation({ summary: 'Sign a contract' })
  @ApiResponse({ status: 200, description: 'Contract signed successfully' })
  @ApiResponse({ status: 400, description: 'Already signed or contract not in DRAFT' })
  @ApiResponse({ status: 403, description: 'Not authorized to sign' })
  async signContract(
    @GetUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) contractId: string,
    @Req() req: Request,
  ) {
    const result = await this.contractsService.signContract(
      user,
      { contractId },
      req,
    );

    return {
      success: true,
      message: result.allPartiesSigned
        ? 'Contract signed! All parties have signed. Ready to activate.'
        : 'Contract signed! Waiting for other party to sign.',
      data: result,
    };
  }

  /**
   * PHASE 2: Activate Project after all signatures
   * Clones Milestones, creates Escrows, starts Project
   */
  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate Project after contract is fully signed' })
  @ApiResponse({ status: 200, description: 'Project activated with milestones and escrows' })
  @ApiResponse({ status: 400, description: 'Not all parties signed or financial mismatch' })
  async activateProject(
    @GetUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) contractId: string,
    @Req() req: Request,
  ) {
    const result = await this.contractsService.activateProject(user, contractId, req);
    return {
      success: true,
      message: `Project activated! ${result.milestonesCreated} milestones and ${result.escrowsCreated} escrow entries created.`,
      data: result,
    };
  }

  /**
   * Get contract details
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get contract details' })
  @ApiResponse({ status: 200, description: 'Contract details' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async getContract(@Param('id', ParseUUIDPipe) contractId: string) {
    const contract = await this.contractsService.getContract(contractId);
    return {
      success: true,
      data: contract,
    };
  }

  /**
   * Get all contracts for a project
   */
  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get all contracts for a project' })
  async getContractsByProject(@Param('projectId', ParseUUIDPipe) projectId: string) {
    const contracts = await this.contractsService.getContractsByProject(projectId);
    return {
      success: true,
      data: contracts,
    };
  }
}
