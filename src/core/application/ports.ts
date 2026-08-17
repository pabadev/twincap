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
 * Session management — jose JWE A256GCM, payload {sub} (design §6).
 * create() returns an encrypted JWE token; verify() returns the payload or null.
 */
export interface SessionManager {
  create(userId: string): Promise<string>;
  verify(token: string): Promise<{ sub: string } | null>;
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
