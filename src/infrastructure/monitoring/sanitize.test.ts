import { describe, expect, it } from 'vitest';
import {
  sanitizeErrorInput,
  sanitizeContext,
  looksLikeSecret,
  MESSAGE_MAX,
  STACK_MAX,
  CODE_MAX,
} from './sanitize';

const base = {
  message: 'boom',
  severity: 'error' as const,
  expected: false,
};

describe('sanitizeErrorInput', () => {
  it('truncates message, stack and code', () => {
    const input = {
      ...base,
      message: 'x'.repeat(MESSAGE_MAX + 100),
      stack: 'y'.repeat(STACK_MAX + 100),
      code: 'z'.repeat(CODE_MAX + 100),
    };
    const out = sanitizeErrorInput(input);
    expect(out.message.length).toBe(MESSAGE_MAX);
    expect(out.stack!.length).toBe(STACK_MAX);
    expect(out.code!.length).toBe(CODE_MAX);
  });

  it('defaults message to unknown_error when empty/missing', () => {
    const out = sanitizeErrorInput({ ...base, message: '' as string });
    expect(out.message).toBe('unknown_error');
  });

  it('keeps allowed context keys', () => {
    const out = sanitizeErrorInput({
      ...base,
      context: {
        userId: 'u-1',
        workspaceId: 'w-1',
        path: '/accounts',
        method: 'POST',
        userAgent: 'Mozilla/5.0',
        correlationId: 'abc',
      },
    });
    expect(out.context).toEqual({
      userId: 'u-1',
      workspaceId: 'w-1',
      path: '/accounts',
      method: 'POST',
      userAgent: 'Mozilla/5.0',
      correlationId: 'abc',
    });
  });

  it('drops non-allowlisted and sensitive context keys', () => {
    const out = sanitizeErrorInput({
      ...base,
      context: {
        userId: 'u-1',
        password: 'secret',
        passwordHash: 'x',
        token: 'jwt.token',
        authorization: 'Bearer abc',
        cookie: 'a=b',
        headers: { a: 'b' },
        body: { amount: 100 },
        rawData: 'raw',
        account: 'acc',
        amount: 1000,
        bank: 'nequi',
        balance: 500,
        jwt: 'x.y.z',
        session: 's',
        card: '4111',
        cvv: '123',
        email: 'a@b.com',
        name: 'John',
        nested: { a: 1 },
      },
    });
    expect(out.context).toEqual({ userId: 'u-1' });
  });

  it('drops long opaque string values that look like secrets', () => {
    const out = sanitizeErrorInput({
      ...base,
      context: {
        userId: 'u-1',
        correlationId: 'x'.repeat(60), // >48, no spaces → secret-like
      },
    });
    expect(out.context).toEqual({ userId: 'u-1' });
  });

  it('keeps short non-secret values', () => {
    const out = sanitizeErrorInput({
      ...base,
      context: { userId: 'u-1', path: '/some/path' },
    });
    expect(out.context).toEqual({ userId: 'u-1', path: '/some/path' });
  });

  it('returns undefined context when nothing survives allowlist', () => {
    const out = sanitizeErrorInput({
      ...base,
      context: { password: 'x', token: 'y' },
    });
    expect(out.context).toBeUndefined();
  });

  it('does not mutate the input', () => {
    const input: Parameters<typeof sanitizeErrorInput>[0] = {
      ...base,
      message: 'boom',
      context: { userId: 'u-1', password: 'secret' },
    };
    sanitizeErrorInput(input);
    expect(input.context).toEqual({ userId: 'u-1', password: 'secret' });
  });
});

describe('sanitizeContext / looksLikeSecret', () => {
  it('rejects known sensitive keys by name and drops non-allowlisted keys', () => {
    // Only allowlisted keys survive; sensitive-sounding ones are dropped.
    expect(
      sanitizeContext({
        userId: 'u-1',
        password: 'x',
        token: 'y',
        someOtherKey: 'z',
      } as never),
    ).toEqual({ userId: 'u-1' });
  });

  it('looksLikeSecret detects long token-like strings', () => {
    expect(looksLikeSecret('a'.repeat(60))).toBe(true);
    expect(looksLikeSecret('a'.repeat(30))).toBe(false);
    // A long string WITH spaces is treated as non-secret (text).
    expect(looksLikeSecret(('word '.repeat(20)))).toBe(false);
  });

  it('treats numbers/booleans/null as non-secrets', () => {
    expect(looksLikeSecret(12345)).toBe(false);
    expect(looksLikeSecret(true)).toBe(false);
    expect(looksLikeSecret(null)).toBe(false);
    expect(looksLikeSecret(undefined)).toBe(false);
  });
});
