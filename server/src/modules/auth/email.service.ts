import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { existsSync } from 'fs';
import { basename, resolve } from 'path';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: nodemailer.Transporter;
  private notificationLogoPath?: string | null;

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
    const normalizedSmtpPass = smtpPass?.replace(/\s+/g, '');

    if (!smtpUser || !normalizedSmtpPass) {
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
        pass: normalizedSmtpPass,
      },
    });

    this.logger.log('Email service initialized');
  }

  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendOTP(email: string, otp: string): Promise<void> {
    const appName = this.configService.get<string>('APP_NAME', 'InterDev');
    const rawFromEmail = this.configService.get('FROM_EMAIL') || this.configService.get('SMTP_USER');
    const configuredFromName = this.configService.get<string>('FROM_NAME', appName);
    const { fromEmail, detectedName } = this.parseFromAddress(rawFromEmail);
    const fromName = configuredFromName || detectedName || appName;

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
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('APP_URL') ||
      '';
    const supportEmail =
      this.configService.get<string>('SUPPORT_EMAIL') ||
      fromEmail ||
      'support@interdev.app';
    const supportUrl = this.configService.get<string>('SUPPORT_URL') || null;
    const notificationLogo = this.resolveNotificationLogo(frontendUrl);

    if (!this.transporter) {
      this.logger.warn(
        `Email service not configured. Skip notification email to ${input.email} (${input.subject})`,
      );
      return;
    }

    const html = this.getPlatformNotificationTemplate({
      appName,
      title: input.title,
      body: input.body,
      logoUrl: notificationLogo.logoSrc,
      supportEmail,
      supportUrl,
    });

    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: input.email,
        subject: input.subject,
        html,
      };

      if (notificationLogo.attachments?.length) {
        mailOptions.attachments = notificationLogo.attachments;
      }

      await this.transporter.sendMail(mailOptions);
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

  private resolveNotificationLogo(frontendUrl: string): {
    logoSrc: string | null;
    attachments?: nodemailer.SendMailOptions['attachments'];
  } {
    const localLogoPath = this.getNotificationLogoPath();
    if (localLogoPath) {
      const cid = 'interdev-platform-logo';
      return {
        logoSrc: `cid:${cid}`,
        attachments: [
          {
            filename: basename(localLogoPath),
            path: localLogoPath,
            cid,
            contentDisposition: 'inline',
          },
        ],
      };
    }

    const configuredLogo =
      this.configService.get<string>('EMAIL_LOGO_URL') ||
      this.configService.get<string>('APP_LOGO_URL');

    if (configuredLogo?.trim()) {
      return { logoSrc: configuredLogo.trim() };
    }

    const normalizedBase = frontendUrl.trim().replace(/\/+$/, '');
    if (!normalizedBase) {
      return { logoSrc: null };
    }

    return {
      logoSrc: `${normalizedBase}/assets/logo/Logo.png`,
    };
  }

  private getNotificationLogoPath(): string | null {
    if (this.notificationLogoPath !== undefined) {
      return this.notificationLogoPath;
    }

    const candidates = [
      resolve(process.cwd(), '..', 'client', 'public', 'assets', 'logo', 'Logo.png'),
      resolve(process.cwd(), 'client', 'public', 'assets', 'logo', 'Logo.png'),
      resolve(__dirname, '../../../..', 'client', 'public', 'assets', 'logo', 'Logo.png'),
      resolve(__dirname, '../../../../..', 'client', 'public', 'assets', 'logo', 'Logo.png'),
      resolve(process.cwd(), '..', 'client', 'public', 'assets', 'logo', 'LogoIcon.png'),
      resolve(process.cwd(), 'client', 'public', 'assets', 'logo', 'LogoIcon.png'),
    ];

    const logoPath = candidates.find((candidate) => existsSync(candidate));
    if (!logoPath) {
      this.logger.warn('Email logo asset not found in client/public/assets/logo.');
      this.notificationLogoPath = null;
      return this.notificationLogoPath;
    }

    this.notificationLogoPath = logoPath;
    return this.notificationLogoPath;
  }

  private getPlatformNotificationTemplate(input: {
    appName: string;
    title: string;
    body: string;
    logoUrl: string | null;
    supportEmail: string;
    supportUrl: string | null;
  }): string {
    const appName = this.escapeHtml(input.appName);
    const title = this.escapeHtml(input.title);
    const body = this.escapeHtml(input.body).replace(/\r?\n/g, '<br />');
    const supportEmail = this.escapeHtml(input.supportEmail);
    const supportUrl = input.supportUrl?.trim()
      ? this.escapeHtml(input.supportUrl.trim())
      : null;

    const logoBlock = input.logoUrl
      ? `<img src="${this.escapeHtml(input.logoUrl)}" alt="${appName} logo" style="display:block;height:44px;max-width:180px;width:auto;margin:0 auto;" />`
      : `<h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:0.3px;">${appName}</h1>`;

    const supportLink = supportUrl
      ? `<a href="${supportUrl}" style="display:inline-block;margin-top:14px;padding:10px 18px;border-radius:999px;background-color:#0d9488;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;">Visit support center</a>`
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background-color:#f1f5f9;">
          <tr>
            <td align="center">
              <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background-color:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08);">
                <tr>
                  <td style="padding:28px 28px 24px;text-align:center;background:linear-gradient(135deg,#0f766e 0%,#115e59 100%);">
                    ${logoBlock}
                    <p style="margin:12px 0 0;color:rgba(255,255,255,0.9);font-size:13px;">Platform notification</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:30px 28px 22px;">
                    <h2 style="margin:0 0 12px;color:#0f172a;font-size:24px;font-weight:700;line-height:1.3;">${title}</h2>
                    <p style="margin:0;color:#334155;font-size:15px;line-height:1.7;">${body}</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 28px 28px;">
                    <div style="border-radius:12px;background-color:#f8fafc;border:1px solid #e2e8f0;padding:16px;">
                      <p style="margin:0;color:#475569;font-size:12px;line-height:1.6;">
                        Need help? Contact ${appName} support at
                        <a href="mailto:${supportEmail}" style="color:#0f766e;text-decoration:none;font-weight:600;">${supportEmail}</a>.
                      </p>
                      ${supportLink}
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:18px 28px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
                    <p style="margin:0;color:#94a3b8;font-size:12px;">
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

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!domain) return email;
    if (localPart.length <= 2) {
      return `${localPart[0]}***@${domain}`;
    }
    return `${localPart.substring(0, 2)}***@${domain}`;
  }

  private parseFromAddress(rawValue?: string): { fromEmail: string; detectedName: string | null } {
    const fallbackEmail = this.configService.get<string>('SMTP_USER', 'no-reply@localhost');
    const value = `${rawValue || ''}`.trim();

    if (!value) {
      return { fromEmail: fallbackEmail, detectedName: null };
    }

    const angleMatch = value.match(/^(.*)<([^>]+)>$/);
    if (angleMatch) {
      const detectedName = angleMatch[1].trim().replace(/^"|"$/g, '') || null;
      const fromEmail = angleMatch[2].trim();
      return { fromEmail: fromEmail || fallbackEmail, detectedName };
    }

    return { fromEmail: value, detectedName: null };
  }
}
