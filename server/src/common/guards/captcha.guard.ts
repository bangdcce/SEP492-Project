import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CaptchaService } from '../../modules/auth/captcha.service';
import { Request } from 'express';

@Injectable()
export class CaptchaGuard implements CanActivate {
  constructor(
    private configService: ConfigService,
    private captchaService: CaptchaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const { recaptchaToken } = request.body;

    // Skip captcha check if disabled (for development)
    const captchaEnabled = this.configService.get<string>('RECAPTCHA_ENABLED') === 'true';
    if (!captchaEnabled) {
      return true;
    }

    // Validate reCAPTCHA token
    if (!recaptchaToken) {
      throw new BadRequestException('Vui lòng hoàn thành reCAPTCHA');
    }

    // Verify with Google reCAPTCHA API
    const isValid = await this.captchaService.verifyRecaptcha(recaptchaToken);
    
    if (!isValid) {
      throw new BadRequestException('reCAPTCHA verification failed. Please try again.');
    }

    return true;
  }
}
