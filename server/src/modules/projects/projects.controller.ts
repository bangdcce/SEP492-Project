import { Controller, Get, Param } from '@nestjs/common';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('list/:userId')
  listByUser(@Param('userId') userId: string) {
    return this.projectsService.listByUser(userId);
  }
}
