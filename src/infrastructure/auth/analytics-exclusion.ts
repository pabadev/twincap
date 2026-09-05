/**
 * Analytics data exclusion (Fase 6 / N3).
 *
 * Reads the `ANALYTICS_EXCLUDE_EMAILS` env var (comma-separated, same pattern
 * as `ANALYTICS_ACCESS_EMAILS`) and resolves each email to the workspaceIds
 * excluded from the GLOBAL product-analytics aggregate — so the founder's own
 * account stops dirtying activation/retention during the beta. No email is
 * hardcoded: the operator configures the exclusion via env.
 *
 * `parseExcludedEmails` is a pure string → list transform.
 * `resolveExcludedWorkspaceIds` receives its persistence access as injected
 * deps (`findByEmail` / `findWorkspaceIdsByUser`) so it can be unit-tested
 * with fakes and never imports Mongoose models — mirroring the
 * `DefaultAnalyticsAuthorizer` style (env-derived config, deny-by-default).
 */

/**
 * Parses the raw `ANALYTICS_EXCLUDE_EMAILS` value into a normalized list:
 * split on comma, trim, lowercase, drop empties, dedupe preserving
 * first-occurrence order. `undefined`/empty → `[]` (no exclusion).
 */
export function parseExcludedEmails(raw: string | undefined): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const part of (raw ?? '').split(',')) {
    const normalized = part.trim().toLowerCase();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    emails.push(normalized);
  }
  return emails;
}

/** Persistence access needed to resolve emails → workspaceIds. */
export interface ExclusionDeps {
  /** Email → user (null when no such user). e.g. `MongoUserRepository.findByEmail`. */
  findByEmail: (email: string) => Promise<{ id: string } | null>;
  /** User id → ids of the workspaces the user belongs to. e.g. memberships mapped to `workspaceId`. */
  findWorkspaceIdsByUser: (userId: string) => Promise<string[]>;
}

/**
 * Resolves excluded emails to the workspaceIds that own their data.
 *
 * WHY deps are injected: the resolution needs two repository lookups
 * (user by email, memberships by user) that would otherwise force this module
 * to import Mongoose models — coupling a policy that is pure configuration
 * logic to the DB and making it untestable without a database. Injecting the
 * two lookups keeps the function deterministic and unit-testable with fakes,
 * and the production wiring lives in the action (single place, after
 * `connectDb()`).
 *
 * Users not found are skipped; workspace ids are deduped (a workspace shared
 * by two excluded users is excluded once). Empty input → `[]`.
 */
export async function resolveExcludedWorkspaceIds(
  excludeEmails: string[],
  deps: ExclusionDeps,
): Promise<string[]> {
  const workspaceIds = new Set<string>();
  for (const email of excludeEmails) {
    const user = await deps.findByEmail(email);
    if (!user) continue;
    const ids = await deps.findWorkspaceIdsByUser(user.id);
    for (const id of ids) {
      workspaceIds.add(id);
    }
  }
  return [...workspaceIds];
}