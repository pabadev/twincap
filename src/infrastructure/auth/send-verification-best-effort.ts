import type { AuthEmailDeps } from '../../core/application/auth/email-deps';
import { issueVerificationEmail } from '../../core/application/auth/email-deps';

/**
 * Fires a verification email for a freshly registered user, BEST-EFFORT
 * (R13-B2). Registration must never fail because the email could not be sent
 * (missing RESEND_API_KEY in dev, provider outage, etc.). On any error the
 * failure is logged to the console and the function resolves normally.
 */
export async function sendVerificationBestEffort(
  user: { id: string; email: string },
  deps: AuthEmailDeps,
): Promise<void> {
  try {
    await issueVerificationEmail(user, deps, deps.clock.now());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'verification_email_failed',
        userId: user.id,
        error: message,
      }),
    );
  }
}
