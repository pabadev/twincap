import mongoose from "mongoose";
import { env } from "@/infrastructure/config/env";

const CONNECTION_OPTIONS = {
  // Fail fast on operations issued before the connection is established
  // (no command buffering against a dead connection).
  bufferCommands: false,
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 10,
  appName: "twincap",
} as const;

type MongooseGlobal = typeof globalThis & {
  /** Singleton cache — survives HMR so dev never opens a second connection. */
  __twincapMongoose?: typeof mongoose;
};

const mongooseGlobal: MongooseGlobal = globalThis as MongooseGlobal;

/**
 * Returns the cached mongoose instance, connecting once on first use.
 * Model registration is guarded per-model in the model layer so the
 * singleton is never re-initialized (see task 1.12).
 */
export async function connectDb(): Promise<typeof mongoose> {
  // If we have a cached instance AND the connection is still alive, return it.
  if (
    mongooseGlobal.__twincapMongoose &&
    mongoose.connection.readyState === 1
  ) {
    return mongooseGlobal.__twincapMongoose;
  }

  // Stale cache (HMR preserved the global but the TCP connection dropped).
  mongooseGlobal.__twincapMongoose = undefined;

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(env.MONGODB_URI, CONNECTION_OPTIONS);
  }

  mongooseGlobal.__twincapMongoose = mongoose;
  return mongoose;
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
