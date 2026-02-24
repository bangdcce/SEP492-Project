import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MatchingService } from './matching.service';
import { MatchQueryDto } from './dto/match-query.dto';
import { MatchingInput } from './interfaces/match.interfaces';
import { ProjectRequestEntity } from '../../database/entities/project-request.entity';
import { JwtAuthGuard, Roles, RolesGuard } from '../auth';
import { UserRole } from '../../database/entities/user.entity';

@ApiTags('Matching Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('matching')
export class MatchingController {
  private readonly logger = new Logger(MatchingController.name);

  constructor(
    private readonly matchingService: MatchingService,
    @InjectRepository(ProjectRequestEntity)
    private readonly requestRepo: Repository<ProjectRequestEntity>,
  ) {}

  @Get(':requestId')
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.BROKER)
  @ApiOperation({ summary: 'Find highly relevant freelancers for a project request (uses AI if enabled)' })
  @ApiResponse({ status: 200, description: 'Returns a ranked, classified list of matched freelancers.' })
  @ApiResponse({ status: 404, description: 'Project request not found.' })
  async getMatches(
    @Param('requestId') requestId: string,
    @Query() query: MatchQueryDto,
  ) {
    this.logger.log(`Full matching pipeline requested for ${requestId}`);
    const enableAi = query.enableAi ?? true;
    const topN = query.topN ?? 10;
    const requireKyc = query.requireKyc ?? true;
    const role = query.role ?? 'FREELANCER';

    // 1. Build context
    const input = await this.buildMatchingInput(requestId);

    // 2. Execute matching pipeline
    return this.matchingService.findMatches(input, {
      enableAi,
      topN,
      requireKyc,
      role,
    });
  }

  @Get(':requestId/quick')
  @Roles(UserRole.CLIENT, UserRole.ADMIN, UserRole.BROKER)
  @ApiOperation({ summary: 'Instant deterministic matching (bypasses AI Layer 3)' })
  @ApiResponse({ status: 200, description: 'Returns a list of freelancers ranked strictly by deterministic tag overlap.' })
  @ApiResponse({ status: 404, description: 'Project request not found.' })
  async findMatchesQuick(
    @Param('requestId') requestId: string,
    @Query() query: MatchQueryDto,
  ) {
    this.logger.log(`Quick matching pipeline requested for ${requestId}`);
    const topN = query.topN ?? 10;
    const requireKyc = query.requireKyc ?? true;
    const role = query.role ?? 'FREELANCER';

    const input = await this.buildMatchingInput(requestId);
    
    return this.matchingService.findMatches(input, {
      enableAi: false,
      topN,
      requireKyc,
      role,
    });
  }

  /**
   * Helper to load the request and parse its fields into the MatchingInput interface
   */
  private async buildMatchingInput(requestId: string): Promise<MatchingInput> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
      relations: ['spec'],
    });

    if (!request) {
      throw new NotFoundException(`Project request ${requestId} not found.`);
    }

    const specDescription = request.spec?.description || request.description;
    
    // Parse tech preferences from string (comma, slash, or pipe separated)
    const techStackRaw = request.spec?.techStack || request.techPreferences || '';
    const requiredTechStack = techStackRaw
      .split(/[,/|]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    return {
      requestId,
      specDescription,
      requiredTechStack,
      budgetRange: request.budgetRange,
      estimatedDuration: request.intendedTimeline,
    };
  }
}
