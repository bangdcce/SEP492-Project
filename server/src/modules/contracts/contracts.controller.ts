import { Controller, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { UserEntity } from '../../database/entities/user.entity';
// Import Auth guards if available, assuming standard 'JwtAuthGuard'
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; 

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post('initialize')
  // @UseGuards(JwtAuthGuard)
  async initialize(@Body() body: { specId: string }, @Request() req) {
    // const userId = req.user.id;
    const userId = 'temp-user-id'; // To be replaced with real auth
    return this.contractsService.initializeProjectAndContract(body.specId, userId);
  }

  @Post(':id/activate')
  // @UseGuards(JwtAuthGuard)
  async activate(@Param('id') id: string, @Request() req) {
     // const user = req.user;
     const user = {} as UserEntity; // Dummy
     return this.contractsService.activateProject(id, user);
  }
}
