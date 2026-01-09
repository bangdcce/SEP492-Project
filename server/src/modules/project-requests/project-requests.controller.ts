import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProjectRequestsService } from './project-requests.service';
import { RequestStatus, ProjectRequestEntity } from '../../database/entities/project-request.entity';
import { Roles, JwtAuthGuard, RolesGuard } from '../auth';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole, UserEntity } from '../../database/entities/user.entity';
import { CreateProjectRequestDto, UpdateProjectRequestDto } from './dto/create-project-request.dto';

@ApiTags('Project Requests')
@Controller('project-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProjectRequestsController {
  constructor(private readonly projectRequestsService: ProjectRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a new project request (Wizard submission)' })
  @ApiResponse({
    status: 201,
    description: 'The project request has been successfully created.',
    type: ProjectRequestEntity,
  })
  async create(
    @GetUser('id') userId: string,
    @Body() createDto: CreateProjectRequestDto,
    @Req() req: any,
  ) {
    // const userId = 'd4e5f6a7-b8c9-0123-defa-234567890123'; // TEST CLIENT ID
    return this.projectRequestsService.create(userId, createDto, req);
  }

  @Get()
  @ApiOperation({ summary: 'Get all project requests (Admin/Broker) or My Requests (Client)' })
  @ApiQuery({ name: 'status', enum: RequestStatus, required: false })
  async getProjectRequests(
    @GetUser() user: UserEntity,
    @Query('status') status?: string
  ) {
    if (user.role === UserRole.CLIENT) {
      return this.projectRequestsService.findAllByClient(user.id);
    }
    return this.projectRequestsService.findAll(status as RequestStatus);
  }

  @Get('drafts/mine')
  @ApiOperation({ summary: 'Get all draft requests for the current user' })
  @ApiResponse({ status: 200, type: [ProjectRequestEntity] })
  async findMyDrafts(@GetUser('id') userId: string) {
    return this.projectRequestsService.findDraftsByClient(userId);
  }

  @Get(':id/matches')
  @ApiOperation({ summary: 'Find matching brokers for a project request' })
  @ApiResponse({ status: 200 })
  async findMatches(@Param('id') id: string) {
      return this.projectRequestsService.findMatches(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single project request by ID' })
  @ApiResponse({ status: 200, description: 'Return the project request details' })
  @ApiResponse({ status: 404, description: 'Project request not found' })
  @ApiResponse({ status: 403, description: 'Forbidden resource' })
  async getOne(@Param('id') id: string, @GetUser() user: UserEntity) {
    return this.projectRequestsService.findOne(id, user);
  }

  @Patch(':id/assign')
  @Roles(UserRole.BROKER)
  async assignBroker(
    @Param('id') id: string,
    @GetUser('id') brokerId: string,
    @Req() req: any,
  ) {
    return this.projectRequestsService.assignBroker(id, brokerId, req);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project request (e.g. save draft)' })
  @ApiResponse({ status: 200, type: ProjectRequestEntity })
  async update(
      @Param('id') id: string, 
      @Body() updateDto: UpdateProjectRequestDto
  ) {
      return this.projectRequestsService.update(id, updateDto);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file for the project request' })
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  uploadFile(@UploadedFile() file: any) {
    // In a real app, upload to S3/Firebase and return URL.
    // Here we just return a mock URL or the filename.
    return {
      filename: file?.originalname,
      url: `/uploads/${file?.originalname}`, // Mock URL
    };
  }
}
