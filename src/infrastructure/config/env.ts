import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  AUTH_SECRET: z
    .string()
    .min(1, "AUTH_SECRET is required")
    .refine((secret) => Buffer.byteLength(secret, "utf8") >= 32, {
      message: "AUTH_SECRET must be at least 32 bytes (jose A256GCM key)",
    }),
});

export type Env = z.infer<typeof envSchema>;

/** Any env-like record; accepts `process.env` and plain literals (tests). */
export type EnvSource = Record<string, string | undefined>;

/**
 * Validates a raw environment source. Pure — exported for testability.
 * Throws with every invalid variable listed so configuration errors
 * surface immediately (fail-fast) instead of at first use.
 */
export function parseEnv(source: EnvSource = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `- ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

/** Lazy validated environment — resolved on first access, not at module load. */
let _env: Env | undefined;
export function getEnv(): Env {
  if (!_env) {
    _env = parseEnv(process.env);
  }
  return _env;
}

/** Backwards-compatible accessor (lazy). */
export const env: Env = new Proxy({} as Env, {
  get(_, prop: string) {
    return (getEnv() as Record<string, unknown>)[prop];
  },
});
