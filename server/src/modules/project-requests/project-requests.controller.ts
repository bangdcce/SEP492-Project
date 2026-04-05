import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  getProjectRequestSignedUrl,
  uploadProjectRequestFile,
} from '../../common/utils/supabase-object-storage.util';

// Define MulterFile interface manually to avoid namespace issues
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

interface UploadedFilesMap {
  requirements?: MulterFile[];
  attachments?: MulterFile[];
}
import { ProjectRequestsService } from './project-requests.service';
import {
  RequestStatus,
  ProjectRequestEntity,
} from '../../database/entities/project-request.entity';
import { Roles, JwtAuthGuard, RolesGuard } from '../auth';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole, UserEntity } from '../../database/entities/user.entity';
import type { RequestContext } from '../audit-logs/audit-logs.service';
import { CreateProjectRequestDto, UpdateProjectRequestDto } from './dto/create-project-request.dto';
import {
  CreateCommercialChangeRequestDto,
  RespondCommercialChangeRequestDto,
} from './dto/commercial-change-request.dto';

const REQUEST_ATTACHMENT_WHITELIST = {
  mimeTypes: new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'text/csv',
  ]),
  extensions: new Set([
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.txt',
    '.csv',
  ]),
};

@ApiTags('Project Requests')
@Controller('project-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProjectRequestsController {
  constructor(private readonly projectRequestsService: ProjectRequestsService) {}

  private async persistRequestUpload(
    file: MulterFile,
    category: 'requirements' | 'attachment',
    ownerId: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException(`Missing uploaded file for ${category}`);
    }

    const storagePath = await uploadProjectRequestFile(
      file.buffer,
      ownerId,
      file.originalname,
      file.mimetype,
    );

    return {
      filename: file.originalname,
      storagePath,
      url: await getProjectRequestSignedUrl(storagePath),
      mimetype: file.mimetype,
      size: file.size,
      category,
    };
  }

  private assertFilesAllowed(files: MulterFile[] = []) {
    for (const file of files) {
      const original = String(file.originalname || '').toLowerCase();
      const extension = original.includes('.') ? original.slice(original.lastIndexOf('.')) : '';
      const mime = String(file.mimetype || '').toLowerCase();
      if (
        !REQUEST_ATTACHMENT_WHITELIST.mimeTypes.has(mime) &&
        !REQUEST_ATTACHMENT_WHITELIST.extensions.has(extension)
      ) {
        throw new BadRequestException(
          `Unsupported attachment type for "${file.originalname}". Allowed formats: PDF, Office, PNG, JPG, WEBP, TXT, CSV.`,
        );
      }
    }
  }

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
    @GetUser('id') userId: string,
    @Body() createDto: CreateProjectRequestDto,
    @Req() req: RequestContext,
  ) {
    // const userId = 'd4e5f6a7-b8c9-0123-defa-234567890123'; // TEST CLIENT ID
    return this.projectRequestsService.create(userId, createDto, req);
  }

  @Get()
  @ApiOperation({ summary: 'Get all project requests (Admin/Broker) or My Requests (Client)' })
  @ApiQuery({ name: 'status', enum: RequestStatus, required: false })
  async getProjectRequests(@GetUser() user: UserEntity, @Query('status') status?: string) {
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

  @Get('invitations/my')
  @ApiOperation({ summary: 'Get invitations for the current user (Broker/Freelancer)' })
  @ApiResponse({ status: 200, description: 'List of invitations' })
  async getMyInvitations(@GetUser() user: UserEntity) {
    return this.projectRequestsService.getInvitationsForUser(user.id, user.role);
  }

  @Get('freelancer/requests/my')
  @Roles(UserRole.FREELANCER)
  @ApiOperation({ summary: 'Get request access list for freelancer (invited/accepted)' })
  @ApiResponse({ status: 200, description: 'List of freelancer-accessible requests' })
  async getFreelancerRequestAccessList(@GetUser() user: UserEntity) {
    return this.projectRequestsService.getFreelancerRequestAccessList(user.id);
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
    @Req() req: RequestContext,
  ) {
    return this.projectRequestsService.assignBroker(id, brokerId, req);
  }

  @Patch(':id')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Update a project request (e.g. save draft)' })
  @ApiResponse({ status: 200, type: ProjectRequestEntity })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateProjectRequestDto,
    @GetUser() user: UserEntity,
    @Req() req: RequestContext,
  ) {
    return this.projectRequestsService.update(id, updateDto, user, req);
  }

  @Post(':id/publish')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Publish a project request to the marketplace' })
  @ApiResponse({ status: 200, description: 'Request published to marketplace' })
  async publish(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @Req() req: RequestContext,
  ) {
    return this.projectRequestsService.publish(id, userId, req);
  }

  @Delete(':id')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Delete a project request (draft only, no broker/freelancer assigned)' })
  @ApiResponse({ status: 200, description: 'Request deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete request in this state' })
  @ApiResponse({ status: 403, description: 'Not authorized to delete this request' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async delete(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @Req() req: RequestContext,
  ) {
    return this.projectRequestsService.deleteRequest(id, userId, req);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file for the project request' })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'requirements', maxCount: 1 },
      { name: 'attachments', maxCount: 10 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        requirements: {
          type: 'string',
          format: 'binary',
        },
        attachments: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  async uploadFile(@UploadedFiles() files: UploadedFilesMap, @GetUser('id') userId: string) {
    try {
      this.assertFilesAllowed([...(files.requirements || []), ...(files.attachments || [])]);

      const result = {
        requirements: await Promise.all(
          (files.requirements || []).map((file) =>
            this.persistRequestUpload(file, 'requirements', userId),
          ),
        ),
        attachments: await Promise.all(
          (files.attachments || []).map((file) =>
            this.persistRequestUpload(file, 'attachment', userId),
          ),
        ),
      };

      console.log(
        `Upload File Successful: requirements=${result.requirements.length} attachments=${result.attachments.length}`,
      );
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Upload File Failed: ${message}`);
      throw error;
    }
  }

  @Post(':id/commercial-change-requests')
  @Roles(UserRole.BROKER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Broker proposes a commercial change request for an approved client spec baseline' })
  async createCommercialChangeRequest(
    @Param('id') id: string,
    @GetUser() user: UserEntity,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    body: CreateCommercialChangeRequestDto,
    @Req() req: RequestContext,
  ) {
    return this.projectRequestsService.createCommercialChangeRequest(id, user, body, req);
  }

  @Post(':id/commercial-change-requests/:changeRequestId/respond')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Client approves or rejects a commercial change request' })
  async respondCommercialChangeRequest(
    @Param('id') id: string,
    @Param('changeRequestId') changeRequestId: string,
    @GetUser() user: UserEntity,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    body: RespondCommercialChangeRequestDto,
    @Req() req: RequestContext,
  ) {
    return this.projectRequestsService.respondCommercialChangeRequest(
      id,
      changeRequestId,
      user,
      body,
      req,
    );
  }

  @Post(':id/invite/broker')
  @ApiOperation({ summary: 'Invite a broker to a project request' })
  @ApiResponse({ status: 201, description: 'Invitation sent' })
  async inviteBroker(
    @Param('id') id: string,
    @GetUser('id') inviterId: string,
    @Body('brokerId') brokerId: string,
    @Body('message') message?: string,
  ) {
    return this.projectRequestsService.inviteBroker(id, brokerId, message, inviterId);
  }

  @Post(':id/invite/freelancer')
  @Roles(UserRole.BROKER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Invite a freelancer to a project request (Phase 3)' })
  @ApiResponse({ status: 201, description: 'Invitation sent' })
  async inviteFreelancer(
    @Param('id') id: string,
    @GetUser() user: UserEntity,
    @Body('freelancerId') freelancerId: string,
    @Body('message') message?: string,
  ) {
    return this.projectRequestsService.inviteFreelancer(id, freelancerId, message, user);
  }

  @Post(':id/approve-freelancer-invite')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Client approves a broker freelancer recommendation' })
  @ApiResponse({ status: 200, description: 'Freelancer recommendation approved' })
  async approveFreelancerInvite(
    @Param('id') id: string,
    @GetUser('id') clientId: string,
    @Body('proposalId') proposalId: string,
  ) {
    return this.projectRequestsService.approveFreelancerInvite(id, proposalId, clientId);
  }

  @Post(':id/reject-freelancer-invite')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Client rejects a broker freelancer recommendation' })
  @ApiResponse({ status: 200, description: 'Freelancer recommendation rejected' })
  async rejectFreelancerInvite(
    @Param('id') id: string,
    @GetUser('id') clientId: string,
    @Body('proposalId') proposalId: string,
  ) {
    return this.projectRequestsService.rejectFreelancerInvite(id, proposalId, clientId);
  }

  @Post(':id/apply')
  @Roles(UserRole.BROKER)
  @ApiOperation({ summary: 'Broker applies to a project request' })
  @ApiResponse({ status: 201, description: 'Application submitted' })
  async apply(
    @Param('id') id: string,
    @GetUser('id') brokerId: string,
    @Body('coverLetter') coverLetter: string,
  ) {
    return this.projectRequestsService.applyToRequest(id, brokerId, coverLetter);
  }
  @Post(':id/accept-broker')
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Client accepts a broker proposal' })
  @ApiResponse({ status: 200, description: 'Broker accepted' })
  async acceptBroker(
    @Param('id') id: string,
    @GetUser('id') clientId: string,
    @Body('brokerId') brokerId: string,
  ) {
    return this.projectRequestsService.acceptBroker(id, brokerId, clientId);
  }

  @Post(':id/release-broker-slot')
  @ApiOperation({ summary: 'Release an active broker application slot for this request' })
  async releaseBrokerSlot(
    @Param('id') id: string,
    @Body('proposalId') proposalId: string,
    @GetUser() user: UserEntity,
  ) {
    return this.projectRequestsService.releaseBrokerSlot(id, proposalId, user);
  }

  @Post(':id/approve-specs')
  @ApiOperation({ summary: 'Client approves the finalized specs' })
  @ApiResponse({ status: 200, description: 'Specs approved' })
  async approveSpecs(@Param('id') id: string) {
    return this.projectRequestsService.approveSpecs(id);
  }

  @Post(':id/convert')
  @Roles(UserRole.BROKER, UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Convert finalized request to project' })
  @ApiResponse({ status: 201, description: 'Project created' })
  async convertToProject(@Param('id') id: string, @GetUser() user: UserEntity) {
    return this.projectRequestsService.convertToProject(id, user);
  }

  @Patch('invitations/:id/respond')
  @ApiOperation({ summary: 'Respond to an invitation (Accept/Reject)' })
  @ApiResponse({ status: 200, description: 'Response recorded' })
  async respondToInvitation(
    @Param('id') id: string,
    @GetUser() user: UserEntity,
    @Body('status') status: 'ACCEPTED' | 'REJECTED',
  ) {
    return this.projectRequestsService.respondToInvitation(id, user.id, user.role, status);
  }
}
