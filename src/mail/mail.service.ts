import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    this.initTransporter();
  }

  private async initTransporter() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(port),
        secure: parseInt(port) === 465, // true for 465, false for other ports
        auth: {
          user,
          pass,
        },
      });
      this.logger.log('SMTP Mailer Transporter initialized.');
    } else {
      this.logger.warn('SMTP configuration missing. Using Ethereal Email sandbox fallback.');
    }
  }

  private async getTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter) {
      return this.transporter;
    }

    try {
      this.logger.log('Creating Ethereal Test Account...');
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      this.logger.log(`Ethereal sandbox initialized. User: ${testAccount.user}`);
      return this.transporter;
    } catch (err) {
      this.logger.error('Failed to create Ethereal Test Account. Falling back to console logging.', err);
      return {
        sendMail: async (options: any) => {
          this.logger.log(`[Mock Mail Send] To: ${options.to} | Subject: ${options.subject} | Text: ${options.text}`);
          return { messageId: 'mock-id' };
        },
      } as any;
    }
  }

  async sendEmail(to: string, subject: string, html: string, text: string) {
    const from = process.env.SMTP_FROM || '"NeoEval360" <noreply@neoeval360.com>';
    try {
      const transporter = await this.getTransporter();
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text,
      });

      this.logger.log(`Email sent: ${info.messageId}`);
      
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        this.logger.log(`Ethereal Email Preview URL: ${previewUrl}`);
      }
      return info;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`, error);
    }
  }

  async sendWelcomeEmail(to: string, name: string, employeeId: string, defaultPassword: string) {
    const subject = 'Welcome to NeoEval360 - Your Account Details';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #4f46e5; margin-bottom: 20px;">Welcome to NeoEval360!</h2>
        <p>Dear <strong>${name}</strong>,</p>
        <p>Your account has been created by the System Administrator. Here are your login credentials to access the platform:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #f9fafb; border-radius: 5px;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 150px;">Employee ID:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${employeeId}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Login Email:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${to}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">Default Password:</td>
            <td style="padding: 10px; font-family: monospace; font-size: 1.1em; color: #b45309;">${defaultPassword}</td>
          </tr>
        </table>
        <p style="margin-top: 20px;">You can log in at: <a href="https://neo-eval360-backend.vercel.app" style="color: #4f46e5; font-weight: bold;">NeoEval360 Portal</a></p>
        <p style="color: #6b7280; font-size: 0.9em; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
          This is an automated system email. Please do not reply directly to this message.
        </p>
      </div>
    `;
    const text = `Welcome to NeoEval360!\n\nDear ${name},\n\nYour account has been created. Here are your credentials:\nEmployee ID: ${employeeId}\nLogin Email: ${to}\nDefault Password: ${defaultPassword}\n\nLogin URL: https://neo-eval360-backend.vercel.app`;
    
    return this.sendEmail(to, subject, html, text);
  }

  async sendExpirationReminderEmail(to: string, name: string, type: 'trial' | 'contract', message: string) {
    const typeLabel = type === 'trial' ? 'Trial Period Expiration Alert' : 'Resource Contract Expiration Alert';
    const subject = `[Alert] ${typeLabel} - NeoEval360`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #fca5a5; border-radius: 5px;">
        <h2 style="color: #dc2626; margin-bottom: 20px;">${typeLabel}</h2>
        <p>Dear <strong>${name}</strong>,</p>
        <p>This is an automated system notification regarding an upcoming expiration event:</p>
        <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #991b1b; font-weight: bold;">Details:</p>
          <p style="margin: 5px 0 0 0; color: #7f1d1d;">${message}</p>
        </div>
        <p>Please log in to the portal and take necessary actions (evaluation, renewal, or extension approval).</p>
        <p style="margin-top: 20px;"><a href="https://neo-eval360-backend.vercel.app" style="color: #dc2626; font-weight: bold;">Go to NeoEval360 Portal</a></p>
        <p style="color: #6b7280; font-size: 0.9em; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
          This is an automated system email. Please do not reply directly to this message.
        </p>
      </div>
    `;
    const text = `[Alert] ${typeLabel}\n\nDear ${name},\n\nThis is an automated system notification regarding an upcoming expiration event:\n\n${message}\n\nPlease log in to the portal and take action.`;

    return this.sendEmail(to, subject, html, text);
  }
}
