import { Body, Controller, Post, UseGuards, Req, Param, BadRequestException, Get } from '@nestjs/common';
import { ProjectSpecsService } from './project-specs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { CreateProjectSpecDto } from './dto/create-project-spec.dto';
import { AuditSpecDto, AuditAction } from './dto/audit-spec.dto';
import type { RequestContext } from '../audit-logs/audit-logs.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserEntity } from '../../database/entities/user.entity';

@Controller('project-specs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectSpecsController {
  constructor(private readonly projectSpecsService: ProjectSpecsService) {}

  @Get('pending')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  async getPendingSpecs(@GetUser() user: UserEntity) {
    return this.projectSpecsService.findPendingSpecs();
  }

  @Post()
  @Roles(UserRole.BROKER)
  async create(
    @GetUser() user: UserEntity,
    @Body() createSpecDto: CreateProjectSpecDto,
    @Req() req: RequestContext,
  ) {
    console.log('[ProjectSpecsController] Received DTO:', createSpecDto);
    console.log(
      '[ProjectSpecsController] requestId:',
      createSpecDto.requestId,
      'type:',
      typeof createSpecDto.requestId,
    );
    return this.projectSpecsService.createSpec(user, createSpecDto, req);
  }
  @Post(':id/audit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF) // Only Admin/Staff can audit
  async auditSpec(
    @GetUser() user: UserEntity,
    @Param('id') id: string,
    @Body() auditDto: AuditSpecDto,
    @Req() req: RequestContext,
  ) {
    if (auditDto.action === AuditAction.APPROVE) {
      return this.projectSpecsService.approveSpec(user, id, req);
    } else {
      if (!auditDto.reason) {
        throw new BadRequestException('Reason is required for rejection');
      }
      return this.projectSpecsService.rejectSpec(user, id, auditDto.reason, req);
    }
  }
}
