import { ValidationError } from "./errors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** AUTH-1: emails are stored normalized (trimmed, lowercase). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface UserInput {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  name?: string;
  locale?: string;
  /** Whether the user has verified ownership of their email (B2). `undefined` === false. */
  emailVerified?: boolean;
}

export class User {
  readonly id: string;
  readonly email: string;
  /** Salted hash only — plain passwords never live in the domain. */
  readonly passwordHash: string;
  readonly createdAt: Date;
  readonly name?: string;
  readonly locale?: string;
  readonly emailVerified?: boolean;

  constructor(input: UserInput) {
    if (input.id.length === 0) {
      throw new ValidationError("User id must not be empty");
    }
    const email = normalizeEmail(input.email);
    if (!EMAIL_PATTERN.test(email)) {
      throw new ValidationError(`Invalid email: ${input.email}`);
    }
    if (input.passwordHash.length === 0) {
      throw new ValidationError("User passwordHash must not be empty");
    }
    this.id = input.id;
    this.email = email;
    this.passwordHash = input.passwordHash;
    this.createdAt = input.createdAt;
    this.name = input.name?.trim() || undefined;
    this.locale = input.locale || undefined;
    this.emailVerified = input.emailVerified;
  }

  toJSON() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      locale: this.locale,
      createdAt: this.createdAt,
      emailVerified: this.emailVerified ?? false,
    };
  }
}
