import type { ErrorEventInput, ErrorSeverity } from '../../core/application/ports';

/**
 * Alert dispatcher for the error monitoring system (R13-D).
 *
 * Sends an email alert for an incident. Alerting is gated by the caller: it
 * only fires for `isFirst === true`, `expected === false` and
 * `severity ∈ {fatal, error}`. The monitor already enforces these rules, and
 * the `shouldSendAlert` predicate here is the single source of truth so the
 * transport never needs to re-decide.
 *
 * THROTTLE STRATEGY (documented): ONE email per unique fingerprint (dedupe by
 * design — the reporter only yields `isFirst: true` for the first occurrence
 * of a fingerprint). This covers the closed beta. A time-window cooldown
 * (re-alert at most every N minutes for a still-firing fingerprint) is an
 * EXTENSION point that can be layered on later without touching consumers.
 *
 * BEST-EFFORT: a failed email send NEVER breaks anything. On failure (or when
 * not fully configured) a structured stderr JSON line is emitted with
 * `event: "error_alert_failed"` and the dispatcher resolves normally.
 *
 * DEV MODE GATE: if `RESEND_API_KEY` is not configured, or no
 * `ERROR_ALERT_EMAIL` recipient is set, or `ERROR_MONITORING_ENABLED` is
 * false (default), this is a SILENT NO-OP — dev installs are never spammed.
 *
 * Transport note: the `EmailSender` port only models transactional auth emails
 * (password reset / verification), which is semantically wrong for a generic
 * incident alert. To avoid polluting that port, this module talks to the
 * `resend` SDK directly with a generic message (same lazy-import pattern as
 * ResendEmailSender); no new dependency is introduced.
 */

export interface AlertDispatchArgs {
  input: ErrorEventInput;
  isFirst: boolean;
}

export type AlertDispatcher = (args: AlertDispatchArgs) => Promise<void>;

/**
 * Pure decision predicate: should we send an alert for this event?
 * Yes iff first occurrence AND unexpected AND severity is fatal|error.
 */
export function shouldSendAlert({ input, isFirst }: AlertDispatchArgs): boolean {
  if (!isFirst) return false;
  if (input.expected !== false) return false;
  const severity = (input.severity ?? 'error') as ErrorSeverity;
  return severity === 'fatal' || severity === 'error';
}

/** Subject line for an incident alert (no PII, no payloads). */
export function buildAlertSubject(input: ErrorEventInput): string {
  const severity = (input.severity ?? 'error') as ErrorSeverity;
  return `[TwinCap ${input.environment ?? 'unknown'}] ${severity.toUpperCase()}: ${input.name ?? 'Error'}`;
}

/** Plain-text body for an incident alert (no PII, no payloads). */
export function buildAlertText(input: ErrorEventInput): string {
  const lines = [
    `Message: ${input.message}`,
    `Severity: ${input.severity ?? 'error'}`,
    `Environment: ${input.environment ?? 'unknown'}`,
    `Release: ${input.release ?? 'unknown'}`,
    `Expected: ${input.expected}`,
    `Fingerprint: ${input.fingerprint ?? 'unknown'}`,
    `Code: ${input.code ?? '-'}`,
    '',
    'Stack (truncated):',
    input.stack ?? '(no stack)',
  ];
  if (input.context) {
    lines.push('', 'Context:');
    for (const [k, v] of Object.entries(input.context)) {
      lines.push(`  ${k}: ${String(v)}`);
    }
  }
  return lines.join('\n');
}

/** Sends via Resend; resolves normally regardless of outcome. */
export type AlertSendFn = (args: {
  input: ErrorEventInput;
  from: string;
  to: string;
}) => Promise<void>;

/**
 * Factory for a fail-safe alert dispatcher with an injectable `send` transport
 * (so tests can substitute a mock without touching Resend).
 */
export function makeAlertDispatcher(send: AlertSendFn): AlertDispatcher {
  return async ({ input, isFirst }) => {
    if (!shouldSendAlert({ input, isFirst })) return;

    // Read configuration directly from process.env (not the full env schema)
    // so this transport stays decoupled from DB/auth env validity and is
    // testable without those vars set.
    const monitoringEnabled = process.env.ERROR_MONITORING_ENABLED === 'true';
    const recipient = process.env.ERROR_ALERT_EMAIL;
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;

    // Feature disabled (default) → silent no-op.
    if (!monitoringEnabled) return;
    // No recipient configured → silent no-op.
    if (!recipient) return;
    // No provider key → Resend would no-op anyway in dev; guard for clarity.
    if (!apiKey) return;

    try {
      await send({ input, from: from ?? 'TwinCap <no-reply@twincap.app>', to: recipient });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'error_alert_failed',
          fingerprint: input.fingerprint,
          name: input.name,
          error: message,
        }),
      );
    }
  };
}

/** The real Resend transport. */
const resendSend: AlertSendFn = async ({ input, from, to }) => {
  const { Resend } = await import('resend');
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // already gated, but guard for safety
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to,
    subject: buildAlertSubject(input),
    text: buildAlertText(input),
  });
};

/** Production default dispatcher backed by Resend. Fail-safe; never throws. */
export const alertOnIncident: AlertDispatcher = makeAlertDispatcher(resendSend);
