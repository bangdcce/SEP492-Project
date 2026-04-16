import { Controller, Get, Param, Query, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchingService, MatchingInput } from './matching.service';
import { ProjectRequestEntity } from '../../database/entities/project-request.entity';
import { BrokerProposalEntity } from '../../database/entities/broker-proposal.entity';
import { ProjectRequestProposalEntity } from '../../database/entities/project-request-proposal.entity';
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
    @InjectRepository(ProjectRequestProposalEntity)
    private readonly freelancerProposalRepo: Repository<ProjectRequestProposalEntity>,
  ) {}

  private parseRequestedTags(...rawValues: Array<string | null | undefined>): string[] {
    return [
      ...new Set(
        rawValues
          .flatMap((value) => (value ? value.split(/[,;\n]+/) : []))
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    ];
  }

  private extractRequestTerms(
    request: ProjectRequestEntity,
    role: 'BROKER' | 'FREELANCER',
  ): string[] {
    const answerTerms = (request.answers || []).flatMap((answer: any) => {
      const questionCode = String(answer?.question?.code || '')
        .trim()
        .toUpperCase();

      // Freelancers match on technical features, not business domains
      if (role === 'FREELANCER') {
        if (!['FEATURES'].includes(questionCode)) {
          return [];
        }
      } else {
        if (!['INDUSTRY', 'PRODUCT_TYPE', 'FEATURES'].includes(questionCode)) {
          return [];
        }
      }

      return this.parseRequestedTags(
        answer?.valueText,
        answer?.option?.label,
        answer?.option?.value,
      );
    });

    return this.parseRequestedTags(request.techPreferences, ...answerTerms);
  }

  @Get(':requestId')
  @ApiOperation({ summary: 'Find matching candidates for a project request' })
  async findMatches(
    @Param('requestId') requestId: string,
    @Query('role') role: 'BROKER' | 'FREELANCER' = 'BROKER',
    @Query('enableAi') enableAi?: string,
    @Query('topN') topN?: string,
    @Query('page') page?: string,
  ) {
    this.logger.log(
      `Finding matches: requestId=${requestId}, role=${role}, enableAi=${enableAi}, topN=${topN}, page=${page}`,
    );

    const request = await this.requestRepo.findOne({
      where: { id: requestId },
      relations: ['answers', 'answers.question', 'answers.option'],
    });

    if (!request) {
      return [];
    }

    const excludeUserIds =
      role === 'BROKER'
        ? (
            await this.brokerProposalRepo.find({
              where: { requestId },
            })
          )
            .map((proposal) => proposal.brokerId)
            .filter((value): value is string => Boolean(value))
        : (
            await this.freelancerProposalRepo.find({
              where: { requestId },
            })
          )
            .map((proposal) => proposal.freelancerId)
            .filter((value): value is string => Boolean(value));

    const input: MatchingInput = {
      requestId: request.id,
      specDescription: request.description || '',
      requiredTechStack: this.extractRequestTerms(request, role),
      budgetRange: request.budgetRange,
      estimatedDuration: request.intendedTimeline,
      excludeUserIds,
    };

    return this.matchingService.findMatches(input, {
      role,
      enableAi: enableAi !== undefined ? enableAi === 'true' : undefined,
      topN: topN ? parseInt(topN, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
    });
  }
}
