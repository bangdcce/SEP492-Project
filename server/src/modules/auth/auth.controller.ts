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
    summary: 'ﾄ斉ハg kﾃｽ tﾃi kho蘯｣n m盻嬖',
    description:
      'T蘯｡o tﾃi kho蘯｣n m盻嬖 v盻嬖 thﾃｴng tin cﾆ｡ b蘯｣n. Yﾃｪu c蘯ｧu CAPTCHA vﾃ gi盻嬖 h蘯｡n 3 l蘯ｧn/phﾃｺt. Ch盻・cho phﾃｩp 3 lo蘯｡i role: CLIENT, BROKER, FREELANCER',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'ﾄ斉ハg kﾃｽ thﾃnh cﾃｴng',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'ﾄ斉ハg kﾃｽ thﾃnh cﾃｴng' },
        data: { $ref: '#/components/schemas/AuthResponseDto' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'D盻ｯ li盻㎡ ﾄ黛ｺｧu vﾃo khﾃｴng h盻｣p l盻・ho蘯ｷc CAPTCHA sai',
  })
  @ApiConflictResponse({ description: 'Email ﾄ妥｣ ﾄ柁ｰ盻｣c s盻ｭ d盻･ng' })
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
      message:
        'ﾄ斉ハg kﾃｽ thﾃnh cﾃｴng. Vui lﾃｲng ki盻ノ tra email ﾄ黛ｻ・xﾃ｡c th盻ｱc tﾃi kho蘯｣n.',
      data: user,
    };
  }

  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xﾃ｡c th盻ｱc email',
    description: 'Xﾃ｡c th盻ｱc ﾄ黛ｻ蟻 ch盻・email b蘯ｱng token ﾄ柁ｰ盻｣c g盻ｭi qua email',
  })
  @ApiQuery({ name: 'token', description: 'Email verification token', required: true })
  @ApiOkResponse({
    description: 'Email ﾄ妥｣ ﾄ柁ｰ盻｣c xﾃ｡c th盻ｱc thﾃnh cﾃｴng',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Email verified successfully' },
        email: { type: 'string', example: 'user@example.com' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Token khﾃｴng h盻｣p l盻・ho蘯ｷc ﾄ妥｣ h蘯ｿt h蘯｡n' })
  async verifyEmail(@Query('token') token: string) {
    return this.emailVerificationService.verifyEmail(token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 2, ttl: 300000 } }) // 2 requests per 5 minutes
  @ApiOperation({
    summary: 'G盻ｭi l蘯｡i email xﾃ｡c th盻ｱc',
    description: 'G盻ｭi l蘯｡i email xﾃ｡c th盻ｱc cho ngﾆｰ盻拱 dﾃｹng chﾆｰa xﾃ｡c th盻ｱc email',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email', example: 'user@example.com' },
      },
    },
  })
  @ApiOkResponse({ description: 'Email xﾃ｡c th盻ｱc ﾄ妥｣ ﾄ柁ｰ盻｣c g盻ｭi l蘯｡i' })
  @ApiBadRequestResponse({
    description: 'Email ﾄ妥｣ ﾄ柁ｰ盻｣c xﾃ｡c th盻ｱc ho蘯ｷc yﾃｪu c蘯ｧu quﾃ｡ nhanh',
  })
  async resendVerification(@Body('email') email: string) {
    return this.emailVerificationService.resendVerificationEmail(email);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'ﾄ斉ハg nh蘯ｭp vﾃo h盻・th盻創g',
    description:
      'Xﾃ｡c th盻ｱc ngﾆｰ盻拱 dﾃｹng b蘯ｱng email vﾃ m蘯ｭt kh蘯ｩu, tr蘯｣ v盻・access token vﾃ refresh token',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'ﾄ斉ハg nh蘯ｭp thﾃnh cﾃｴng',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'ﾄ斉ハg nh蘯ｭp thﾃnh cﾃｴng' },
        data: { $ref: '#/components/schemas/LoginResponseDto' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Email ho蘯ｷc m蘯ｭt kh蘯ｩu khﾃｴng ﾄ妥ｺng' })
  @ApiBadRequestResponse({ description: 'Invalid login payload' })
  async login(
    @Body(ValidationPipe) loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    message: string;
    data: SecureLoginResponseDto;
  }> {
    // L蘯･y thﾃｴng tin thi蘯ｿt b盻・t盻ｫ request headers
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
      message: 'ﾄ斉ハg nh蘯ｭp thﾃnh cﾃｴng',
      data: dataWithoutTokens,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'ﾄ斉ハg xu蘯･t kh盻淑 h盻・th盻創g',
    description:
      'H盻ｧy b盻・session hi盻㌻ t蘯｡i. Refresh token s蘯ｽ ﾄ柁ｰ盻｣c ﾄ黛ｻ皇 t盻ｫ httpOnly cookie',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'ﾄ斉ハg xu蘯･t thﾃnh cﾃｴng',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'ﾄ斉ハg xu蘯･t thﾃnh cﾃｴng' },
        data: { type: 'null', example: null },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Token khﾃｴng h盻｣p l盻・ho蘯ｷc ﾄ妥｣ h蘯ｿt h蘯｡n' })
  async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    message: string;
    data: null;
  }> {
    // L蘯･y refresh token t盻ｫ cookie
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
    summary: 'L蘯･y thﾃｴng tin tﾃi kho蘯｣n hi盻㌻ t蘯｡i',
    description: 'Tr蘯｣ v盻・thﾃｴng tin chi ti蘯ｿt c盻ｧa ngﾆｰ盻拱 dﾃｹng ﾄ疎ng ﾄ惰ハg nh蘯ｭp',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'L蘯･y thﾃｴng tin thﾃnh cﾃｴng',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'L蘯･y thﾃｴng tin tﾃi kho蘯｣n thﾃnh cﾃｴng' },
        data: { $ref: '#/components/schemas/AuthResponseDto' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Token khﾃｴng h盻｣p l盻・ho蘯ｷc ﾄ妥｣ h蘯ｿt h蘯｡n' })
  async getProfile(@Req() req: AuthRequest): Promise<{
    message: string;
    data: AuthResponseDto;
  }> {
    // Fetch user with profile to get all profile data
    const userWithProfile = await this.authService.findUserWithProfile(req.user.id);

    if (!userWithProfile) {
      throw new UnauthorizedException({
        error: 'SESSION_REVOKED',
        message: 'Authenticated user not found',
      });
    }

    // Service method ﾄ黛ｻ・map user entity thﾃnh response DTO
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
      role: userWithProfile.role,
      isVerified: userWithProfile.isVerified,
      isEmailVerified: !!userWithProfile.emailVerifiedAt,
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
      message: 'L蘯･y thﾃｴng tin tﾃi kho蘯｣n thﾃnh cﾃｴng',
      data: userResponse,
    };
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'C蘯ｭp nh蘯ｭt thﾃｴng tin profile' })
  @ApiOkResponse({
    description: 'C蘯ｭp nh蘯ｭt thﾃnh cﾃｴng',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'C蘯ｭp nh蘯ｭt thﾃｴng tin thﾃnh cﾃｴng' },
        data: { type: 'object' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Token khﾃｴng h盻｣p l盻・ho蘯ｷc ﾄ妥｣ h蘯ｿt h蘯｡n' })
  async updateProfile(
    @Req() req: AuthRequest,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<{
    message: string;
    data: AuthResponseDto;
  }> {
    const updatedUser = await this.authService.updateProfile(req.user.id, updateProfileDto);

    return {
      message: 'C蘯ｭp nh蘯ｭt thﾃｴng tin thﾃnh cﾃｴng',
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
    summary: 'Lﾃm m盻嬖 access token',
    description: 'S盻ｭ d盻･ng refresh token t盻ｫ httpOnly cookie ﾄ黛ｻ・l蘯･y access token m盻嬖',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lﾃm m盻嬖 token thﾃnh cﾃｴng',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Lﾃm m盻嬖 token thﾃnh cﾃｴng' },
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
    description: 'Refresh token khﾃｴng h盻｣p l盻・ho蘯ｷc ﾄ妥｣ h蘯ｿt h蘯｡n',
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
    summary: 'G盻ｭi OTP reset password qua SMS',
    description: 'G盻ｭi mﾃ｣ OTP 6 s盻・ﾄ黛ｺｿn s盻・ﾄ訴盻㌻ tho蘯｡i ﾄ妥｣ ﾄ惰ハg kﾃｽ',
  })
  @ApiBody({
    type: ForgotPasswordDto,
    description: 'S盻・ﾄ訴盻㌻ tho蘯｡i c盻ｧa tﾃi kho蘯｣n c蘯ｧn reset password',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'OTP ﾄ妥｣ ﾄ柁ｰ盻｣c g盻ｭi qua SMS',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'OTP code has been sent' },
        data: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'OTP code has been sent to your phone number' },
            phoneNumber: { type: 'string', example: '0123***789' },
            expiresIn: { type: 'number', example: 300 },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid phone number payload' })
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
    summary: 'Xﾃ｡c th盻ｱc mﾃ｣ OTP',
    description: 'Ki盻ノ tra mﾃ｣ OTP cﾃｳ h盻｣p l盻・khﾃｴng (optional, cﾃｳ th盻・b盻・qua)',
  })
  @ApiBody({
    type: VerifyOtpDto,
    description: 'S盻・ﾄ訴盻㌻ tho蘯｡i vﾃ mﾃ｣ OTP',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'K蘯ｿt qu蘯｣ xﾃ｡c th盻ｱc OTP',
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
    summary: 'ﾄ雪ｺｷt l蘯｡i m蘯ｭt kh蘯ｩu v盻嬖 OTP',
    description: 'S盻ｭ d盻･ng mﾃ｣ OTP ﾄ黛ｻ・ﾄ黛ｺｷt l蘯｡i m蘯ｭt kh蘯ｩu m盻嬖',
  })
  @ApiBody({
    type: ResetPasswordDto,
    description: 'S盻・ﾄ訴盻㌻ tho蘯｡i, OTP vﾃ m蘯ｭt kh蘯ｩu m盻嬖',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'ﾄ雪ｺｷt l蘯｡i m蘯ｭt kh蘯ｩu thﾃnh cﾃｴng',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'ﾄ雪ｺｷt l蘯｡i m蘯ｭt kh蘯ｩu thﾃnh cﾃｴng' },
        data: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'ﾄ雪ｺｷt l蘯｡i m蘯ｭt kh蘯ｩu thﾃnh cﾃｴng. Vui lﾃｲng ﾄ惰ハg nh蘯ｭp l蘯｡i.',
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'OTP khﾃｴng h盻｣p l盻・ho蘯ｷc ﾄ妥｣ h蘯ｿt h蘯｡n' })
  @ApiBadRequestResponse({ description: 'Invalid reset password payload' })
  async resetPassword(@Body(ValidationPipe) resetPasswordDto: ResetPasswordDto): Promise<{
    message: string;
    data: ResetPasswordResponseDto;
  }> {
    const result = await this.authService.resetPassword(resetPasswordDto);

    return {
      message: 'ﾄ雪ｺｷt l蘯｡i m蘯ｭt kh蘯ｩu thﾃnh cﾃｴng',
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
    description: 'Hoﾃn t蘯･t ﾄ惰ハg kﾃｽ Google OAuth thﾃnh cﾃｴng',
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
