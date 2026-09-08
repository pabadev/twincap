import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  makeFeedbackDispatcher,
  type FeedbackSendArgs,
  type FeedbackDispatchResult,
  type FeedbackSendFn,
} from './feedback-alerter';

function baseArgs(overrides: Partial<FeedbackSendArgs> = {}): FeedbackSendArgs {
  return {
    kind: 'comment',
    message: 'Love the app!',
    userId: 'user-1',
    email: 'author@example.com',
    locale: 'es',
    ...overrides,
  };
}

describe('makeFeedbackDispatcher', () => {
  afterEach(() => {
    // Restore RESEND_API_KEY / FEEDBACK_EMAIL to their real values.
    vi.unstubAllEnvs();
  });

  it('returns { delivered: true } when the transport resolves', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('FEEDBACK_EMAIL', 'feedback@twincap.app');
    const send: FeedbackSendFn = vi.fn().mockResolvedValue(undefined);
    const dispatcher = makeFeedbackDispatcher(send);

    const result: FeedbackDispatchResult = await dispatcher(baseArgs());

    expect(result).toEqual({ delivered: true });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('returns { delivered: false, reason: "transport_error" } and logs when the transport rejects', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('FEEDBACK_EMAIL', 'feedback@twincap.app');
    const send: FeedbackSendFn = vi.fn().mockRejectedValue(new Error('resend 500'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const dispatcher = makeFeedbackDispatcher(send);

    const result: FeedbackDispatchResult = await dispatcher(baseArgs({ kind: 'bug' }));

    expect(result).toEqual({ delivered: false, reason: 'transport_error' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(payload).toMatchObject({
      level: 'error',
      event: 'feedback_email_failed',
      kind: 'bug',
      error: 'resend 500',
    });

    errorSpy.mockRestore();
  });

  it('returns { delivered: false, reason: "not_configured" } and does NOT call send when RESEND_API_KEY is missing', async () => {
    vi.stubEnv('RESEND_API_KEY', undefined);
    vi.stubEnv('FEEDBACK_EMAIL', 'feedback@twincap.app');
    const send: FeedbackSendFn = vi.fn().mockResolvedValue(undefined);
    const dispatcher = makeFeedbackDispatcher(send);

    const result: FeedbackDispatchResult = await dispatcher(baseArgs());

    expect(result).toEqual({ delivered: false, reason: 'not_configured' });
    expect(send).not.toHaveBeenCalled();
  });

  it('returns { delivered: false, reason: "not_configured" } and does NOT call send when FEEDBACK_EMAIL is missing', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('FEEDBACK_EMAIL', undefined);
    const send: FeedbackSendFn = vi.fn().mockResolvedValue(undefined);
    const dispatcher = makeFeedbackDispatcher(send);

    const result: FeedbackDispatchResult = await dispatcher(baseArgs());

    expect(result).toEqual({ delivered: false, reason: 'not_configured' });
    expect(send).not.toHaveBeenCalled();
  });
});