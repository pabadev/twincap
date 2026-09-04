import type { AnalyticsAuthorizer } from '../../core/application/ports';

/**
 * Default product-analytics authorizer (R13-G hardening).
 *
 * TODAY the only access path is an explicit allowlist of founder emails read
 * from the env var `ANALYTICS_ACCESS_EMAILS` (comma-separated). This matches
 * the founder's decision: only the founder can view product analytics during
 * the beta.
 *
 * FUTURE: when role-based access is introduced (a distinct analytics role in
 * MembershipRole, e.g. `analyst`), this policy will ALSO authorize users
 * holding that role. The `AnalyticsAuthorizer` interface is intentionally
 * small (one method) so the role-based extension requires NO change to the
 * page or consumer code — only this implementation.
 *
 * Fail-safe: a misconfiguration (missing env, empty allowlist) DENIES access
 * rather than granting it (deny-by-default).
 */
export class DefaultAnalyticsAuthorizer implements AnalyticsAuthorizer {
  private readonly allowlist: ReadonlySet<string>;

  constructor(accessEmailsEnv: string | undefined = process.env.ANALYTICS_ACCESS_EMAILS) {
    this.allowlist = new Set(
      (accessEmailsEnv ?? '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  async canView(userId: string, email: string): Promise<boolean> {
    void userId; // Reserved for future role-based authorization.
    if (!email) return false;
    const normalized = email.trim().toLowerCase();
    return this.allowlist.has(normalized);
  }
}
