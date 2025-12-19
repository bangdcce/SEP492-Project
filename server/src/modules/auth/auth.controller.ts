import { 
  Controller, 
  Post, 
  Body, 
  HttpCode, 
  HttpStatus, 
  UseGuards, 
  Req,
  ValidationPipe,
  BadRequestException
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBody, 
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards';
import { 
  LoginDto, 
  RegisterDto, 
  AuthResponseDto, 
  LoginResponseDto, 
  LogoutResponseDto 
} from './dto';
import { UserEntity } from '../../database/entities/user.entity';

// Extend Express Request to include user
interface AuthRequest extends Request {
  user: UserEntity;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Đăng ký tài khoản mới',
    description: 'Tạo tài khoản mới với thông tin cơ bản. Chỉ cho phép 3 loại role: CLIENT, BROKER, FREELANCER' 
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Đăng ký thành công',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Đăng ký thành công' },
        user: { $ref: '#/components/schemas/AuthResponseDto' }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Dữ liệu đầu vào không hợp lệ' })
  @ApiConflictResponse({ description: 'Email đã được sử dụng' })
  async register(
    @Body(ValidationPipe) registerDto: RegisterDto,
  ): Promise<{
    message: string;
    user: AuthResponseDto;
  }> {
    try {
      const user = await this.authService.register(registerDto);
      
      return {
        message: 'Đăng ký thành công',
        user,
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Có lỗi xảy ra khi đăng ký'
      );
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Đăng nhập vào hệ thống',
    description: 'Xác thực người dùng bằng email và mật khẩu, trả về access token và refresh token' 
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Đăng nhập thành công',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Đăng nhập thành công' },
        data: { $ref: '#/components/schemas/LoginResponseDto' }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Email hoặc mật khẩu không đúng' })
  @ApiBadRequestResponse({ description: 'Dữ liệu đầu vào không hợp lệ' })
  async login(
    @Body(ValidationPipe) loginDto: LoginDto,
  ): Promise<{
    message: string;
    data: LoginResponseDto;
  }> {
    try {
      const data = await this.authService.login(loginDto);
      
      return {
        message: 'Đăng nhập thành công',
        data,
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Có lỗi xảy ra khi đăng nhập'
      );
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ 
    summary: 'Đăng xuất khỏi hệ thống',
    description: 'Hủy bỏ session hiện tại. Có thể truyền refreshToken để hủy session cụ thể, hoặc để trống để hủy tất cả session' 
  })
  @ApiBody({ 
    required: false,
    schema: {
      type: 'object',
      properties: {
        refreshToken: { 
          type: 'string', 
          description: 'Refresh token cần hủy (tùy chọn)',
          example: 'abc123def456...'
        }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Đăng xuất thành công',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Đăng xuất thành công' }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token không hợp lệ hoặc đã hết hạn' })
  async logout(
    @Req() req: AuthRequest,
    @Body('refreshToken') refreshToken?: string,
  ): Promise<{
    message: string;
  }> {
    try {
      const result = await this.authService.logout(
        req.user.id, 
        refreshToken
      );
      
      return {
        message: result.message,
      };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Có lỗi xảy ra khi đăng xuất'
      );
    }
  }

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ 
    summary: 'Lấy thông tin tài khoản hiện tại',
    description: 'Trả về thông tin chi tiết của người dùng đang đăng nhập' 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Lấy thông tin thành công',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Lấy thông tin tài khoản thành công' },
        user: { $ref: '#/components/schemas/AuthResponseDto' }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token không hợp lệ hoặc đã hết hạn' })
  async getProfile(@Req() req: AuthRequest): Promise<{
    message: string;
    user: AuthResponseDto;
  }> {
    // Service method để map user entity thành response DTO
    const userResponse: AuthResponseDto = {
      id: req.user.id,
      email: req.user.email,
      fullName: req.user.fullName,
      phoneNumber: req.user.phoneNumber,
      role: req.user.role,
      isVerified: req.user.isVerified,
      currentTrustScore: req.user.currentTrustScore,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt,
    };

    return {
      message: 'Lấy thông tin tài khoản thành công',
      user: userResponse,
    };
  }
}