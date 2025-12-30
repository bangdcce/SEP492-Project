
import {
  Body,
  Controller,
  Get,
  Param,
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
import { CreateProjectRequestDto } from './dto/create-project-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ProjectRequestEntity } from '../../database/entities/project-request.entity';

@ApiTags('Project Requests')
@Controller('project-requests')
@UseGuards(JwtAuthGuard)
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
    return this.projectRequestsService.create(userId, createDto, req);
  }

  @Get()
  @ApiOperation({ summary: 'Get all project requests for the current user' })
  @ApiResponse({
    status: 200,
    type: [ProjectRequestEntity],
  })
  async findAll(@GetUser('id') userId: string) {
    return this.projectRequestsService.findAllByClient(userId);
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
}
