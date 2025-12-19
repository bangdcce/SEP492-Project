import {
  Body,
  Controller,
  Param,
  Patch,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ProjectRequestsService } from './project-requests.service';
import { AssignBrokerDto } from './dto/assign-broker.dto';

// TODO: Import RoleGuard and Roles decorator when available
// import { Roles } from '../../common/decorators/roles.decorator';
// import { UserRole } from '../../database/entities/user.entity';
// import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('project-requests')
export class ProjectRequestsController {
  constructor(private readonly projectRequestsService: ProjectRequestsService) {}

  @Patch(':id/assign')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.BROKER)
  async assignBroker(
    @Param('id') id: string,
    @Body(new ValidationPipe()) assignBrokerDto: AssignBrokerDto,
  ) {
    return this.projectRequestsService.assignBroker(
      id,
      assignBrokerDto.brokerId,
    );
  }
}
