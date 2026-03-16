import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuditLogsService } from './audit-logs.service';
import { GetAuditLogsDto } from './dto/get-audit-logs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from 'src/database/entities';

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
  async export(@Query() query: GetAuditLogsDto, @Res() res: Response) {
    const exported = await this.auditLogsService.exportLogs(query);
    res.setHeader('Content-Type', exported.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exported.fileName}"`);
    res.send(exported.buffer);
  }
}
