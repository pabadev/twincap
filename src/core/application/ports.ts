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
