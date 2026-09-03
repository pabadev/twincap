import { describe, it, expect } from 'vitest';
import { requestPasswordReset } from './request-password-reset';
import { resetPassword } from './reset-password';
import { verifyEmail } from './verify-email';
import { resendVerification } from './resend-verification';
import {
  issueVerificationEmail,
  PASSWORD_RESET_TTL_MS,
  EMAIL_VERIFICATION_TTL_MS,
  INVALID_TOKEN_MESSAGE,
} from './email-deps';
import { ValidationError, NotFoundError } from '../../domain/errors';
import type { UserRepository } from '../../domain/repositories';
import type {
  AuthTokenStore,
  AuthTokenRecord,
  EmailSender,
  PasswordHasher,
  IdGenerator,
  Clock,
} from '../ports';
import type { User } from '../../domain/user';
import type { AuthEmailDeps } from './email-deps';

// ─── Fakes ─────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashed:old',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  } as User;
}

interface TokenRepo extends AuthTokenStore {
  records: AuthTokenRecord[];
  lastMarked: { userId: string; purpose: string }[];
}

function fakeTokenStore(now: () => Date = () => new Date()): TokenRepo {
  const records: AuthTokenRecord[] = [];
  const lastMarked: TokenRepo['lastMarked'] = [];
  return {
    records,
    lastMarked,
    create: async (record) => {
      records.push(record);
      return record;
    },
    findActiveByUser: async (userId, purpose) => {
      const found = records
        .filter(
          (r) =>
            r.userId === userId &&
            r.purpose === purpose &&
            !r.used &&
            r.expiresAt.getTime() > now().getTime(),
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      return found ?? null;
    },
    markUsed: async (userId, purpose) => {
      lastMarked.push({ userId, purpose });
      for (const r of records) {
        if (r.userId === userId && r.purpose === purpose && !r.used) r.used = true;
      }
    },
    deleteExpired: async () => {
      const current = now().getTime();
      for (let i = records.length - 1; i >= 0; i--) {
        if (records[i].expiresAt.getTime() <= current) records.splice(i, 1);
      }
    },
  };
}

interface UserRepo extends UserRepository {
  users: User[];
  updated: User[];
  findByEmailResult: User | null;
}

function fakeUserRepo(): UserRepo {
  const users: User[] = [];
  const updated: User[] = [];
  const repo: UserRepo = {
    users,
    updated,
    findByEmailResult: null,
    findById: async (id) => users.find((u) => u.id === id) ?? null,
    findByEmail: async () => repo.findByEmailResult ?? null,
    create: async (user) => {
      users.push(user);
      return user;
    },
    update: async (user) => {
      updated.push(user);
      const idx = users.findIndex((u) => u.id === user.id);
      if (idx >= 0) users[idx] = user;
      else users.push(user);
      return user;
    },
    delete: async (id) => {
      const idx = users.findIndex((u) => u.id === id);
      if (idx >= 0) users.splice(idx, 1);
    },
  };
  return repo;
}

function fakeSender(): EmailSender & { resetLinks: string[]; verifyLinks: string[] } {
  const resetLinks: string[] = [];
  const verifyLinks: string[] = [];
  return {
    resetLinks,
    verifyLinks,
    sendPasswordReset: async (p) => {
      resetLinks.push(`${p.baseUrl}/reset-password?token=${p.token}&email=${p.to}`);
    },
    sendEmailVerification: async (p) => {
      verifyLinks.push(`${p.baseUrl}/verify-email?token=${p.token}&email=${p.to}`);
    },
  };
}

function fakeHasher(): PasswordHasher {
  return {
    hash: async (plain) => `hashed:${plain}`,
    compare: async (plain, hashed) => hashed === `hashed:${plain}`,
  };
}

/** Concrete fake-deps type: keeps the enriched fields visible to assertions. */
interface TestDeps extends AuthEmailDeps {
  userRepo: UserRepo;
  tokenStore: TokenRepo;
  emailSender: ReturnType<typeof fakeSender>;
}

function fakeDeps(repo: UserRepo, token: string = 'plain-token'): TestDeps {
  const sender = fakeSender();
  const clock = { now: () => new Date('2024-06-01T00:00:00Z') } as Clock;
  const tokenStore = fakeTokenStore(clock.now);
  const hasher = fakeHasher();
  const deps: TestDeps = {
    userRepo: repo,
    tokenStore,
    hasher,
    ids: { generate: () => `token-id-${tokenStore.records.length + 1}` } as IdGenerator,
    clock,
    emailSender: sender,
    generateToken: () => token,
    baseUrl: 'https://app.twincap.example',
  };
  return deps;
}

// ─── requestPasswordReset ──────────────────────────────────────────

describe('requestPasswordReset', () => {
  it('sends a reset email with the plain token and stores its HASH', async () => {
    const repo = fakeUserRepo();
    repo.findByEmailResult = makeUser();
    const deps = fakeDeps(repo, 'my-secret-token');

    const result = await requestPasswordReset({ email: '  TEST@Example.COM ' }, deps);

    expect(result.ok).toBe(true);
    // Plain token is NEVER stored, only its hash.
    expect(deps.tokenStore.records).toHaveLength(1);
    expect(deps.tokenStore.records[0].tokenHash).toBe('hashed:my-secret-token');
    expect(deps.tokenStore.records[0].purpose).toBe('password_reset');
    expect(deps.tokenStore.records[0].expiresAt.getTime()).toBe(
      new Date('2024-06-01T00:00:00Z').getTime() + PASSWORD_RESET_TTL_MS,
    );
    // Email link carries the PLAIN token.
    expect(deps.emailSender.resetLinks).toHaveLength(1);
    expect(deps.emailSender.resetLinks[0]).toContain('token=my-secret-token');
    expect(deps.emailSender.resetLinks[0]).toContain('email=test@example.com');
  });

  it('anti-enumeration: unknown email returns ok without creating a token or sending', async () => {
    const repo = fakeUserRepo(); // findByEmailResult = null
    const deps = fakeDeps(repo);

    const result = await requestPasswordReset({ email: 'nobody@example.com' }, deps);

    expect(result.ok).toBe(true);
    expect(deps.tokenStore.records).toHaveLength(0);
    expect(deps.emailSender.resetLinks).toHaveLength(0);
  });
});

// ─── resetPassword ─────────────────────────────────────────────────

describe('resetPassword', () => {
  function seedActiveResetToken(deps: TestDeps, user: User, token = 'reset-token') {
    const expiresAt = new Date(
      deps.clock.now().getTime() + PASSWORD_RESET_TTL_MS,
    );
    deps.tokenStore.records.push({
      id: 'stored-1',
      userId: user.id,
      purpose: 'password_reset',
      tokenHash: `hashed:${token}`,
      expiresAt,
      used: false,
      createdAt: deps.clock.now(),
    });
  }

  it('updates the password hash and marks the token used', async () => {
    const repo = fakeUserRepo();
    const user = makeUser();
    repo.findByEmailResult = user;
    const deps = fakeDeps(repo);
    seedActiveResetToken(deps, user, 'reset-token');

    const result = await resetPassword(
      { email: 'TEST@Example.com', token: 'reset-token', newPassword: 'new-pass-123' },
      deps,
    );

    expect(result.ok).toBe(true);
    expect(deps.userRepo.updated).toHaveLength(1);
    expect(deps.userRepo.updated[0].passwordHash).toBe('hashed:new-pass-123');
    // One-time use.
    expect(deps.tokenStore.lastMarked).toEqual([
      { userId: 'user-1', purpose: 'password_reset' },
    ]);
    expect(deps.tokenStore.records[0].used).toBe(true);
  });

  it('rejects an expired token with the unified message', async () => {
    const repo = fakeUserRepo();
    const user = makeUser();
    repo.findByEmailResult = user;
    const deps = fakeDeps(repo);
    deps.tokenStore.records.push({
      id: 'stored-1',
      userId: user.id,
      purpose: 'password_reset',
      tokenHash: `hashed:reset-token`,
      expiresAt: new Date('2020-01-01T00:00:00Z'), // expired
      used: false,
      createdAt: new Date('2020-01-01T00:00:00Z'),
    });

    await expect(
      resetPassword(
        { email: 'test@example.com', token: 'reset-token', newPassword: 'new-pass-123' },
        deps,
      ),
    ).rejects.toThrow(INVALID_TOKEN_MESSAGE);
  });

  it('rejects a wrong token with the unified message', async () => {
    const repo = fakeUserRepo();
    const user = makeUser();
    repo.findByEmailResult = user;
    const deps = fakeDeps(repo);
    seedActiveResetToken(deps, user, 'reset-token');

    await expect(
      resetPassword(
        { email: 'test@example.com', token: 'wrong-token', newPassword: 'new-pass-123' },
        deps,
      ),
    ).rejects.toThrow(INVALID_TOKEN_MESSAGE);
  });

  it('rejects a short password with ValidationError', async () => {
    const repo = fakeUserRepo();
    const user = makeUser();
    repo.findByEmailResult = user;
    const deps = fakeDeps(repo);
    seedActiveResetToken(deps, user, 'reset-token');

    await expect(
      resetPassword({ email: 'test@example.com', token: 'reset-token', newPassword: 'short' }, deps),
    ).rejects.toThrow(ValidationError);
  });
});

// ─── verifyEmail ───────────────────────────────────────────────────

describe('verifyEmail', () => {
  function seedActiveVerifyToken(deps: TestDeps, user: User, token = 'verify-token') {
    const expiresAt = new Date(
      deps.clock.now().getTime() + EMAIL_VERIFICATION_TTL_MS,
    );
    deps.tokenStore.records.push({
      id: 'stored-2',
      userId: user.id,
      purpose: 'email_verify',
      tokenHash: `hashed:${token}`,
      expiresAt,
      used: false,
      createdAt: deps.clock.now(),
    });
  }

  it('sets emailVerified to true and marks the token used', async () => {
    const repo = fakeUserRepo();
    const user = makeUser({ emailVerified: false });
    repo.findByEmailResult = user;
    const deps = fakeDeps(repo);
    seedActiveVerifyToken(deps, user, 'verify-token');

    const result = await verifyEmail({ email: 'test@example.com', token: 'verify-token' }, deps);

    expect(result.ok).toBe(true);
    expect(deps.userRepo.updated).toHaveLength(1);
    expect(deps.userRepo.updated[0].emailVerified).toBe(true);
    expect(deps.tokenStore.lastMarked).toEqual([
      { userId: 'user-1', purpose: 'email_verify' },
    ]);
  });

  it('rejects an invalid token', async () => {
    const repo = fakeUserRepo();
    const user = makeUser();
    repo.findByEmailResult = user;
    const deps = fakeDeps(repo);
    seedActiveVerifyToken(deps, user, 'verify-token');

    await expect(
      verifyEmail({ email: 'test@example.com', token: 'bogus' }, deps),
    ).rejects.toThrow(INVALID_TOKEN_MESSAGE);
  });
});

// ─── resendVerification ────────────────────────────────────────────

describe('resendVerification', () => {
  it('issues a fresh verification email for an unverified user', async () => {
    const repo = fakeUserRepo();
    repo.users.push(makeUser({ emailVerified: false }));
    const deps = fakeDeps(repo, 'fresh-token');

    const result = await resendVerification({ userId: 'user-1' }, deps);

    expect(result.ok).toBe(true);
    expect(result.alreadyVerified).toBe(false);
    expect(deps.emailSender.verifyLinks).toHaveLength(1);
    expect(deps.tokenStore.records[0].tokenHash).toBe('hashed:fresh-token');
  });

  it('is a no-op (no token/email) when already verified', async () => {
    const repo = fakeUserRepo();
    repo.users.push(makeUser({ emailVerified: true }));
    const deps = fakeDeps(repo);

    const result = await resendVerification({ userId: 'user-1' }, deps);

    expect(result.ok).toBe(true);
    expect(result.alreadyVerified).toBe(true);
    expect(deps.tokenStore.records).toHaveLength(0);
    expect(deps.emailSender.verifyLinks).toHaveLength(0);
  });

  it('throws NotFoundError when the user does not exist', async () => {
    const repo = fakeUserRepo();
    const deps = fakeDeps(repo);

    await expect(resendVerification({ userId: 'nope' }, deps)).rejects.toThrow(
      NotFoundError,
    );
  });
});

// ─── issueVerificationEmail helper ─────────────────────────────────

describe('issueVerificationEmail', () => {
  it('stores the hashed token and sends a verification email', async () => {
    const repo = fakeUserRepo();
    const deps = fakeDeps(repo, 'helper-token');

    await issueVerificationEmail(
      { id: 'user-1', email: 'test@example.com' },
      deps,
      deps.clock.now(),
    );

    expect(deps.tokenStore.records).toHaveLength(1);
    expect(deps.tokenStore.records[0].tokenHash).toBe('hashed:helper-token');
    expect(deps.emailSender.verifyLinks).toHaveLength(1);
    expect(deps.emailSender.verifyLinks[0]).toContain('token=helper-token');
  });
});
