/**
 * Application ports (interfaces) that use cases depend on.
 *
 * Design rules (rev.2):
 * - NO UnitOfWork (removed — no multi-doc transactions on shared Atlas tier).
 * - Pure TypeScript, no external imports.
 * - Implementation lives in the infrastructure layer (task 2.1).
 */

/** Password hashing — bcryptjs cost 12 (design §6). */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hashed: string): Promise<boolean>;
}

/**
 * Claims carried inside the encrypted session token.
 * `email` is denormalized into the session so layouts can render it without
 * a per-navigation DB roundtrip (P5). Absent in sessions created before this
 * field existed — consumers must fall back gracefully.
 * `workspaceId` is the denormalized tenant id of the user's active personal
 * workspace. Absent for legacy sessions and resolved/backfilled by
 * `getCurrentUser` or set at login/register.
 */
export interface SessionClaims {
  sub: string;
  email?: string;
  workspaceId?: string;
}

/**
 * Session management — jose JWE A256GCM (design §6).
 * create() returns an encrypted JWE token; verify() returns the claims or null.
 */
export interface SessionManager {
  create(claims: SessionClaims): Promise<string>;
  verify(token: string): Promise<SessionClaims | null>;
}

/** Abstract time source for testability. */
export interface Clock {
  now(): Date;
}

/**
 * Deterministic id generation — crypto.randomUUID wrapper (design rev.1 §1).
 * Extracted as a port so tests can inject deterministic values.
 */
export interface IdGenerator {
  generate(): string;
}

/**
 * Audit log — durable, structured record of critical financial operations.
 *
 * Infrastructure-level out port (NOT a domain entity, per R12 C2). Records the
 * minimal metadata about an operation: who, what, on which entity, outcome,
 * correlation and timing. Deliberately excludes PII (no emails, names, tokens,
 * payloads, entity snapshots or stack traces).
 */
export interface OperationLogRecord {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  result: 'success' | 'error' | 'duplicate';
  correlationId?: string;
  durationMs?: number;
  errorCode?: string;
  occurredAt: Date;
}

export interface OperationLogger {
  log(record: OperationLogRecord): Promise<void>;
}

// ─── Transactional email / auth tokens (R13-B) ────────────────────────────

/**
 * Transactional email sender (R13-B). Implementation lives in infrastructure
 * and may fall back to console logging when no provider key is configured
 * (dev mode). The callers (auth use cases) treat sending as best-effort: a
 * failure to send must never block the underlying operation (register, reset).
 */
export interface EmailSender {
  /** Password reset email with a one-time reset link. */
  sendPasswordReset(payload: {
    to: string;
    token: string;
    baseUrl: string;
    locale?: string;
  }): Promise<void>;
  /** Email verification with a one-time verify link. */
  sendEmailVerification(payload: {
    to: string;
    token: string;
    baseUrl: string;
    locale?: string;
  }): Promise<void>;
}

/** Purpose of a one-time auth token. */
export type AuthTokenPurpose = 'password_reset' | 'email_verify';

/**
 * Persisted record for a hashed one-time auth token.
 *
 * The PLAIN token is never persisted — only `tokenHash` (bcrypt) is stored.
 * The plain value travels only from the use case to the email sender.
 */
export interface AuthTokenRecord {
  id: string;
  userId: string;
  purpose: AuthTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

// ─── Error monitoring / alerting (R13-D) ──────────────────────────────────

/**
 * Severity of an error event. `fatal` and `error` are alert-worthy when the
 * event is UNEXPECTED; `warning` never triggers an alert on its own.
 */
export type ErrorSeverity = 'fatal' | 'error' | 'warning';

/**
 * Extensible structured context for an error event (R13-D).
 *
 * The index signature lets callers attach additional keys without breaking the
 * interface. Consumers must sanitize before persisting (never store
 * passwords, JWTs, cookies, auth headers, full bodies, amounts or PII beyond
 * `userId`/`workspaceId`). `userId`/`workspaceId` are captured from the start
 * (workspaceId is pre-wired though Workspace is not yet implemented).
 */
export interface ErrorContext {
  userId?: string;
  workspaceId?: string;
  path?: string;
  method?: string;
  userAgent?: string;
  correlationId?: string;
  [key: string]: unknown;
}

/**
 * Payload describing an exception to report to the error monitoring backend.
 *
 * `expected` distinguishes KNOWN/expected errors (validation, authorization,
 * ordinary business rules — persisted but NEVER alerted) from UNEXPECTED
 * errors/crashes (which may alert). The sanitizer strips PII before
 * persistence regardless of this flag.
 */
export interface ErrorEventInput {
  message: string;
  name?: string;
  stack?: string;
  severity: ErrorSeverity;
  expected: boolean;
  code?: string;
  context?: ErrorContext;
  occurredAt?: Date;
  /**
   * Stable dedupe key computed by the monitor (R13-D). Optional at the port
   * level so a generic consumer can report without pre-computing it; the Mongo
   * implementation requires it for upsert, and the default monitor always
   * provides it.
   */
  fingerprint?: string;
  /** Environment (e.g. 'development' | 'production'). Defaults to NODE_ENV. */
  environment?: string;
  /** Optional release/git sha. */
  release?: string;
}

/**
 * Out port for the error monitoring system (R13-D).
 *
 * Deliberately SEPARATE from `OperationLogger` (which records operations with
 * an actor, for auditing). `ErrorReporter` records EXCEPTIONS/incidents. The
 * initial implementation persists to MongoDB and alerts via Resend; a future
 * `SentryErrorReporter` can replace it without touching consumers.
 */
export interface ErrorReporter {
  /**
   * Records an error event, deduplicating by fingerprint. Returns whether this
   * was the FIRST occurrence of the fingerprint (used by the monitor to gate
   * anti-spam alerting). Must NEVER throw — fail-safe.
   */
  report(input: ErrorEventInput): Promise<{ isFirst: boolean; occurrenceCount: number }>;
}

// ─── Product analytics (R13-G) ────────────────────────────────────────────

/**
 * Product analytics event names for activation/retention/usage tracking (R13-G).
 *
 * Events are intentionally minimal — no PII, no payloads, no entity snapshots.
 * The event name alone, scoped by workspaceId, is sufficient for the metrics
 * the beta needs.
 */
export type AnalyticsEventName =
  | 'register'
  | 'firstLogin'
  | 'accountCreated'
  | 'firstMovement'
  | 'dashboardViewed'
  | 'saleCreated';

/**
 * Out port for product analytics (R13-G). Deliberately SEPARATE from
 * `OperationLogger` (audit trail) and `ErrorReporter` (error monitoring).
 *
 * Implementations are best-effort: a failure to track must NEVER break the
 * operation it accompanies. Fire-and-forget semantics.
 */
export interface AnalyticsReporter {
  /**
   * Records a product analytics event. Must NEVER throw — fail-safe.
   * For "first" events (firstLogin, firstMovement), the implementation
   * deduplicates by workspaceId + eventName (one doc per workspace per
   * "first" event).
   */
  track(input: {
    eventName: AnalyticsEventName;
    workspaceId: string;
    userId: string;
  }): Promise<void>;
}

/**
 * Authorization policy for the PRODUCT analytics dashboard (R13-G).
 *
 * Decides whether a given user may view PRODUCT metrics (the /analytics page
 * showing aggregates across ALL workspaces). This is deliberately a SEPARATE
 * concern from the analytics EVENTS themselves: tracking is workspace-scoped,
 * but product metrics are a business asset visible only to designated people.
 *
 * The decision is centralized here — NOT in the page or actions — so the
 * authorization rule can evolve over time (e.g. adding role-based access for
 * an analytics team) WITHOUT touching consumers. Consumers only call
 * `canView(userId)` / `canViewCurrent(user)`.
 *
 * Design (R13-G hardening, per founder's decision):
 * - TODAY: access is restricted to an explicit allowlist of founder emails
 *   (env `ANALYTICS_ACCESS_EMAILS`). This is the only access path in beta.
 * - FUTURE: when a distinct analytics role exists (e.g. `analyst` in
 *   MembershipRole), this port will also authorize users holding that role.
 *   The policy interface already supports role-based checks so that extension
 *   requires NO change to the page or consumer code.
 */
export interface AnalyticsAuthorizer {
  /** Whether a user (by id and email) may view product analytics. */
  canView(userId: string, email: string): Promise<boolean>;
}

/**
 * Persistence port for hashed one-time auth tokens (password reset + email
 * verify). One active token per user+purpose; a used token is revoked.
 */
export interface AuthTokenStore {
  create(record: AuthTokenRecord): Promise<AuthTokenRecord>;
  /** Active (not used, not expired) token hash for a user+purpose, if any. */
  findActiveByUser(
    userId: string,
    purpose: AuthTokenPurpose,
  ): Promise<AuthTokenRecord | null>;
  /** Revoke (mark used) the active token for a user+purpose. */
  markUsed(userId: string, purpose: AuthTokenPurpose): Promise<void>;
  /** Opportunistic cleanup of expired tokens (TTL index also handles it). */
  deleteExpired(): Promise<void>;
}
