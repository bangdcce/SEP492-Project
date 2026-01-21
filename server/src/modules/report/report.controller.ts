import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from 'src/database/entities';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  /**
   * User tạo report cho một review vi phạm
   */
  @Post()
  @ApiOperation({ summary: 'Report một review vi phạm' })
  @ApiResponse({ status: 201, description: 'Report created successfully' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateReportDto, @GetUser('id') reporterId: string) {
    return this.reportService.create(reporterId, dto);
  }

  /**
   * [ADMIN] Lấy danh sách reports đang chờ xử lý
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Lấy danh sách reports chờ xử lý' })
  async findPending(@Query('page') page: string = '1', @Query('limit') limit: string = '20') {
    return this.reportService.findPending(parseInt(page), parseInt(limit));
  }

  /**
   * [ADMIN] Xem chi tiết một report
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Xem chi tiết report' })
  async findOne(@Param('id') id: string) {
    return this.reportService.findOne(id);
  }

  /**
   * [ADMIN] Resolve một report (chấp nhận hoặc từ chối)
   */
  @Patch(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Xử lý report (resolve/reject)' })
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
    @GetUser('id') adminId: string,
  ) {
    return this.reportService.resolve(id, dto, adminId);
  }
}
