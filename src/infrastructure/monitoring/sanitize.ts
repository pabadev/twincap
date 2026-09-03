import type { ErrorContext, ErrorEventInput } from '../../core/application/ports';

/**
 * Strict sanitization for the error monitoring system (R13-D).
 *
 * This module is PURE (no DB, no side effects) so it can be unit tested in
 * isolation. It guarantees the ONLY data persisted by the error reporter is:
 *   - `message` truncated to 500 chars
 *   - `stack` truncated to 4000 chars (the fingerprint/monitor already eats
 *     line numbers, but the raw persisted copy is still bounded)
 *   - `code` truncated to 200 chars
 *   - a strict ALLOWLIST of `context` keys (userId, workspaceId, path, method,
 *     userAgent, correlationId) — nothing else.
 *
 * PII (passwords, JWTs, cookies, Authorization headers, full bodies, emails),
 * financial data (amounts, balances, bank, account) and raw request data are
 * NEVER persisted, regardless of the `expected` flag.
 */

export const MESSAGE_MAX = 500;
export const STACK_MAX = 4000;
export const CODE_MAX = 200;

/** The ONLY context keys allowed through to persistence. */
const CONTEXT_ALLOWLIST: ReadonlySet<string> = new Set([
  'userId',
  'workspaceId',
  'path',
  'method',
  'userAgent',
  'correlationId',
]);

/** Key names (lowercased) that are rejected outright as sensitive. */
const SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|authorization|cookie|header|body|rawdata|credential|api[_-]?key|session|jwt|card|cvv|cvv2|pin\b|otp)/i;

/** Financial / personal-identifier values that must never be persisted. */
const FINANCIAL_KEY_PATTERN =
  /(amount|balance|bank|account|iban|swift|transaction|payment|salary|income|expense|email|phone|document|identity|address|name\b)/i;

/** Strings that look like a long opaque secret (e.g. a JWT or API key). */
const LONG_SECRET_LENGTH = 48;

/**
 * Heuristic: a value that looks like a long token/secret. Anything that is a
 * string without spaces (or an array/object serialization) longer than
 * `LONG_SECRET_LENGTH` chars and is NOT a clearly-safe email-agnostic path is
 * considered a potential secret. Used mostly for context values.
 */
export function looksLikeSecret(value: unknown): boolean {
  if (typeof value === 'string') {
    if (value.length <= LONG_SECRET_LENGTH) return false;
    // URLs/paths with spaces are not secrets (e.g. a user-facing path list is
    // riskier; keep the conservative default).
    if (/\s/.test(value)) return false;
    return true;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return false;
  if (value === null || value === undefined) return false;
  // Objects/arrays — serialize and apply the same heuristic.
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === 'string' && looksLikeSecret(serialized);
  } catch {
    return true; // Circular/unsafe → drop it.
  }
}

/** Whether a context key should be dropped for being sensitive/financial. */
export function isSensitiveContextKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (SENSITIVE_KEY_PATTERN.test(lower)) return true;
  if (FINANCIAL_KEY_PATTERN.test(lower)) return true;
  return false;
}

function truncate(value: string | undefined, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  const str = String(value);
  return str.length > max ? str.slice(0, max) : str;
}

/**
 * Sanitizes a single `context` value to a safe primitive (string | number |
 * boolean | null). Nested objects/arrays are rejected — only flat scalar
 * allowlisted keys are kept.
 */
function sanitizeContextValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  return null;
}

/** Sanitizes and filters the context object to the strict allowlist. */
export function sanitizeContext(context: ErrorContext | undefined): ErrorContext {
  if (!context || typeof context !== 'object') return {};

  const out: ErrorContext = {};
  for (const key of Object.keys(context)) {
    if (!CONTEXT_ALLOWLIST.has(key)) continue;
    if (isSensitiveContextKey(key)) continue;

    const value = (context as Record<string, unknown>)[key];
    if (looksLikeSecret(value)) continue;

    const cleaned = sanitizeContextValue(value);
    if (cleaned === null) continue;

    (out as Record<string, unknown>)[key] = cleaned;
  }
  return out;
}

/**
 * Sanitizes a full `ErrorEventInput` before persistence. Returns a new object;
 * the caller's input is never mutated.
 */
export function sanitizeErrorInput(
  input: ErrorEventInput,
): ErrorEventInput {
  const context = sanitizeContext(input.context);
  const safeContext = Object.keys(context).length > 0 ? context : undefined;
  const message = truncate(input.message, MESSAGE_MAX);

  return {
    ...input,
    // An absent/empty message must never persist as blank — default it.
    message: message && message.length > 0 ? message : 'unknown_error',
    name: input.name ? truncate(input.name, 100) : undefined,
    stack: truncate(input.stack, STACK_MAX),
    code: truncate(input.code, CODE_MAX),
    context: safeContext,
  };
}
