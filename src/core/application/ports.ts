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
 */
export interface SessionClaims {
  sub: string;
  email?: string;
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
