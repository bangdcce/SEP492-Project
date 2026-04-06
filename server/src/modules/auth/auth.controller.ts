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
  UnauthorizedException,
  Logger,
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
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { buildAuthCookiePolicy, type AuthCookiePolicy } from './auth-cookie.util';
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
  DeleteAccountDto,
  // CompleteGoogleSignupDto
} from './dto';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { StaffApplicationStatus } from '../../database/entities/staff-application.entity';

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
  private readonly logger = new Logger(AuthController.name);
  private readonly cookiePolicy: AuthCookiePolicy;

  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly configService: ConfigService,
  ) {
    this.cookiePolicy = buildAuthCookiePolicy(this.configService);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(CaptchaGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute per IP
  @ApiOperation({
    summary: 'Register a new account',
    description:
      'Create a new account with user-supplied information. Requires CAPTCHA and is limited to 3 requests per minute. Self-registration supports CLIENT, BROKER, and FREELANCER roles only.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Registration completed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Registration completed successfully' },
        data: { $ref: '#/components/schemas/AuthResponseDto' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data or CAPTCHA verification failed',
  })
  @ApiConflictResponse({ description: 'Email already in use' })
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
      message: 'Registration completed successfully. Please check your email to verify the account.',
      data: user,
    };
  }

  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email address',
    description: 'Verify the user email address using the token sent by email',
  })
  @ApiQuery({ name: 'token', description: 'Email verification token', required: true })
  @ApiOkResponse({
    description: 'Email verified successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Email verified successfully' },
        email: { type: 'string', example: 'user@example.com' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Token is invalid or has expired' })
  async verifyEmail(@Query('token') token: string) {
    return this.emailVerificationService.verifyEmail(token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 2, ttl: 300000 } }) // 2 requests per 5 minutes
  @ApiOperation({
    summary: 'Resend verification email',
    description: 'Send a new verification email to a user whose email is not yet verified',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email', example: 'user@example.com' },
      },
    },
  })
  @ApiOkResponse({ description: 'Verification email sent again successfully' })
  @ApiBadRequestResponse({
    description: 'Email is already verified or the resend request is too frequent',
  })
  async resendVerification(@Body('email') email: string) {
    return this.emailVerificationService.resendVerificationEmail(email);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in to the platform',
    description:
      'Authenticate a user with email and password, then issue access and refresh tokens',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Login successful' },
        data: { $ref: '#/components/schemas/LoginResponseDto' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Email or password is incorrect' })
  @ApiBadRequestResponse({ description: 'Invalid login payload' })
  async login(
    @Body(ValidationPipe) loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    message: string;
    data: SecureLoginResponseDto;
  }> {
    // Read device metadata from request headers.
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const ipAddress = req.ip || req.connection?.remoteAddress || 'Unknown IP';

    const timeZone =
      typeof req.headers['x-timezone'] === 'string' ? req.headers['x-timezone'] : undefined;
    const result = await this.authService.login(loginDto, userAgent, ipAddress, timeZone);

    response.cookie('accessToken', result.accessToken, this.cookiePolicy.accessToken);
    response.cookie('refreshToken', result.refreshToken, this.cookiePolicy.refreshToken);

    // Return response without tokens (they're now in cookies)
    const { refreshToken, accessToken, ...dataWithoutTokens } = result;

    return {
      message: 'Login successful',
      data: dataWithoutTokens,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Sign out of the platform',
    description:
      'Terminate the current session. The refresh token is read from the httpOnly cookie.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logout successful',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Logout successful' },
        data: { type: 'null', example: null },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Token is invalid or has expired' })
  async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    message: string;
    data: null;
  }> {
    // Read the refresh token from cookies.
    const refreshToken = req.cookies?.refreshToken;

    const result = await this.authService.logout(req.user.id, refreshToken);

    response.clearCookie('accessToken', this.cookiePolicy.clear);
    response.clearCookie('refreshToken', this.cookiePolicy.clear);

    return {
      message: result.message,
      data: null,
    };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get current account information',
    description: 'Return the full profile of the currently signed-in user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Account information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Account information retrieved successfully' },
        data: { $ref: '#/components/schemas/AuthResponseDto' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Token is invalid or has expired' })
  async getProfile(@Req() req: AuthRequest): Promise<{
    message: string;
    data: AuthResponseDto;
  }> {
    const userWithProfile = await this.authService.findUserWithProfile(req.user.id);

    if (!userWithProfile) {
      throw new UnauthorizedException({
        error: 'SESSION_REVOKED',
        message: 'Authenticated user not found',
      });
    }

    const certifications = Array.isArray(userWithProfile?.profile?.bankInfo?.certifications)
      ? userWithProfile.profile.bankInfo.certifications
      : undefined;

    const staffApprovalStatus =
      userWithProfile.role === UserRole.STAFF
        ? userWithProfile.staffApplication?.status ||
          (userWithProfile.isVerified
            ? StaffApplicationStatus.APPROVED
            : StaffApplicationStatus.PENDING)
        : undefined;

    const userResponse: AuthResponseDto = {
      id: userWithProfile.id,
      email: userWithProfile.email,
      fullName: userWithProfile.fullName,
      phoneNumber: userWithProfile.phoneNumber,
      timeZone: userWithProfile.timeZone,
      avatarUrl: userWithProfile?.profile?.avatarUrl,
      bio: userWithProfile?.profile?.bio,
      companyName: userWithProfile?.profile?.companyName,
      skills: userWithProfile?.profile?.skills,
      linkedinUrl: userWithProfile?.profile?.linkedinUrl,
      cvUrl: userWithProfile?.profile?.cvUrl,
      portfolioLinks: userWithProfile?.profile?.portfolioLinks,
      ...(certifications !== undefined ? { certifications } : {}),
      role: userWithProfile.role,
      isVerified: userWithProfile.isVerified,
      isEmailVerified: !!userWithProfile.emailVerifiedAt,
      ...(staffApprovalStatus
        ? {
            staffApprovalStatus,
            staffApplicationReviewedAt: userWithProfile.staffApplication?.reviewedAt ?? null,
            staffRejectionReason: userWithProfile.staffApplication?.rejectionReason ?? null,
          }
        : {}),
      currentTrustScore: userWithProfile.currentTrustScore,
      badge: userWithProfile.badge || 'NORMAL',
      stats: {
        finished: userWithProfile.totalProjectsFinished || 0,
        disputes: userWithProfile.totalDisputesLost || 0,
        score: Number(userWithProfile.currentTrustScore) || 0,
      },
      createdAt: userWithProfile.createdAt,
      updatedAt: userWithProfile.updatedAt,
    };

    return {
      message: 'Account information retrieved successfully',
      data: userResponse,
    };
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update profile information' })
  @ApiOkResponse({
    description: 'Profile updated successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Profile updated successfully' },
        data: { type: 'object' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Token is invalid or has expired' })
  async updateProfile(
    @Req() req: AuthRequest,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<{
    message: string;
    data: AuthResponseDto;
  }> {
    const updatedUser = await this.authService.updateProfile(req.user.id, updateProfileDto);

    return {
      message: 'Profile updated successfully',
      data: updatedUser,
    };
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get authenticated session snapshot',
    description: 'Lightweight endpoint for frontend bootstrap to verify current signed-in session.',
  })
  @ApiOkResponse({
    description: 'Session is valid',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Session is valid' },
        data: { $ref: '#/components/schemas/AuthResponseDto' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Session is invalid or expired' })
  async getSession(@Req() req: AuthRequest): Promise<{
    message: string;
    data: AuthResponseDto;
  }> {
    const sessionUser = await this.authService.getSessionUser(req.user.id);
    return {
      message: 'Session is valid',
      data: sessionUser,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Use the refresh token from the httpOnly cookie to issue a new access token',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Token refreshed successfully' },
        data: {
          type: 'object',
          properties: {
            accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Refresh token is invalid or has expired',
  })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    message: string;
    data: Record<string, never>;
  }> {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException({
        error: 'INVALID_REFRESH',
        message: 'Refresh token not found in cookies',
      });
    }

    try {
      const tokens = await this.authService.refreshToken(refreshToken);

      response.cookie('accessToken', tokens.accessToken, this.cookiePolicy.accessToken);
      response.cookie('refreshToken', tokens.refreshToken, this.cookiePolicy.refreshToken);

      return {
        message: 'Token refreshed successfully',
        data: {},
      };
    } catch (error) {
      response.clearCookie('accessToken', this.cookiePolicy.clear);
      response.clearCookie('refreshToken', this.cookiePolicy.clear);

      const responsePayload =
        error instanceof UnauthorizedException
          ? (error.getResponse() as Record<string, unknown>)
          : {};
      const authError =
        typeof responsePayload?.error === 'string' ? responsePayload.error : 'UNKNOWN_AUTH_ERROR';
      this.logger.warn(
        `Refresh denied: code=${authError} ip=${req.ip || 'unknown'} ua=${req.headers['user-agent'] || 'unknown'}`,
      );
      throw error;
    }
  }
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send password-reset OTP',
    description: 'Send a 6-digit OTP to the registered email address for password reset',
  })
  @ApiBody({
    type: ForgotPasswordDto,
    description: 'Email address of the account that needs a password reset',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'OTP sent successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'OTP code has been sent' },
        data: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'OTP code has been sent to your email' },
            email: { type: 'string', example: 'us***@example.com' },
            expiresIn: { type: 'number', example: 300 },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid email payload' })
  async forgotPassword(@Body(ValidationPipe) forgotPasswordDto: ForgotPasswordDto): Promise<{
    message: string;
    data: ForgotPasswordResponseDto;
  }> {
    const result = await this.authService.forgotPassword(forgotPasswordDto);

    return {
      message: 'OTP code has been sent',
      data: result,
    };
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP code',
    description: 'Check whether the OTP code is valid before resetting the password',
  })
  @ApiBody({
    type: VerifyOtpDto,
    description: 'Email address and OTP code',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'OTP verification result',
  })
  async verifyOtp(@Body(ValidationPipe) verifyOtpDto: VerifyOtpDto): Promise<{
    message: string;
    data: VerifyOtpResponseDto;
  }> {
    const result = await this.authService.verifyOtp(verifyOtpDto);

    return {
      message: result.isValid ? 'OTP is valid' : 'OTP is invalid',
      data: result,
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password with OTP',
    description: 'Use the OTP code to set a new password',
  })
  @ApiBody({
    type: ResetPasswordDto,
    description: 'Email address, OTP code, and the new password',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset completed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Password reset completed successfully' },
        data: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Password reset successful. Please login again.',
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'OTP is invalid or has expired' })
  @ApiBadRequestResponse({ description: 'Invalid reset password payload' })
  async resetPassword(@Body(ValidationPipe) resetPasswordDto: ResetPasswordDto): Promise<{
    message: string;
    data: ResetPasswordResponseDto;
  }> {
    const result = await this.authService.resetPassword(resetPasswordDto);

    return {
      message: 'Password reset completed successfully',
      data: result,
    };
  }

  // ==========================================
  // Delete Account Routes
  // ==========================================

  @Get('check-obligations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Check obligations before deleting account',
    description: 'Check if user has active projects or wallet balance',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns obligation information',
    schema: {
      type: 'object',
      properties: {
        hasObligations: { type: 'boolean', example: false },
        activeProjects: { type: 'number', example: 0 },
        walletBalance: { type: 'number', example: 0 },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  async checkObligations(@Req() req: AuthRequest): Promise<{
    hasObligations: boolean;
    activeProjects: number;
    walletBalance: number;
  }> {
    return await this.authService.checkActiveObligations(req.user.id);
  }

  @Post('delete-account')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete account',
    description:
      'Permanently delete user account after password verification. Cannot delete if there are active projects or wallet balance.',
  })
  @ApiBody({ type: DeleteAccountDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Account has been deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Account has been deleted successfully' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Incorrect password' })
  @ApiBadRequestResponse({ description: 'Cannot delete account while having obligations' })
  async deleteAccount(
    @Req() req: AuthRequest,
    @Body(ValidationPipe) deleteAccountDto: DeleteAccountDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    const result = await this.authService.deleteAccount(req.user.id, deleteAccountDto);

    response.clearCookie('accessToken', this.cookiePolicy.clear);
    response.clearCookie('refreshToken', this.cookiePolicy.clear);

    return result;
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
    description: 'Google OAuth signup completed successfully',
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
