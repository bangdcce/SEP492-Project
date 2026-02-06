import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
  Get,
  Put,
  ValidationPipe,
  Ip,
  Query,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { CaptchaGuard } from '../../common/guards/captcha.guard';
import { JwtAuthGuard } from './guards';
import {
  LoginDto,
  RegisterDto,
  AuthResponseDto,
  LoginResponseDto,
  RefreshTokenResponseDto,
  SecureLoginResponseDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ForgotPasswordResponseDto,
  ResetPasswordResponseDto,
  VerifyOtpDto,
  VerifyOtpResponseDto,
  UpdateProfileDto,
  // CompleteGoogleSignupDto
} from './dto';
import { UserEntity } from '../../database/entities/user.entity';

// Extend Express Request to include user
interface AuthRequest extends Request {
  user: UserEntity;
}

// Google OAuth profile from Passport
/* interface GoogleAuthRequest extends Request {
  user: {
    email: string;
    firstName: string;
    lastName: string;
    picture: string;
  };
} */

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(CaptchaGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute per IP
  @ApiOperation({
    summary: 'Đăng ký tài khoản mới',
    description:
      'Tạo tài khoản mới với thông tin cơ bản. Yêu cầu CAPTCHA và giới hạn 3 lần/phút. Chỉ cho phép 3 loại role: CLIENT, BROKER, FREELANCER',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Đăng ký thành công',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Đăng ký thành công' },
        data: { $ref: '#/components/schemas/AuthResponseDto' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Dữ liệu đầu vào không hợp lệ hoặc CAPTCHA sai' })
  @ApiConflictResponse({ description: 'Email đã được sử dụng' })
  async register(
    @Body(ValidationPipe) registerDto: RegisterDto,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<{
    message: string;
    data: AuthResponseDto;
  }> {
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const user = await this.authService.register(registerDto, ip, userAgent);

    return {
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.',
      data: user,
    };
  }

  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xác thực email',
    description: 'Xác thực địa chỉ email bằng token được gửi qua email',
  })
  @ApiQuery({ name: 'token', description: 'Email verification token', required: true })
  @ApiOkResponse({
    description: 'Email đã được xác thực thành công',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Email verified successfully' },
        email: { type: 'string', example: 'user@example.com' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Token không hợp lệ hoặc đã hết hạn' })
  async verifyEmail(@Query('token') token: string) {
    return this.emailVerificationService.verifyEmail(token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 2, ttl: 300000 } }) // 2 requests per 5 minutes
  @ApiOperation({
    summary: 'Gửi lại email xác thực',
    description: 'Gửi lại email xác thực cho người dùng chưa xác thực email',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email', example: 'user@example.com' },
      },
    },
  })
  @ApiOkResponse({ description: 'Email xác thực đã được gửi lại' })
  @ApiBadRequestResponse({ description: 'Email đã được xác thực hoặc yêu cầu quá nhanh' })
  async resendVerification(@Body('email') email: string) {
    return this.emailVerificationService.resendVerificationEmail(email);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng nhập vào hệ thống',
    description: 'Xác thực người dùng bằng email và mật khẩu, trả về access token và refresh token',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Đăng nhập thành công',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Đăng nhập thành công' },
        data: { $ref: '#/components/schemas/LoginResponseDto' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Email hoặc mật khẩu không đúng' })
  @ApiBadRequestResponse({ description: 'Dữ liệu đầu vào không hợp lệ' })
  async login(
    @Body(ValidationPipe) loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    message: string;
    data: SecureLoginResponseDto;
  }> {
    // Lấy thông tin thiết bị từ request headers
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const ipAddress = req.ip || req.connection?.remoteAddress || 'Unknown IP';

    const timeZone =
      typeof req.headers['x-timezone'] === 'string' ? req.headers['x-timezone'] : undefined;
    const result = await this.authService.login(loginDto, userAgent, ipAddress, timeZone);

    // Set access token as httpOnly cookie
    response.cookie('accessToken', result.accessToken, {
      httpOnly: true, // Prevent XSS attacks
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax', // CSRF protection while allowing cross-site navigation
      maxAge: 15 * 60 * 1000, // 15 minutes (same as JWT expiry)
      path: '/', // Available for all routes
    });

    // Set refresh token as httpOnly cookie
    response.cookie('refreshToken', result.refreshToken, {
      httpOnly: true, // Prevent XSS attacks
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax', // CSRF protection while allowing cross-site navigation
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/', // Available for all routes
    });

    // Return response without tokens (they're now in cookies)
    const { refreshToken, accessToken, ...dataWithoutTokens } = result;

    return {
      message: 'Đăng nhập thành công',
      data: dataWithoutTokens,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Đăng xuất khỏi hệ thống',
    description: 'Hủy bỏ session hiện tại. Refresh token sẽ được đọc từ httpOnly cookie',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Đăng xuất thành công',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Đăng xuất thành công' },
        data: { type: 'null', example: null },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Token không hợp lệ hoặc đã hết hạn' })
  async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    message: string;
    data: null;
  }> {
    // Lấy refresh token từ cookie
    const refreshToken = req.cookies?.refreshToken;

    const result = await this.authService.logout(req.user.id, refreshToken);

    // Clear both access token and refresh token cookies
    response.clearCookie('accessToken', {
      path: '/',
      httpOnly: true,
    });
    response.clearCookie('refreshToken', {
      path: '/',
      httpOnly: true,
    });

    return {
      message: result.message,
      data: null,
    };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Lấy thông tin tài khoản hiện tại',
    description: 'Trả về thông tin chi tiết của người dùng đang đăng nhập',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy thông tin thành công',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Lấy thông tin tài khoản thành công' },
        data: { $ref: '#/components/schemas/AuthResponseDto' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Token không hợp lệ hoặc đã hết hạn' })
  async getProfile(@Req() req: AuthRequest): Promise<{
    message: string;
    data: AuthResponseDto;
  }> {
    // Fetch user with profile to get all profile data
    const userWithProfile = await this.authService.findUserWithProfile(req.user.id);

    // Service method để map user entity thành response DTO
    const userResponse: AuthResponseDto = {
      id: req.user.id,
      email: req.user.email,
      fullName: req.user.fullName,
      phoneNumber: req.user.phoneNumber,
      timeZone: req.user.timeZone,
      avatarUrl: userWithProfile?.profile?.avatarUrl,
      bio: userWithProfile?.profile?.bio,
      companyName: userWithProfile?.profile?.companyName,
      skills: userWithProfile?.profile?.skills,
      linkedinUrl: userWithProfile?.profile?.linkedinUrl,
      cvUrl: userWithProfile?.profile?.cvUrl,
      portfolioLinks: userWithProfile?.profile?.portfolioLinks,
      role: req.user.role,
      isVerified: req.user.isVerified,
      currentTrustScore: req.user.currentTrustScore,
      badge: req.user.badge || 'NORMAL',
      stats: {
        finished: 0, // TODO: Calculate from completed projects
        disputes: 0, // TODO: Calculate from lost disputes
        score: req.user.currentTrustScore,
      },
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt,
    };

    return {
      message: 'Lấy thông tin tài khoản thành công',
      data: userResponse,
    };
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cập nhật thông tin profile' })
  @ApiOkResponse({
    description: 'Cập nhật thành công',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Cập nhật thông tin thành công' },
        data: { type: 'object' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Token không hợp lệ hoặc đã hết hạn' })
  async updateProfile(
    @Req() req: AuthRequest,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<{
    message: string;
    data: AuthResponseDto;
  }> {
    const updatedUser = await this.authService.updateProfile(req.user.id, updateProfileDto);

    return {
      message: 'Cập nhật thông tin thành công',
      data: updatedUser,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Làm mới access token',
    description: 'Sử dụng refresh token từ httpOnly cookie để lấy access token mới',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Làm mới token thành công',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Làm mới token thành công' },
        data: {
          type: 'object',
          properties: {
            accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Refresh token không hợp lệ hoặc đã hết hạn' })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    message: string;
    data: { accessToken: string };
  }> {
    // Đọc refresh token từ cookie
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new Error('Refresh token not found in cookies');
    }

    const tokens = await this.authService.refreshToken(refreshToken);

    // Set new access token as httpOnly cookie
    response.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    // Set new refresh token as httpOnly cookie
    response.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    // Không trả về tokens trong response body
    return {
      message: 'Làm mới token thành công',
      data: {},
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gửi OTP reset password qua SMS',
    description: 'Gửi mã OTP 6 số đến số điện thoại đã đăng ký',
  })
  @ApiBody({
    type: ForgotPasswordDto,
    description: 'Số điện thoại của tài khoản cần reset password',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'OTP đã được gửi qua SMS',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Mã OTP đã được gửi' },
        data: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Mã OTP đã được gửi đến số điện thoại của bạn' },
            phoneNumber: { type: 'string', example: '0123***789' },
            expiresIn: { type: 'number', example: 300 },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Số điện thoại không hợp lệ' })
  async forgotPassword(@Body(ValidationPipe) forgotPasswordDto: ForgotPasswordDto): Promise<{
    message: string;
    data: ForgotPasswordResponseDto;
  }> {
    const result = await this.authService.forgotPassword(forgotPasswordDto);

    return {
      message: 'Mã OTP đã được gửi',
      data: result,
    };
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xác thực mã OTP',
    description: 'Kiểm tra mã OTP có hợp lệ không (optional, có thể bỏ qua)',
  })
  @ApiBody({
    type: VerifyOtpDto,
    description: 'Số điện thoại và mã OTP',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Kết quả xác thực OTP',
  })
  async verifyOtp(@Body(ValidationPipe) verifyOtpDto: VerifyOtpDto): Promise<{
    message: string;
    data: VerifyOtpResponseDto;
  }> {
    const result = await this.authService.verifyOtp(verifyOtpDto);

    return {
      message: result.isValid ? 'OTP hợp lệ' : 'OTP không hợp lệ',
      data: result,
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đặt lại mật khẩu với OTP',
    description: 'Sử dụng mã OTP để đặt lại mật khẩu mới',
  })
  @ApiBody({
    type: ResetPasswordDto,
    description: 'Số điện thoại, OTP và mật khẩu mới',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Đặt lại mật khẩu thành công',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Đặt lại mật khẩu thành công' },
        data: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.',
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'OTP không hợp lệ hoặc đã hết hạn' })
  @ApiBadRequestResponse({ description: 'Dữ liệu đầu vào không hợp lệ' })
  async resetPassword(@Body(ValidationPipe) resetPasswordDto: ResetPasswordDto): Promise<{
    message: string;
    data: ResetPasswordResponseDto;
  }> {
    const result = await this.authService.resetPassword(resetPasswordDto);

    return {
      message: 'Đặt lại mật khẩu thành công',
      data: result,
    };
  }

  // ==========================================
  // Google OAuth Routes - TEMPORARILY DISABLED
  // ==========================================

  /* @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  async googleAuth(@Req() req: any) {
    // Query param 'prompt' will be automatically passed to Google OAuth
    // e.g., /auth/google?prompt=select_account
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthCallback(@Req() req: GoogleAuthRequest, @Res() res: Response) {
    const googleProfile = req.user;
    
    const result = await this.authService.googleAuth({
      email: googleProfile.email,
      firstName: googleProfile.firstName,
      lastName: googleProfile.lastName,
      picture: googleProfile.picture,
    });

    if ('isNewUser' in result && result.isNewUser) {
      // New user - redirect to frontend with profile data to complete signup
      const params = new URLSearchParams({
        isNewUser: 'true',
        email: result.profile.email,
        fullName: result.profile.fullName,
        picture: result.profile.picture || '',
      });
      
      return res.redirect(`${process.env.FRONTEND_URL}/auth/google-complete?${params.toString()}`);
    }
    
    // Existing user - redirect with tokens
    const loginResult = result as LoginResponseDto;
    const params = new URLSearchParams({
      accessToken: loginResult.accessToken,
      refreshToken: loginResult.refreshToken,
    });
    
    return res.redirect(`${process.env.FRONTEND_URL}/auth/google-success?${params.toString()}`);
  }

  @Post('google/complete-signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Complete Google OAuth signup with role and phone' })
  @ApiBody({ type: CompleteGoogleSignupDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Hoàn tất đăng ký Google OAuth thành công',
    type: LoginResponseDto,
  })
  async completeGoogleSignup(
    @Body(ValidationPipe) body: CompleteGoogleSignupDto,
  ): Promise<LoginResponseDto> {
    return await this.authService.completeGoogleSignup(
      body.email,
      body.fullName,
      body.phoneNumber,
      body.role,
      body.picture,
    );
  } */
}
