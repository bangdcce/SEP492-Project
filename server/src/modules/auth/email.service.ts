import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private configService: ConfigService,
    private readonly auditLogsService: AuditLogsService,
  ) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpHost = this.configService.get('SMTP_HOST');
    const smtpUser = this.configService.get('SMTP_USER');
    const smtpPass = this.configService.get('SMTP_PASS');

    if (!smtpUser || !smtpPass) {
      this.logger.warn(
        'Email credentials not configured (SMTP_USER/SMTP_PASS missing). OTP will only log to console.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost || 'smtp.gmail.com',
      port: parseInt(this.configService.get('SMTP_PORT') || '587'),
      secure: this.configService.get('SMTP_SECURE') === 'true',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    this.logger.log('Email service initialized');
  }

  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendOTP(email: string, otp: string): Promise<void> {
    const appName = this.configService.get<string>('APP_NAME', 'InterDev');
    const fromEmail = this.configService.get('FROM_EMAIL') || this.configService.get('SMTP_USER');
    const fromName = this.configService.get('FROM_NAME', appName);

    this.logger.log('\n===== EMAIL OTP =====');
    this.logger.log(`To: ${email}`);
    this.logger.log(`OTP: ${otp}`);
    this.logger.log('=======================\n');

    if (!this.transporter) {
      this.logger.warn('Email service not configured - OTP only logged to console');
      return;
    }

    try {
      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: `Your verification code - ${appName}`,
        html: this.getOTPEmailTemplate(otp, appName),
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully to ${email}. Message ID: ${info.messageId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email to ${email}: ${message}`);
      if (error instanceof Error && error.stack) {
        this.logger.debug(error.stack);
      }
      await this.auditLogsService.logSystemIncident({
        component: 'EmailService',
        operation: 'send-otp',
        summary: `Failed to send OTP email to ${this.maskEmail(email)}`,
        severity: 'HIGH',
        category: 'EMAIL',
        error,
        target: {
          type: 'Email',
          id: email,
          label: this.maskEmail(email),
        },
        context: {
          email: this.maskEmail(email),
          appName,
        },
      });
      throw new Error(`Failed to send OTP email: ${message}`);
    }
  }

  async sendPlatformNotification(input: {
    email: string;
    subject: string;
    title: string;
    body: string;
  }): Promise<void> {
    const appName = this.configService.get<string>('APP_NAME', 'InterDev');
    const fromEmail = this.configService.get('FROM_EMAIL') || this.configService.get('SMTP_USER');
    const fromName = this.configService.get('FROM_NAME', appName);

    if (!this.transporter) {
      this.logger.warn(
        `Email service not configured. Skip notification email to ${input.email} (${input.subject})`,
      );
      return;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2 style="margin-bottom: 8px;">${input.title}</h2>
        <p style="margin: 0 0 12px;">${input.body}</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: input.email,
        subject: input.subject,
        html,
      });
    } catch (error) {
      await this.auditLogsService.logSystemIncident({
        component: 'EmailService',
        operation: 'send-platform-notification',
        summary: `Failed to send platform notification email to ${this.maskEmail(input.email)}`,
        severity: 'HIGH',
        category: 'EMAIL',
        error,
        target: {
          type: 'Email',
          id: input.email,
          label: this.maskEmail(input.email),
        },
        context: {
          email: this.maskEmail(input.email),
          subject: input.subject,
        },
      });
      throw error;
    }
  }

  private getOTPEmailTemplate(otp: string, appName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verification Code</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #14B8A6 0%, #0D9488 100%); border-radius: 12px 12px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">${appName}</h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 40px;">
                    <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">Password Reset Request</h2>
                    <p style="margin: 0 0 20px; color: #6b7280; font-size: 16px; line-height: 1.6;">
                      We received a request to reset your password. Use the verification code below to complete the process:
                    </p>

                    <div style="background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%); border: 2px solid #14B8A6; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
                      <div style="font-size: 14px; color: #6b7280; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Verification Code</div>
                      <div style="font-size: 36px; font-weight: 700; color: #0D9488; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</div>
                    </div>

                    <p style="margin: 20px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                      This code will expire in <strong style="color: #1f2937;">5 minutes</strong>.
                    </p>

                    <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                      If you didn't request this code, you can safely ignore this email.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; text-align: center;">
                    <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                      &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!domain) return email;
    if (localPart.length <= 2) {
      return `${localPart[0]}***@${domain}`;
    }
    return `${localPart.substring(0, 2)}***@${domain}`;
  }
}
