import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WizardService } from './wizard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { UpdateWizardQuestionDto } from './dto/update-wizard-question.dto';
import { CreateWizardQuestionDto } from './dto/create-wizard-question.dto';

@ApiTags('Admin - Wizard Questions')
@Controller('admin/wizard/questions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class WizardAdminController {
  constructor(private readonly wizardService: WizardService) {}

  @Post()
  @ApiOperation({ summary: '(Admin) Tạo mới một câu hỏi Wizard' })
  @ApiResponse({
    status: 201,
    description: 'Question created successfully',
  })
  async createQuestion(@Body() createDto: CreateWizardQuestionDto) {
    return this.wizardService.createQuestion(createDto);
  }

  @Get()
  @ApiOperation({ summary: '(Admin) Xem danh sách câu hỏi hiện tại của Wizard tạo Request' })
  @ApiResponse({
    status: 200,
    description: 'List of all wizard questions (including inactive)',
  })
  async getAllQuestions() {
    return this.wizardService.getAllQuestionsForAdmin();
  }

  @Get(':id')
  @ApiOperation({ summary: '(Admin) Xem chi tiết câu hình câu hỏi và các lựa chọn trả lời' })
  @ApiResponse({
    status: 200,
    description: 'Detailed wizard question with options',
  })
  async getQuestionDetail(@Param('id', ParseIntPipe) id: number) {
    return this.wizardService.getQuestionDetailForAdmin(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '(Admin) Chỉnh sửa nội dung câu hỏi Wizard để tối ưu trải nghiệm' })
  @ApiResponse({
    status: 200,
    description: 'Question updated successfully',
  })
  async updateQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateWizardQuestionDto,
  ) {
    return this.wizardService.updateQuestion(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '(Admin) Xóa câu hỏi khỏi quy trình Wizard' })
  @ApiResponse({
    status: 200,
    description: 'Question deleted successfully',
  })
  async deleteQuestion(@Param('id', ParseIntPipe) id: number) {
    return this.wizardService.deleteQuestion(id);
  }
}
