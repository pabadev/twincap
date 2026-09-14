import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoAuthTokenRepository } from './auth-token-repository';
import { AuthTokenModel } from '../models/auth-token';

/**
 * R14-F §12: real Mongo tests of the ATOMIC one-time token consumption against
 * an in-memory STANDALONE MongoDB. The consume() operation is a single
 * conditional `updateOne` (filter used:false + expiresAt > now) — document
 * level write serialization works on a standalone node, so MongoMemoryServer
 * (not a replica set) is the right, faster shape, mirroring the §25-C
 * rate-limiter concurrency suite.
 *
 * Exactly one of N concurrent consumes on the same token must win: the
 * conditional filter makes the document-level write lock serialize the
 * callers, and `modifiedCount === 1` is the proof of consumption.
 */
describe(
  'MongoAuthTokenRepository.consume (R14-F §12)',
  () => {
    let mongod: MongoMemoryServer;
    let repo: MongoAuthTokenRepository;

    beforeAll(async () => {
      mongod = await MongoMemoryServer.create();
      await mongoose.connect(mongod.getUri('twincap_auth_token'));
      await AuthTokenModel.init();
      repo = new MongoAuthTokenRepository();
    }, 60_000);

    afterAll(async () => {
      await mongoose.disconnect();
      await mongod.stop();
    }, 60_000);

    beforeEach(async () => {
      await AuthTokenModel.deleteMany({});
    });

    async function seedToken(
      overrides: { used?: boolean; expiresAt?: Date } = {},
    ): Promise<string> {
      const expiresAt =
        overrides.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000);
      const record = await repo.create({
        id: new mongoose.Types.ObjectId().toString(),
        userId: 'user-1',
        purpose: 'password_reset',
        tokenHash: 'hashed:token',
        expiresAt,
        used: overrides.used ?? false,
        createdAt: new Date(),
      });
      return record.id;
    }

    it('consume marks an unused, unexpired token as used and returns true', async () => {
      const id = await seedToken();

      const won = await repo.consume(id);

      expect(won).toBe(true);
      const doc = await AuthTokenModel.findById(id).exec();
      expect(doc?.used).toBe(true);
    });

    it('consume on an already-used token returns false and does not change it', async () => {
      const id = await seedToken({ used: true });

      const won = await repo.consume(id);

      expect(won).toBe(false);
      const doc = await AuthTokenModel.findById(id).exec();
      expect(doc?.used).toBe(true);
    });

    it('consume on an expired token returns false (even if unused)', async () => {
      const id = await seedToken({
        expiresAt: new Date(Date.now() - 1000),
      });

      const won = await repo.consume(id);

      expect(won).toBe(false);
      const doc = await AuthTokenModel.findById(id).exec();
      expect(doc?.used).toBe(false);
    });

    it('consume with an unknown id returns false', async () => {
      const unknownId = new mongoose.Types.ObjectId().toString();

      const won = await repo.consume(unknownId);

      expect(won).toBe(false);
    });

    it('§25-C concurrency: N=40 concurrent consumes → exactly 1 winner, doc ends used', async () => {
      const id = await seedToken();

      const results = await Promise.all(
        Array.from({ length: 40 }, () => repo.consume(id)),
      );

      const winners = results.filter((r) => r);
      expect(winners).toHaveLength(1);
      expect(results.filter((r) => !r)).toHaveLength(39);

      const doc = await AuthTokenModel.findById(id).exec();
      expect(doc?.used).toBe(true);
    });
  },
  60_000,
);

describe(
  'MongoAuthTokenRepository.create — one active token per user+purpose (R15.3.2 P2-3)',
  () => {
    let mongod: MongoMemoryServer;
    let repo: MongoAuthTokenRepository;

    beforeAll(async () => {
      mongod = await MongoMemoryServer.create();
      await mongoose.connect(mongod.getUri('twincap_auth_token_invariant'));
      await AuthTokenModel.init();
      repo = new MongoAuthTokenRepository();
    }, 60_000);

    afterAll(async () => {
      await mongoose.disconnect();
      await mongod.stop();
    }, 60_000);

    beforeEach(async () => {
      await AuthTokenModel.deleteMany({});
    });

    function recordFor(
      userId: string,
      purpose: 'password_reset' | 'email_verify',
      tokenHash: string,
      used = false,
    ): Parameters<typeof repo.create>[0] {
      return {
        id: new mongoose.Types.ObjectId().toString(),
        userId,
        purpose,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        used,
        createdAt: new Date(),
      };
    }

    it('create revokes the previous active token for the same user+purpose (newest wins)', async () => {
      const first = await repo.create(recordFor('user-1', 'password_reset', 'hash:first'));
      const second = await repo.create(recordFor('user-1', 'password_reset', 'hash:second'));

      const firstDoc = await AuthTokenModel.findById(first.id).exec();
      expect(firstDoc?.used).toBe(true);
      const secondDoc = await AuthTokenModel.findById(second.id).exec();
      expect(secondDoc?.used).toBe(false);

      const active = await repo.findActiveByUser('user-1', 'password_reset');
      expect(active?.id).toBe(second.id);
    });

    it('create does not revoke tokens of OTHER purposes or users', async () => {
      const otherPurpose = await repo.create(recordFor('user-1', 'email_verify', 'hash:verify'));
      const otherUser = await repo.create(recordFor('user-2', 'password_reset', 'hash:user2'));

      await repo.create(recordFor('user-1', 'password_reset', 'hash:new'));

      const otherPurposeDoc = await AuthTokenModel.findById(otherPurpose.id).exec();
      expect(otherPurposeDoc?.used).toBe(false);
      const otherUserDoc = await AuthTokenModel.findById(otherUser.id).exec();
      expect(otherUserDoc?.used).toBe(false);
    });

    it('a USED token does not block creating a new one (partial filter only covers used:false)', async () => {
      const consumed = await repo.create(recordFor('user-1', 'password_reset', 'hash:consumed'));
      await repo.consume(consumed.id);
      await repo.create(recordFor('user-1', 'password_reset', 'hash:fresh'));

      const active = await repo.findActiveByUser('user-1', 'password_reset');
      expect(active?.tokenHash).toBe('hash:fresh');
    });

    it('index backstop: two direct used:false inserts for the same user+purpose → E11000', async () => {
      // Bypass the repository to prove the CONSTRAINT itself rejects a second
      // active token even if new code ever forgets the revoke-first call.
      await AuthTokenModel.create({
        userId: 'user-1',
        purpose: 'password_reset',
        tokenHash: 'hash:direct-a',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        used: false,
      });

      await expect(
        AuthTokenModel.create({
          userId: 'user-1',
          purpose: 'password_reset',
          tokenHash: 'hash:direct-b',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          used: false,
        }),
      ).rejects.toMatchObject({ code: 11000 });
    });
  },
  60_000,
);