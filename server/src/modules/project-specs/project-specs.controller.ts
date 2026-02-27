import {
  Body,
  Controller,
  Post,
  Patch,
  UseGuards,
  Req,
  Param,
  BadRequestException,
  Get,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProjectSpecsService } from './project-specs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { CreateProjectSpecDto } from './dto/create-project-spec.dto';
import { CreateClientSpecDto } from './dto/create-client-spec.dto';
import { AuditSpecDto, AuditAction } from './dto/audit-spec.dto';
import type { RequestContext } from '../audit-logs/audit-logs.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserEntity } from '../../database/entities/user.entity';

@Controller('project-specs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectSpecsController {
  constructor(private readonly projectSpecsService: ProjectSpecsService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERY ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Staff: get specs pending audit */
  @Get('pending')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  async getPendingSpecs() {
    return this.projectSpecsService.findPendingSpecs();
  }

  /** Client: get specs waiting for my review */
  @Get('client-review')
  @Roles(UserRole.CLIENT)
  async getPendingClientReview(@GetUser() user: UserEntity) {
    return this.projectSpecsService.findPendingClientReview(user.id);
  }

  /** Any party: get specs in final 3-party review */
  @Get('final-review')
  @Roles(UserRole.CLIENT, UserRole.BROKER, UserRole.FREELANCER)
  async getSpecsInFinalReview(@GetUser() user: UserEntity) {
    return this.projectSpecsService.findSpecsInFinalReview(user.id);
  }

  /** Get all specs for a project request */
  @Get('by-request/:requestId')
  async getSpecsByRequest(@Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.projectSpecsService.findSpecsByRequestId(requestId);
  }

  /** Get client spec for a request */
  @Get('client-spec/:requestId')
  async getClientSpec(@Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.projectSpecsService.findClientSpec(requestId);
  }

  /** Get full spec linked to a parent spec */
  @Get('full-spec/:parentSpecId')
  async getFullSpec(@Param('parentSpecId', ParseUUIDPipe) parentSpecId: string) {
    return this.projectSpecsService.findFullSpec(parentSpecId);
  }

  /** Get single spec by ID */
  @Get(':id')
  async getSpec(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectSpecsService.findOne(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: CLIENT SPEC (c_spec)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Broker: create client-readable spec */
  @Post('client-spec')
  @Roles(UserRole.BROKER)
  async createClientSpec(
    @GetUser() user: UserEntity,
    @Body() dto: CreateClientSpecDto,
    @Req() req: RequestContext,
  ) {
    return this.projectSpecsService.createClientSpec(user, dto, req);
  }

  /** Broker: edit existing client-readable spec (DRAFT/REJECTED) */
  @Patch(':id/client-spec')
  @Roles(UserRole.BROKER)
  async updateClientSpec(
    @GetUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClientSpecDto,
    @Req() req: RequestContext,
  ) {
    return this.projectSpecsService.updateClientSpec(user, id, dto, req);
  }

  /** Broker: submit client spec for client review (DRAFT → CLIENT_REVIEW) */
  @Post(':id/submit-for-client-review')
  @Roles(UserRole.BROKER)
  async submitForClientReview(
    @GetUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestContext,
  ) {
    return this.projectSpecsService.submitForClientReview(user, id, req);
  }

  /** Client: approve or reject client spec */
  @Post(':id/client-review')
  @Roles(UserRole.CLIENT)
  async clientReview(
    @GetUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { action: 'APPROVE' | 'REJECT'; reason?: string },
    @Req() req: RequestContext,
  ) {
    return this.projectSpecsService.clientReviewSpec(
      user,
      id,
      body.action,
      body.reason || null,
      req,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: FULL SPEC (full_spec)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Broker: create full technical spec (after client spec approved) */
  @Post('full-spec')
  @Roles(UserRole.BROKER)
  async createFullSpec(
    @GetUser() user: UserEntity,
    @Body() createSpecDto: CreateProjectSpecDto,
    @Req() req: RequestContext,
  ) {
    return this.projectSpecsService.createFullSpec(user, createSpecDto, req);
  }

  /** Broker: edit full technical spec draft (DRAFT/REJECTED only) */
  @Patch(':id/full-spec')
  @Roles(UserRole.BROKER)
  async updateFullSpec(
    @GetUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateProjectSpecDto,
    @Req() req: RequestContext,
  ) {
    return this.projectSpecsService.updateFullSpec(user, id, dto, req);
  }

  /** Broker: submit full spec for 3-party final review (DRAFT → FINAL_REVIEW) */
  @Post(':id/submit-for-final-review')
  @Roles(UserRole.BROKER)
  async submitForFinalReview(
    @GetUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestContext,
  ) {
    return this.projectSpecsService.submitForFinalReview(user, id, req);
  }

  /** Any party: sign the full spec */
  @Post(':id/sign')
  @Roles(UserRole.CLIENT, UserRole.BROKER, UserRole.FREELANCER)
  async signSpec(
    @GetUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestContext,
  ) {
    return this.projectSpecsService.signSpec(user, id, req);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY / STAFF AUDIT
  // ═══════════════════════════════════════════════════════════════════════════

  /** Legacy: create spec (routes to full spec internally) */
  @Post()
  @Roles(UserRole.BROKER)
  async create(
    @GetUser() user: UserEntity,
    @Body() createSpecDto: CreateProjectSpecDto,
    @Req() req: RequestContext,
  ) {
    return this.projectSpecsService.createSpec(user, createSpecDto, req);
  }

  /** Staff: audit spec (approve/reject) */
  @Post(':id/audit')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  async auditSpec(
    @GetUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) id: string,
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
