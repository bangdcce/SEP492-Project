import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
  Logger,
  ParseUUIDPipe,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ProjectsService, MilestoneApprovalResult } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Interface for authenticated request with user context
interface AuthenticatedRequest {
  user?: { id: string };
  ip?: string;
  method: string;
  path: string;
  get: (header: string) => string | undefined;
}

// DTO for milestone approval
interface ApproveMilestoneDto {
  feedback?: string;
}

@Controller('projects')
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(private readonly projectsService: ProjectsService) {}

  @Get('list/:userId')
  listByUser(@Param('userId') userId: string) {
    return this.projectsService.listByUser(userId);
  }

  /**
   * Approve a milestone and release funds
   * Only Client or Broker can approve
   *
   * @param id - Milestone UUID
   * @param dto - Optional approval data (feedback)
   * @param req - Authenticated request
   */
  @Post('milestones/:id/approve')
  @UseGuards(JwtAuthGuard)
  async approveMilestone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveMilestoneDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<MilestoneApprovalResult> {
    const userId = req.user?.id;

    if (!userId) {
      throw new BadRequestException('User authentication required to approve milestone');
    }

    this.logger.log(`Milestone approval request: ${id} by user ${userId}`);

    // Extract request context for audit logging
    const reqContext = {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      method: req.method,
      path: req.path,
    };

    try {
      const result = await this.projectsService.approveMilestone(
        id,
        userId,
        dto?.feedback,
        reqContext,
      );

      this.logger.log(
        `✅ Milestone ${id} approved successfully. Funds released: ${result.fundsReleased}`,
      );

      return result;
    } catch (error: unknown) {
      // Re-throw known exceptions
      if (
        error instanceof BadRequestException ||
        (error instanceof Error &&
          (error.constructor.name === 'NotFoundException' ||
            error.constructor.name === 'ForbiddenException'))
      ) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to approve milestone ${id}: ${errorMessage}`);
      throw new InternalServerErrorException('Failed to approve milestone');
    }
  }
}
