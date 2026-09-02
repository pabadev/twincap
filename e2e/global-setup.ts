import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/**
 * R12-C3 E2E global-setup.
 * Starts a local mongod (wiredTiger, fixed port 37017) for the test DB and
 * drops it before the suite runs. Never touches Atlas: the URI is asserted to
 * resolve to a loopback host and we fail fast otherwise.
 */
export default async function globalSetup() {
  const mongod = await MongoMemoryServer.create({
    instance: {
      port: 37017,
      dbName: 'twincap_e2e',
      storageEngine: 'wiredTiger',
    },
  });

  const uri = mongod.getUri('twincap_e2e');

  // Atlas guard: the DB of test MUST be local. Fail fast if the resolved URI
  // does not point to a loopback host.
  const host = new URL(uri).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    await mongod.stop();
    throw new Error(
      `E2E DB host must be loopback (127.0.0.1/localhost), got "${host}". Refusing to run against Atlas.`,
    );
  }

  // Make the instance reachable from the teardown.
  (globalThis as { __MONGOINSTANCE?: unknown }).__MONGOINSTANCE = mongod;

  // Drop the database so each run starts clean (also resets `ratelimits`).
  const conn = await mongoose.createConnection(uri).asPromise();
  await conn.dropDatabase();
  await conn.close();

  // Feed the URI to process.env so `next start` (lazy DB connects) and the
  // suite hit the local instance.
  process.env.MONGODB_URI = uri;
  console.log(`[e2e] mongod started at ${host}:37017 (db: twincap_e2e)`);
}
