import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeAlertDispatcher, shouldSendAlert, type AlertDispatcher } from './error-alerter';
import type { ErrorEventInput } from '../../core/application/ports';

function input(over: Partial<ErrorEventInput> & { message?: string }): ErrorEventInput {
  return {
    message: 'boom',
    severity: 'error',
    expected: false,
    ...over,
  } as ErrorEventInput;
}

const saved = {
  enabled: process.env.ERROR_MONITORING_ENABLED,
  email: process.env.ERROR_ALERT_EMAIL,
  key: process.env.RESEND_API_KEY,
  from: process.env.RESEND_FROM,
};

afterEach(() => {
  process.env.ERROR_MONITORING_ENABLED = saved.enabled;
  process.env.ERROR_ALERT_EMAIL = saved.email;
  process.env.RESEND_API_KEY = saved.key;
  process.env.RESEND_FROM = saved.from;
});

describe('shouldSendAlert (pure predicate)', () => {
  it('alerts only for first + unexpected + fatal|error', () => {
    expect(shouldSendAlert({ input: input({ severity: 'error' }), isFirst: true })).toBe(true);
    expect(shouldSendAlert({ input: input({ severity: 'fatal' }), isFirst: true })).toBe(true);
    expect(shouldSendAlert({ input: input({ severity: 'warning' }), isFirst: true })).toBe(false);
    expect(shouldSendAlert({ input: input({ severity: 'error', expected: true }), isFirst: true })).toBe(false);
    expect(shouldSendAlert({ input: input({ severity: 'error' }), isFirst: false })).toBe(false);
  });
});

describe('makeAlertDispatcher', () => {
  function setup(): { send: ReturnType<typeof vi.fn>; dispatcher: AlertDispatcher } {
    const send = vi.fn(async () => {});
    const dispatcher = makeAlertDispatcher(send);
    return { send, dispatcher };
  }

  it('sends an email (via injected transport) for first+unexpected+error when configured', async () => {
    process.env.ERROR_MONITORING_ENABLED = 'true';
    process.env.ERROR_ALERT_EMAIL = 'ops@example.com';
    process.env.RESEND_API_KEY = 're_test';
    const { send, dispatcher } = setup();

    await dispatcher({ input: input({ severity: 'error' }), isFirst: true });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe('ops@example.com');
    expect(send.mock.calls[0][0].input.message).toBe('boom');
  });

  it('does NOT send for warning / first+expected / not-first', async () => {
    process.env.ERROR_MONITORING_ENABLED = 'true';
    process.env.ERROR_ALERT_EMAIL = 'ops@example.com';
    process.env.RESEND_API_KEY = 're_test';
    const { send, dispatcher } = setup();

    await dispatcher({ input: input({ severity: 'warning' }), isFirst: true });
    expect(send).not.toHaveBeenCalled();

    await dispatcher({ input: input({ severity: 'error', expected: true }), isFirst: true });
    expect(send).not.toHaveBeenCalled();

    await dispatcher({ input: input({ severity: 'error' }), isFirst: false });
    expect(send).not.toHaveBeenCalled();
  });

  it('is a silent no-op when not configured (disabled/recipient/key missing)', async () => {
    process.env.ERROR_MONITORING_ENABLED = 'false';
    const { send, dispatcher } = setup();
    await dispatcher({ input: input({ severity: 'error' }), isFirst: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('is fail-safe: a throwing send does not propagate', async () => {
    process.env.ERROR_MONITORING_ENABLED = 'true';
    process.env.ERROR_ALERT_EMAIL = 'ops@example.com';
    process.env.RESEND_API_KEY = 're_test';
    const send = vi.fn(async () => { throw new Error('smtp down'); });
    const dispatcher = makeAlertDispatcher(send);

    await expect(
      dispatcher({ input: input({ severity: 'error' }), isFirst: true }),
    ).resolves.toBeUndefined();
  });
});
