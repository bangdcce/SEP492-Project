
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProjectRequestsService } from './project-requests.service';
import { CreateProjectRequestDto, UpdateProjectRequestDto } from './dto/create-project-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ProjectRequestEntity } from '../../database/entities/project-request.entity';

@ApiTags('Project Requests')
@Controller('project-requests')
// @UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProjectRequestsController {
  constructor(private readonly projectRequestsService: ProjectRequestsService) {}

  @Post('seed-test-data')
  @ApiOperation({ summary: 'Seed test data for UI verification (Phase 3 & 4)' })
  async seedTestData(@Body('clientId') clientId?: string) {
      const targetClientId = clientId || 'd4e5f6a7-b8c9-0123-defa-234567890123';
      return this.projectRequestsService.seedTestData(targetClientId);
  }

  @Post()
  @ApiOperation({ summary: 'Submit a new project request (Wizard submission)' })
  @ApiResponse({
    status: 201,
    description: 'The project request has been successfully created.',
    type: ProjectRequestEntity,
  })
  async create(
    // @GetUser('id') userId: string,
    @Body() createDto: CreateProjectRequestDto,
    @Req() req: any,
  ) {
    const userId = 'd4e5f6a7-b8c9-0123-defa-234567890123'; // TEST CLIENT ID
    return this.projectRequestsService.create(userId, createDto, req);
  }

  @Get()
  @ApiOperation({ summary: 'Get all project requests for the current user' })
  @ApiResponse({
    status: 200,
    type: [ProjectRequestEntity],
  })
  async findAll(@GetUser('id') userId: string) {
    const testUserId = 'd4e5f6a7-b8c9-0123-defa-234567890123';
    return this.projectRequestsService.findAllByClient(testUserId);
  }

  @Get('drafts/mine')
  @ApiOperation({ summary: 'Get all draft requests for the current user' })
  @ApiResponse({ status: 200, type: [ProjectRequestEntity] })
  async findMyDrafts(@GetUser('id') userId: string) {
    const testUserId = 'd4e5f6a7-b8c9-0123-defa-234567890123';
    return this.projectRequestsService.findDraftsByClient(testUserId);
  }

  @Get(':id/matches')
  @ApiOperation({ summary: 'Find matching brokers for a project request' })
  @ApiResponse({ status: 200 })
  async findMatches(@Param('id') id: string) {
      return this.projectRequestsService.findMatches(id);
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

  @Get(':id')
  @ApiOperation({ summary: 'Get a single project request by ID' })
  @ApiResponse({
    status: 200,
    type: ProjectRequestEntity,
  })
  async findOne(@Param('id') id: string) {
    return this.projectRequestsService.findOne(id);
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

  @Post(':id/invite')
  @ApiOperation({ summary: 'Invite a broker to a project request' })
  @ApiResponse({ status: 201, description: 'Invitation sent' })
  async invite(
      @Param('id') id: string,
      @Body('brokerId') brokerId: string
  ) {
      return this.projectRequestsService.inviteBroker(id, brokerId);
  }

  @Post(':id/apply')
  @ApiOperation({ summary: 'Broker applies to a project request' })
  @ApiResponse({ status: 201, description: 'Application submitted' })
  async apply(
      @Param('id') id: string,
      @GetUser('id') brokerId: string,
      @Body('coverLetter') coverLetter: string
  ) {
      return this.projectRequestsService.applyToRequest(id, brokerId, coverLetter);
  }
  @Post(':id/accept-broker')
  @ApiOperation({ summary: 'Client accepts a broker proposal' })
  @ApiResponse({ status: 200, description: 'Broker accepted' })
  async acceptBroker(
      @Param('id') id: string,
      @Body('brokerId') brokerId: string
  ) {
      return this.projectRequestsService.acceptBroker(id, brokerId);
  }

  @Post(':id/approve-specs')
  @ApiOperation({ summary: 'Client approves the finalized specs' })
  @ApiResponse({ status: 200, description: 'Specs approved' })
  async approveSpecs(@Param('id') id: string) {
      return this.projectRequestsService.approveSpecs(id);
  }

  @Post(':id/convert')
  @ApiOperation({ summary: 'Convert finalized request to project' })
  @ApiResponse({ status: 201, description: 'Project created' })
  async convertToProject(@Param('id') id: string) {
      return this.projectRequestsService.convertToProject(id);
  }
}
