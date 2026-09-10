import mongoose from "mongoose";
import { env } from "@/infrastructure/config/env";

const CONNECTION_OPTIONS = {
  // Fail fast on operations issued before the connection is established
  // (no command buffering against a dead connection).
  bufferCommands: false,
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 10,
  appName: "twincap",
  // R15.2-C1: index lifecycle is explicit in production (ensure/verify-*.mjs).
  // Dev/test keep auto-building so fresh databases stay frictionless.
  autoIndex: env.NODE_ENV !== "production",
} as const;

type MongooseGlobal = typeof globalThis & {
  /** Singleton cache — survives HMR so dev never opens a second connection. */
  __twincapMongoose?: typeof mongoose;
};

const mongooseGlobal: MongooseGlobal = globalThis as MongooseGlobal;

/**
 * In-flight connection promise shared by EVERY caller.
 *
 * WITHOUT this, two cold-start requests that both observe `readyState === 2`
 * (connecting) each call `mongoose.connect()`. Mongoose does NOT wait for the
 * in-progress server selection on the second call — it shares the connection
 * in progress and resolves immediately — so `connectDb()` can return while the
 * connection is still incomplete and a subsequent `findById()` explodes with
 * "Cannot call ... before initial connection is complete" (`bufferCommands:
 * false`). Sharing ONE promise makes every caller await the SAME outcome.
 */
let connecting: Promise<typeof mongoose> | null = null;

/**
 * Returns the cached mongoose instance, connecting once on first use.
 * Model registration is guarded per-model in the model layer so the
 * singleton is never re-initialized (see task 1.12).
 */
export async function connectDb(): Promise<typeof mongoose> {
  // If the connection is already established, return immediately.
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  // A connection attempt is already in flight — wait on THE SAME promise so
  // no caller proceeds with an incomplete connection.
  if (connecting) {
    return connecting;
  }

  // Stale cache (HMR preserved the global but the TCP connection dropped).
  mongooseGlobal.__twincapMongoose = undefined;

  connecting = mongoose
    .connect(env.MONGODB_URI, CONNECTION_OPTIONS)
    .then((m) => {
      mongooseGlobal.__twincapMongoose = m;
      return m;
    })
    .finally(() => {
      // Clear the shared promise so a FAILED attempt is retried by the next
      // caller, while a successful one is short-circuited by readyState === 1.
      connecting = null;
    });

  return connecting;
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function disconnectDb(): Promise<void> {
  if (mongooseGlobal.__twincapMongoose) {
    await mongoose.disconnect();
    mongooseGlobal.__twincapMongoose = undefined;
  }
}
