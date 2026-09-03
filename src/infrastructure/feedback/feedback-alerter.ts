/**
 * Feedback email dispatcher (R13-E).
 *
 * Sends user feedback (comments, bugs, suggestions) to a configured
 * recipient. Same fail-safe pattern as error-alerter.ts: never throws,
 * silent no-op when env is missing, structured stderr on failure.
 *
 * DEV MODE GATE: if RESEND_API_KEY or FEEDBACK_EMAIL is not configured,
 * this is a SILENT NO-OP — dev installs are never spammed.
 */

export interface FeedbackSendArgs {
  kind: 'comment' | 'bug' | 'suggestion';
  message: string;
  userId: string;
  email: string;
  locale: string;
  page?: string;
}

const KIND_LABELS: Record<FeedbackSendArgs['kind'], string> = {
  comment: 'Comment',
  bug: 'Bug',
  suggestion: 'Suggestion',
};

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

/** Subject line for a feedback email (system text, not user-facing UI). */
export function buildFeedbackSubject(args: FeedbackSendArgs): string {
  const kindLabel = KIND_LABELS[args.kind] ?? args.kind;
  return `[TwinCap Feedback] ${kindLabel}: ${truncate(args.message, 60)}`;
}

/** Plain-text body for a feedback email. */
export function buildFeedbackText(args: FeedbackSendArgs): string {
  const lines: string[] = [
    `Kind: ${KIND_LABELS[args.kind] ?? args.kind}`,
    `Message: ${args.message}`,
  ];
  if (args.email) {
    lines.push(`User: ${args.email}`);
  }
  lines.push(
    `User ID: ${args.userId}`,
    `Locale: ${args.locale}`,
  );
  if (args.page) {
    lines.push(`Page: ${args.page}`);
  }
  return lines.join('\n');
}

/** Sends via Resend; resolves normally regardless of outcome. */
export type FeedbackSendFn = (args: {
  input: FeedbackSendArgs;
  from: string;
  to: string;
}) => Promise<void>;

/**
 * Factory for a fail-safe feedback dispatcher with an injectable `send`
 * transport (so tests can substitute a mock without touching Resend).
 */
export function makeFeedbackDispatcher(send: FeedbackSendFn) {
  return async (args: FeedbackSendArgs): Promise<void> => {
    const apiKey = process.env.RESEND_API_KEY;
    const recipient = process.env.FEEDBACK_EMAIL;
    const from = process.env.RESEND_FROM;

    // No provider key → silent no-op (dev).
    if (!apiKey) return;
    // No recipient configured → silent no-op.
    if (!recipient) return;

    try {
      await send({
        input: args,
        from: from ?? 'TwinCap <no-reply@twincap.app>',
        to: recipient,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'feedback_email_failed',
          kind: args.kind,
          error: message,
        }),
      );
    }
  };
}

/** The real Resend transport. */
const resendSend: FeedbackSendFn = async ({ input, from, to }) => {
  const { Resend } = await import('resend');
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to,
    subject: buildFeedbackSubject(input),
    text: buildFeedbackText(input),
  });
};

/** Production default dispatcher backed by Resend. Fail-safe; never throws. */
export const sendFeedback: (args: FeedbackSendArgs) => Promise<void> =
  makeFeedbackDispatcher(resendSend);
