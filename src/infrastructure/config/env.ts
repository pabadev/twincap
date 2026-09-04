import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  AUTH_SECRET: z
    .string()
    .min(1, "AUTH_SECRET is required")
    .refine((secret) => {
      try {
        // Must decode to exactly 32 bytes for jose A256GCM
        const bytes = Uint8Array.from(atob(secret.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
        return bytes.length === 32;
      } catch {
        return false;
      }
    }, {
      message: "AUTH_SECRET must be a base64url-encoded 32-byte key (generate: openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')",
    }),
  // Transactional email (R13-B). Optional in dev: when RESEND_API_KEY is absent
  // the email sender logs the link to the console instead of sending.
  RESEND_API_KEY: z.string().optional(),
  // Optional sender address override for transactional emails.
  RESEND_FROM: z.string().optional(),
  // Public base URL used to build reset/verify links (e.g. http://localhost:3000).
  APP_BASE_URL: z.string().optional(),
  // Error monitoring (R13-D). OPT-IN: defaults to false so the phase ships
  // functional but SILENT until the operator explicitly enables it (no
  // surprise for existing installs). Accepts "true"/"false" from the env.
  ERROR_MONITORING_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  // Recipient for error incident alert emails (R13-D). If absent, alerts are
  // a silent no-op (dev). Requires ERROR_MONITORING_ENABLED=true to activate.
  ERROR_ALERT_EMAIL: z.string().optional(),
  // Optional release/git sha recorded on each error event for triage; falls
  // back to empty when not set. Mirrors 'release' in the error event model.
  APP_RELEASE: z.string().optional(),
  // Recipient for user feedback emails (R13-E). If absent, feedback sends
  // are a silent no-op (dev). No feature flag needed — presence of this
  // address is the gate.
  FEEDBACK_EMAIL: z.string().optional(),
  // Product analytics (R13-G). OPT-IN: defaults to false so the phase ships
  // functional but SILENT until the operator explicitly enables it.
  ANALYTICS_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  // Comma-separated email allowlist of users who may view the PRODUCT analytics
  // dashboard (/analytics). Deny-by-default: if absent/empty, nobody has access
  // except future role-based grants (R13-G hardening, founder-only today).
  ANALYTICS_ACCESS_EMAILS: z.string().optional(),
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
