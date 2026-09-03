import { createHash } from 'node:crypto';
import type {
  ErrorEventInput,
  ErrorReporter,
  ErrorSeverity,
} from '../../core/application/ports';
import { connectDb } from '../db/connection';
import { MongoErrorEventRepository } from '../repositories/error-event-repository';
import { sanitizeErrorInput } from './sanitize';
import { alertOnIncident } from './error-alerter';
import type { AlertDispatcher } from './error-alerter';

/**
 * Central fail-safe error monitor (R13-D).
 *
 * Responsibilities:
 *   1. Compute a STABLE fingerprint (SHA-1) for an exception so that repeated
 *      occurrences of the "same" crash group into one incident (dedupe).
 *   2. Sanitize the payload (strict allowlist, truncation — see sanitize.ts).
 *   3. Persist via the injected `ErrorReporter` (default: Mongo).
 *   4. Alert (email) ONLY on the FIRST occurrence of an unexpected
 *      fatal|error incident (see error-alerter.ts for throttle rationale).
 *
 * FAIL-SAFE GUARANTEE: this function NEVER throws. Any failure at any step is
 * swallowed and, where sensible, surfaced as a structured stderr JSON line so
 * the caller's original operation/flow is NEVER broken by reporting.
 *
 * Consumers do NOT need to wrap `reportError` in their own try/catch — but
 * they may, defensively.
 */

/** Primary number of stack lines used for the fingerprint normalization. */
const PRIMARY_STACK_LINES = 3;
/** Prefix of the hashed fingerprint. */
const FINGERPRINT_PREFIX = 'err';

/**
 * Normalizes a stack trace so that line/column numbers and file-pathing
 * differences between identical exceptions collapse to the same form:
 *   - keeps the first `PRIMARY_STACK_LINES` meaningful lines,
 *   - strips line:column numbers (`:123:45`),
 *   - strips absolute paths, `file://`, `webpack://`, `node:internal`,
 *     `node_modules`, and Windows drive letters.
 */
export function normalizeStack(stack: string | undefined): string {
  if (!stack) return '';
  return stack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, PRIMARY_STACK_LINES)
    .map((line) => {
      let l = line
        .replace(/:(\d+):(\d+)/g, '') // line:col
        .replace(/:(\d+)/g, '') // trailing lone line number
        .replace(/file:\/\/\//gi, '/')
        .replace(/webpack:\/\//gi, '')
        .replace(/node:internal\//gi, 'internal/')
        .replace(/node_modules\//gi, 'nm/');
      // Windows absolute path drives (C:\...) → collapse to relative-like.
      l = l.replace(/[A-Za-z]:\\/g, '');
      l = l.replace(/\\/g, '/');
      // Trim redundant whitespace.
      l = l.replace(/\s+/g, ' ').trim();
      return reduceFrameToBasename(l);
    })
    .filter((line) => line.length > 0)
    .join('\n');
}

/**
 * Reduces a normalized stack frame to `functionOrClass + fileBasename`,
 * discarding the full directory path. This is what makes absolute-path and
 * bundler-path variants (file://, webpack://) of the same source file collapse
 * to the same fingerprint while still discriminating function/source.
 */
function reduceFrameToBasename(line: string): string {
  const paren = line.match(/\(([^)]*)\)/);
  const pathPart = (paren ? paren[1] : line).trim();
  const segments = pathPart.split(/[\\/]/);
  const basename = segments[segments.length - 1] ?? '';
  const prefix = line.split('(')[0].trim();
  return `${prefix} ${basename}`.trim();
}

/** The primary stack frame (first normalized line) used for grouping. */
function primaryStackFrame(stack: string | undefined): string {
  const normalized = normalizeStack(stack);
  const firstLine = normalized.split('\n')[0] ?? '';
  return firstLine;
}

/**
 * Deterministic SHA-1 fingerprint of an exception.
 * Same inputs → same hash. Line/column/absolute-path variations are smoothed
 * so repeated occurrences of the same underlying crash share a fingerprint.
 */
export function computeFingerprint(input: {
  name?: string;
  message: string;
  code?: string;
  stack?: string;
}): string {
  const name = input.name || 'Error';
  // Normalize the message case-wise but keep its content (messages carry the
  // semantic signature of the error).
  const normalizedMessage = (input.message || 'unknown_error').trim();

  const primaryFrame = primaryStackFrame(input.stack);
  const hash = createHash('sha1')
    .update(
      `${name}::${normalizedMessage}::${input.code || ''}::${primaryFrame}`,
    )
    .digest('hex');
  return `${FINGERPRINT_PREFIX}_${hash}`;
}

export interface MonitorDeps {
  /** Persistence reporter; default Mongo. Injected for tests. */
  reporter: ErrorReporter;
  /** Alert dispatcher; default Resend-based. Injected for tests. */
  alerter: AlertDispatcher;
  /** Clock for `occurredAt`. Default real clock. */
  now: () => Date;
  /** Fingerprint function; default computeFingerprint. Injected for tests. */
  fingerprint: typeof computeFingerprint;
  /** Environment override; defaults to NODE_ENV. */
  environment: string;
  /** Release override; defaults to env APP_RELEASE. */
  release: string;
}

/**
 * Report an exception to the error monitoring backend. NEVER throws.
 *
 * Path: fingerprint → sanitize → reporter.report → (if first unexpected
 * fatal|error) alerter. Returns `{ isFirst, occurrenceCount }` or null when
 * reporting is disabled or fails silently.
 */
export async function reportError(
  input: Omit<ErrorEventInput, 'fingerprint' | 'environment' | 'release'> &
    Partial<Pick<ErrorEventInput, 'environment' | 'release'>> & {
      context?: ErrorEventInput['context'];
    },
  deps?: Partial<MonitorDeps>,
): Promise<{ isFirst: boolean; occurrenceCount: number } | null> {
  try {
    // Read the opt-in gate and release directly from process.env (NOT the full
    // env schema): monitoring must stay decoupled from the DB/auth env being
    // valid, and must remain testable without those vars set.
    const monitoringEnabled = process.env.ERROR_MONITORING_ENABLED === 'true';

    // Master switch (R13-D #4): opt-in, default false. When an explicit
    // `reporter` dep is injected (tests / advanced callers that opted in
    // themselves) we bypass this env gate; production consumers go through it.
    const injectedReporter = deps?.reporter !== undefined;
    if (!injectedReporter && !monitoringEnabled) {
      return null;
    }

    const environment =
      deps?.environment ??
      input.environment ??
      process.env.NODE_ENV ??
      'development';
    const release = deps?.release ?? input.release ?? process.env.APP_RELEASE ?? '';

    const fingerprintFn = deps?.fingerprint ?? computeFingerprint;
    const fingerprint = fingerprintFn(input);

    const sanitized = sanitizeErrorInput({
      ...input,
      message: input.message,
      name: input.name,
      stack: input.stack,
      severity: input.severity,
      expected: input.expected,
      code: input.code,
      context: input.context,
      occurredAt: deps?.now ? deps.now() : input.occurredAt,
      fingerprint,
      environment,
      release,
    });

    // Resolve implementation dependencies (production defaults created INSIDE
    // reportError, per AGENTS rule — never at module level).
    if (!deps?.reporter) {
      await connectDb();
    }
    const reporter: ErrorReporter = deps?.reporter ?? new MongoErrorEventRepository();

    const result = await reporter.report(sanitized);

    // Alert only on the FIRST occurrence of an unexpected fatal|error. Isolated
    // in its own try/catch so a throwing alerter never discards the reporter
    // result (which already persisted successfully) and never propagates.
    if (result.isFirst && !sanitized.expected) {
      const sev = (sanitized.severity ?? 'error') as ErrorSeverity;
      if (sev === 'fatal' || sev === 'error') {
        try {
          const alerter: AlertDispatcher = deps?.alerter ?? alertOnIncident;
          await alerter({ input: sanitized, isFirst: result.isFirst });
        } catch {
          // Fail-safe: an alert failure must not lose the persisted result.
        }
      }
    }

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'error_report_failed',
        name: input.name,
        code: input.code,
        error: message,
      }),
    );
    return null;
  }
}
