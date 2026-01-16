import { Body, Controller, Post, UseGuards, Req } from '@nestjs/common';
import { ProjectSpecsService } from './project-specs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { CreateProjectSpecDto } from './dto/create-project-spec.dto';
import type { RequestContext } from '../audit-logs/audit-logs.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserEntity } from '../../database/entities/user.entity';

@Controller('project-specs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectSpecsController {
  constructor(private readonly projectSpecsService: ProjectSpecsService) {}

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
}
