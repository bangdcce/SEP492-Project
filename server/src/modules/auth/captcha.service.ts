import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class CaptchaService {
  private readonly RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

  constructor(private configService: ConfigService) {}

  /**
   * Verify Google reCAPTCHA token
   * @param token - reCAPTCHA response token from frontend
   * @returns boolean - true if verification successful
   */
  async verifyRecaptcha(token: string): Promise<boolean> {
    const secretKey = this.configService.get<string>('RECAPTCHA_SECRET_KEY');

    if (!secretKey) {
      throw new HttpException(
        'reCAPTCHA secret key not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const response = await axios.post(this.RECAPTCHA_VERIFY_URL, null, {
        params: {
          secret: secretKey,
          response: token,
        },
      });

      const { success, 'error-codes': errorCodes } = response.data;

      // For reCAPTCHA v2, just check success
      // For reCAPTCHA v3, you can check score (0.0 - 1.0)
      if (!success) {
        console.error('reCAPTCHA verification failed:', errorCodes);
        return false;
      }

      // Optional: For v3, check score threshold
      // const score = response.data.score;
      // if (score !== undefined && score < 0.5) {
      //   return false;
      // }

      return true;
    } catch (error) {
      console.error('reCAPTCHA verification error:', error);
      throw new HttpException('Failed to verify reCAPTCHA', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
