import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoRateLimiter } from './rate-limiter';
import { RateLimitModel } from '../models/rate-limit';

/**
 * R14-C §25-C: real concurrency test of the atomic limiter against an
 * in-memory STANDALONE MongoDB. Real MongoDB transactions need a replica set,
 * but the limiter only relies on atomic `$inc` — document-level write
 * serialization works on a standalone single node, so MongoMemoryServer (not
 * MongoMemoryReplSet) is the right, faster shape here.
 *
 * The unique index on `key` (R14-C) guarantees one document per key, so 40
 * concurrent `findOneAndUpdate` + `$inc` calls serialize on the same doc —
 * every attempt is counted exactly once, with no find-then-save race.
 */
describe(
  'MongoRateLimiter concurrency (R14-C §25-C)',
  () => {
    let mongod: MongoMemoryServer;

    beforeAll(async () => {
      mongod = await MongoMemoryServer.create();
      await mongoose.connect(mongod.getUri('twincap_ratelimit'));
      // Ensure the unique index on `key` exists before firing concurrent writes
      // (autoIndex would also create it, but explicit init() is deterministic).
      await RateLimitModel.init();
    }, 60_000);

    afterAll(async () => {
      await mongoose.disconnect();
      await mongod.stop();
    }, 60_000);

    beforeEach(async () => {
      await RateLimitModel.deleteMany({});
    });

    it('counts N concurrent attempts exactly (first-creation race, §25-C)', async () => {
      const limiter = new MongoRateLimiter({ maxAttempts: 5, windowMs: 60_000 });

      const results = await Promise.all(
        Array.from({ length: 40 }, () => limiter.check('concurrent:key')),
      );

      const allowed = results.filter((r) => r.allowed);
      const blocked = results.filter((r) => !r.allowed);

      // Exactly the first 5 serialized increments are allowed.
      expect(allowed).toHaveLength(5);
      expect(blocked).toHaveLength(35);

      // Each $inc serialized on the single document → attempts values are the
      // set 1..40, each exactly once (no lost or duplicated counts).
      const attempts = results.map((r) => r.attempts).sort((a, b) => a - b);
      expect(attempts).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));

      // Every result carries a valid resetAt Date.
      for (const r of results) {
        expect(r.resetAt).toBeInstanceOf(Date);
        expect(Number.isNaN(r.resetAt.getTime())).toBe(false);
      }
    });

    it('counting resumes after the window lapses', async () => {
      const limiter = new MongoRateLimiter({ maxAttempts: 5, windowMs: 60_000 });

      // Build up some attempts on a fresh bucket, then force the window stale.
      await limiter.check('concurrent:key');
      await Promise.all([
        limiter.check('concurrent:key'),
        limiter.check('concurrent:key'),
      ]);
      await RateLimitModel.updateOne(
        { key: 'concurrent:key' },
        { $set: { windowStart: new Date(Date.now() - 120_000) } },
      );

      const r = await limiter.check('concurrent:key');

      expect(r.attempts).toBe(1);
      expect(r.allowed).toBe(true);
    });

    it('reset clears the bucket', async () => {
      const limiter = new MongoRateLimiter({ maxAttempts: 5, windowMs: 60_000 });

      // Reach the ceiling with allowed checks (exactly maxAttempts in window).
      for (let i = 0; i < 5; i += 1) {
        const r = await limiter.check('concurrent:key');
        expect(r.allowed).toBe(true);
      }

      await limiter.reset('concurrent:key');

      const afterReset = await limiter.check('concurrent:key');
      expect(afterReset.allowed).toBe(true);
      expect(afterReset.attempts).toBe(1);
    });
  },
  60_000,
);