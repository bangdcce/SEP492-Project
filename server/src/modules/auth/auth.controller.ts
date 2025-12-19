import { 
  Controller, 
  Post, 
  Body, 
  HttpCode, 
  HttpStatus, 
  UseGuards, 
  Req,
  ValidationPipe
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
  LogoutResponseDto,
  RefreshTokenResponseDto
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
        data: { $ref: '#/components/schemas/AuthResponseDto' }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Dữ liệu đầu vào không hợp lệ' })
  @ApiConflictResponse({ description: 'Email đã được sử dụng' })
  async register(
    @Body(ValidationPipe) registerDto: RegisterDto,
  ): Promise<{
    message: string;
    data: AuthResponseDto;
  }> {
    const user = await this.authService.register(registerDto);
    
    return {
      message: 'Đăng ký thành công',
      data: user,
    };
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
    @Req() req: any,
  ): Promise<{
    message: string;
    data: LoginResponseDto;
  }> {
    // Lấy thông tin thiết bị từ request headers
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const ipAddress = req.ip || req.connection?.remoteAddress || 'Unknown IP';
    
    const data = await this.authService.login(
      loginDto, 
      userAgent, 
      ipAddress
    );
    
    return {
      message: 'Đăng nhập thành công',
      data,
    };
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
        message: { type: 'string', example: 'Đăng xuất thành công' },
        data: { type: 'null', example: null }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token không hợp lệ hoặc đã hết hạn' })
  async logout(
    @Req() req: AuthRequest,
    @Body('refreshToken') refreshToken?: string,
  ): Promise<{
    message: string;
    data: null;
  }> {
    const result = await this.authService.logout(
      req.user.id, 
      refreshToken
    );
    
    return {
      message: result.message,
      data: null,
    };
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
        data: { $ref: '#/components/schemas/AuthResponseDto' }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token không hợp lệ hoặc đã hết hạn' })
  async getProfile(@Req() req: AuthRequest): Promise<{
    message: string;
    data: AuthResponseDto;
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
      data: userResponse,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Làm mới access token',
    description: 'Sử dụng refresh token để lấy access token mới và refresh token mới' 
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['refreshToken'],
      properties: {
        refreshToken: { 
          type: 'string', 
          description: 'Refresh token từ login',
          example: 'abc123def456...'
        }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Làm mới token thành công',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Làm mới token thành công' },
        data: { $ref: '#/components/schemas/RefreshTokenResponseDto' }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Refresh token không hợp lệ hoặc đã hết hạn' })
  @ApiBadRequestResponse({ description: 'Dữ liệu đầu vào không hợp lệ' })
  async refreshToken(
    @Body('refreshToken') refreshToken: string,
  ): Promise<{
    message: string;
    data: RefreshTokenResponseDto;
  }> {
    const tokens = await this.authService.refreshToken(refreshToken);
    
    return {
      message: 'Làm mới token thành công',
      data: tokens,
    };
  }
}