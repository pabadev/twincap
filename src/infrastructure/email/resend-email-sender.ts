import type { EmailSender } from '../../core/application/ports';
import { getEnv } from '../config/env';
import { verificationEmail, passwordResetEmail } from './email-templates';

/** Default sender address, overridable via RESEND_FROM (optional). */
const DEFAULT_FROM = 'TwinCap <no-reply@twincap.app>';

/**
 * Resend-backed transactional email sender (R13-B).
 *
 * DEV MODE: when RESEND_API_KEY is not configured, the links are logged to the
 * console instead of sent, and the method resolves without throwing — so the
 * caller (register/reset) is never blocked by a missing key. In production the
 * send failure is controlled by the caller (auth flows treat email as
 * best-effort).
 */
export class ResendEmailSender implements EmailSender {
  private readonly apiKey: string | undefined;

  constructor(apiKey: string | undefined = getEnv().RESEND_API_KEY) {
    this.apiKey = apiKey;
  }

  async sendPasswordReset(payload: {
    to: string;
    token: string;
    baseUrl: string;
    locale?: string;
  }): Promise<void> {
    const link = this.buildLink(payload.baseUrl, '/reset-password', payload.token, payload.to);
    const { subject, html } = passwordResetEmail(payload.baseUrl, link, payload.locale);
    await this.deliver(payload.to, subject, html, link);
  }

  async sendEmailVerification(payload: {
    to: string;
    token: string;
    baseUrl: string;
    locale?: string;
  }): Promise<void> {
    const link = this.buildLink(payload.baseUrl, '/verify-email', payload.token, payload.to);
    const { subject, html } = verificationEmail(payload.baseUrl, link, payload.locale);
    await this.deliver(payload.to, subject, html, link);
  }

  private buildLink(
    baseUrl: string,
    path: string,
    token: string,
    email: string,
  ): string {
    return `${baseUrl}${path}?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  }

  private async deliver(
    to: string,
    subject: string,
    html: string,
    link: string,
  ): Promise<void> {
    if (!this.apiKey) {
      // DEV MODE: no provider configured — log the link instead of sending.
      console.log(`[dev email] to=${to} subject="${subject}" link=${link}`);
      return;
    }

    // Lazy-import the Resend SDK so the module loads even without the key
    // (keeps dev dev-mode importable and avoids top-level side effects).
    const { Resend } = await import('resend');
    const resend = new Resend(this.apiKey);
    await resend.emails.send({
      from: (getEnv().RESEND_FROM as string | undefined) ?? DEFAULT_FROM,
      to,
      subject,
      html,
    });
  }
}
