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