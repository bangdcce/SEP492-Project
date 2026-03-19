import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuditLogsService } from './audit-logs.service';
import { GetAuditLogsDto } from './dto/get-audit-logs.dto';
import { CreateClientAuditEventsDto } from './dto/create-client-audit-events.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from 'src/database/entities';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  async findAll(@Query() query: GetAuditLogsDto) {
    return this.auditLogsService.findAll(query);
  }

  @Get('export')
  async export(
    @Query() query: GetAuditLogsDto,
    @Req() req: Request,
    @GetUser('id') actorId: string,
    @Res() res: Response,
  ) {
    const exported = await this.auditLogsService.exportLogs(query);

    await this.auditLogsService.log({
      actorId: actorId || ((req.user as { id?: string } | undefined)?.id ?? 'anonymous'),
      action: 'EXPORT',
      entityType: 'AuditLog',
      entityId: 'filtered-export',
      req,
      source: 'SERVER',
      eventCategory: 'EXPORT',
      eventName: 'audit-log-export',
      statusCode: 200,
      metadata: {
        format: query.format ?? 'json',
        filters: query,
      },
    });

    res.setHeader('Content-Type', exported.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exported.fileName}"`);
    res.send(exported.buffer);
  }

  @Post('client-events')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  async ingestClientEvents(
    @Body() dto: CreateClientAuditEventsDto,
    @Req() req: Request,
    @GetUser('id') actorId: string,
  ) {
    return this.auditLogsService.ingestClientEvents(actorId, dto.events, req);
  }

  @Get(':id/timeline')
  async getTimeline(@Param('id') id: string) {
    return this.auditLogsService.getTimeline(id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.auditLogsService.findOne(id);
  }
}
