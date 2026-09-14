import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { resetPassword } from "../../core/application/auth/reset-password";
import { MongoUserRepository } from "../repositories/user-repository";
import { MongoAuthTokenRepository } from "../repositories/auth-token-repository";
import { MongoUnitOfWork } from "./mongo-unit-of-work";
import { UserModel } from "../models/user";
import { AuthTokenModel } from "../models/auth-token";
import { User } from "../../core/domain/user";
import type { UserRepository } from "../../core/domain/repositories";
import type { TransactionHandle } from "../../core/domain/transaction";
import type { AuthEmailDeps } from "../../core/application/auth/email-deps";
import type {
  AuthTokenRecord,
  AuthTokenStore,
  Clock,
  EmailSender,
  IdGenerator,
  PasswordHasher,
} from "../../core/application/ports";

/**
 * R15.3.2 §26 — ATOMICITY of the auth email flows (password reset).
 *
 * REAL repositories + REAL MongoUnitOfWork + REAL use case against a shared
 * single-node MongoMemoryReplSet (binary PINNED to 7.0.41 — same reason as the
 * Fase 2 rollback / Fase 4 CAS suites: latest mongod crashes on Windows).
 *
 * Pre-fix, resetPassword/verifyEmail burned the one-time token (consume) and
 * then wrote the user in TWO separate operations: a failing user update left
 * the token consumed and the operation failed — the user had to request a new
 * token. This suite proves the fix: consume + user update commit or roll back
 * atomically.
 *
 *   1. FAILING update → the exception propagates AND the token remains
 *      usable (used:false) with the password untouched (rollback of consume).
 *   2. SUCCESS → ok:true, token consumed (used:true), password hash changed.
 *
 * Ignored-email sender + trivial hasher keep the test fast; the only REAL
 * parts are the Mongo repos, the unit of work and the transaction itself.
 */
describe("R15.3.2 §26 — auth flows atomicity (consume + user update)", () => {
  let mongod: MongoMemoryReplSet;
  let userRepo: MongoUserRepository;
  let tokenRepo: MongoAuthTokenRepository;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: "7.0.41" },
      replSet: { count: 1, name: "rs0" },
    });
    await mongoose.connect(mongod.getUri("twincap_auth_atomicity"));
    userRepo = new MongoUserRepository();
    tokenRepo = new MongoAuthTokenRepository();
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 30_000);

  beforeEach(async () => {
    await UserModel.deleteMany({});
    await AuthTokenModel.deleteMany({});
  });

  async function seedUser(email: string): Promise<User> {
    return userRepo.create(
      new User({
        id: new mongoose.Types.ObjectId().toString(),
        email,
        passwordHash: "hashed:original-password",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        name: "Atomic Tester",
        locale: "en",
        emailVerified: false,
        sessionVersion: 0,
      }),
    );
  }

  async function seedResetToken(
    userId: string,
    token = "reset-token",
  ): Promise<AuthTokenRecord> {
    return tokenRepo.create({
      id: new mongoose.Types.ObjectId().toString(),
      userId,
      purpose: "password_reset",
      tokenHash: `hashed:${token}`,
      // Future relative to the REAL clock (findActiveByUser/consume filter on
      // `new Date()`, not on the injected clock).
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      used: false,
      createdAt: new Date(),
    });
  }

  function makeDeps(
    userRepo_me: UserRepository,
    tokenStore: AuthTokenStore,
  ): AuthEmailDeps {
    const clock: Clock = { now: () => new Date() };
    const hasher: PasswordHasher = {
      hash: async (plain) => `hashed:${plain}`,
      compare: async (plain, hashed) => hashed === `hashed:${plain}`,
    };
    const emailSender: EmailSender = {
      sendPasswordReset: async () => {},
      sendEmailVerification: async () => {},
    };
    const ids: IdGenerator = { generate: () => `id-${Date.now()}` };
    return {
      userRepo: userRepo_me,
      tokenStore,
      hasher,
      ids,
      clock,
      emailSender,
      generateToken: () => "reset-token",
      baseUrl: "https://app.twincap.example",
    };
  }

  /** Wraps a UserRepository and makes update() throw BEFORE touching the DB —
   *  simulates a mid-transaction failure AFTER the token consume write. The
   *  transaction abort must roll the consume back. */
  class FailingUpdateUserRepository implements UserRepository {
    constructor(private readonly inner: UserRepository) {}

    findById(id: string): Promise<User | null> {
      return this.inner.findById(id);
    }

    findByEmail(email: string): Promise<User | null> {
      return this.inner.findByEmail(email);
    }

    create(user: User, tx?: TransactionHandle): Promise<User> {
      return this.inner.create(user, tx);
    }

    update(_user: User, _tx?: TransactionHandle): Promise<User> {
      throw new Error("simulated update failure");
    }

    delete(id: string): Promise<void> {
      return this.inner.delete(id);
    }
  }

  it("rolls the token consumption back when the user update fails (R15.3.2 §26)", async () => {
    const user = await seedUser("failing@example.com");
    const token = await seedResetToken(user.id, "reset-token");

    const failingRepo = new FailingUpdateUserRepository(userRepo);
    const deps = makeDeps(failingRepo, tokenRepo);

    await expect(
      resetPassword(
        { email: "failing@example.com", token: "reset-token", newPassword: "new-pass-123" },
        deps,
        new MongoUnitOfWork(),
      ),
    ).rejects.toThrow("simulated update failure");

    // The consume was rolled back: the token is STILL active (used:false).
    const active = await tokenRepo.findActiveByUser(user.id, "password_reset");
    expect(active).not.toBeNull();
    expect(active!.used).toBe(false);

    const tokenDoc = await AuthTokenModel.findById(token.id);
    expect(tokenDoc!.used).toBe(false);

    // The password hash was NOT changed.
    const userDoc = await UserModel.findById(user.id);
    expect(userDoc!.passwordHash).toBe("hashed:original-password");
  }, 60_000);

  it("commits consume + password update atomically on success", async () => {
    const user = await seedUser("happy@example.com");
    const token = await seedResetToken(user.id, "reset-token");

    const deps = makeDeps(userRepo, tokenRepo);
    const result = await resetPassword(
      { email: "happy@example.com", token: "reset-token", newPassword: "new-pass-123" },
      deps,
      new MongoUnitOfWork(),
    );

    expect(result.ok).toBe(true);

    // Token consumed (used:true), no longer active.
    const tokenDoc = await AuthTokenModel.findById(token.id);
    expect(tokenDoc!.used).toBe(true);
    expect(await tokenRepo.findActiveByUser(user.id, "password_reset")).toBeNull();

    // Password hash CHANGED.
    const userDoc = await UserModel.findById(user.id);
    expect(userDoc!.passwordHash).toBe("hashed:new-pass-123");
  }, 60_000);
});