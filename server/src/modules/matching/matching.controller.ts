import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchingService, MatchingInput } from './matching.service';
import { ProjectRequestEntity } from '../../database/entities/project-request.entity';
import { BrokerProposalEntity } from '../../database/entities/broker-proposal.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Matching')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('matching')
export class MatchingController {
  private readonly logger = new Logger(MatchingController.name);

  constructor(
    private readonly matchingService: MatchingService,
    @InjectRepository(ProjectRequestEntity)
    private readonly requestRepo: Repository<ProjectRequestEntity>,
    @InjectRepository(BrokerProposalEntity)
    private readonly brokerProposalRepo: Repository<BrokerProposalEntity>,
  ) {}

  @Get(':requestId')
  @ApiOperation({ summary: 'Find matching candidates for a project request' })
  async findMatches(
    @Param('requestId') requestId: string,
    @Query('role') role: 'BROKER' | 'FREELANCER' = 'BROKER',
    @Query('enableAi') enableAi?: string,
    @Query('topN') topN?: string,
  ) {
    this.logger.log(
      `Finding matches: requestId=${requestId}, role=${role}, enableAi=${enableAi}, topN=${topN}`,
    );

    const request = await this.requestRepo.findOne({
      where: { id: requestId },
    });

    if (!request) {
      return [];
    }

    // Get already invited broker IDs to exclude
    const existingProposals = await this.brokerProposalRepo.find({
      where: { requestId },
    });
    const excludeUserIds = existingProposals.map((p) => p.brokerId);

    const techStack = request.techPreferences
      ? request.techPreferences
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];

    const input: MatchingInput = {
      requestId: request.id,
      specDescription: request.description || '',
      requiredTechStack: techStack,
      budgetRange: request.budgetRange,
      estimatedDuration: request.intendedTimeline,
      excludeUserIds,
    };

    return this.matchingService.findMatches(input, {
      role,
      enableAi: enableAi !== undefined ? enableAi === 'true' : undefined,
      topN: topN ? parseInt(topN, 10) : undefined,
    });
  }
}
