import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailVerificationService {
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly configService: ConfigService,
  ) {
    // Initialize nodemailer transporter
    // TODO: Configure with actual SMTP settings from environment
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
      port: this.configService.get('SMTP_PORT', 587),
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  /**
   * Generate verification token and send email
   */
  async sendVerificationEmail(userId: string, email: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email already verified');
    }

    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date();
    expires.setHours(expires.getHours() + 24); // Token valid for 24 hours

    // Save token to database
    await this.userRepository.update(userId, {
      emailVerificationToken: token,
      emailVerificationExpires: expires,
    });

    // Build verification URL
    const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:5173');
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

    // Send email
    const mailOptions = {
      from: this.configService.get('SMTP_FROM', '"InterDev Platform" <noreply@interdev.vn>'),
      to: email,
      subject: 'Verify Your Email Address - InterDev',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #14B8A6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background-color: #14B8A6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .warning { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 10px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Verify Your Email</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>Thank you for registering an account at <strong>InterDev Platform</strong>!</p>
              <p>Please click the button below to verify your email address:</p>
              <p style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email</a>
              </p>
              <p>Or copy the following link into your browser:</p>
              <p style="word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px;">
                ${verificationUrl}
              </p>
              <div class="warning">
                <strong>⚠️ Note:</strong> This verification link will expire after 24 hours. If you did not request this, please ignore this email.
              </div>
              <p>Best regards,<br><strong>InterDev Team</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} InterDev Platform. All rights reserved.</p>
              <p>This email was sent automatically, please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Verification email sent to ${email}`);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw new BadRequestException('Failed to send verification email');
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ message: string; email: string }> {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }

    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Check if already verified
    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email already verified');
    }

    // Check token expiry
    if (user.emailVerificationExpires && new Date() > user.emailVerificationExpires) {
      throw new BadRequestException('Verification token has expired. Please request a new one.');
    }

    // Mark email as verified
    await this.userRepository.update(user.id, {
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
      emailVerificationExpires: null,
      isVerified: false, // Keep isVerified for KYC, separate from email verification
    });

    return {
      message: 'Email verified successfully',
      email: user.email,
    };
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email already verified');
    }

    // Check if too many requests (rate limiting)
    if (user.emailVerificationExpires && new Date() < user.emailVerificationExpires) {
      const minutesLeft = Math.ceil(
        (user.emailVerificationExpires.getTime() - new Date().getTime()) / 1000 / 60,
      );
      if (minutesLeft > 23 * 60) {
        // Less than 1 hour since last request
        throw new BadRequestException(
          'Please wait before requesting a new verification email. Check your inbox or spam folder.',
        );
      }
    }

    await this.sendVerificationEmail(user.id, user.email);

    return {
      message: 'Verification email sent. Please check your inbox.',
    };
  }

  /**
   * Check if user's email is verified
   */
  async isEmailVerified(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['emailVerifiedAt'],
    });

    return !!user?.emailVerifiedAt;
  }
}
