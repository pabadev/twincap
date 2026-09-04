import { describe, it, expect } from 'vitest';
import { DefaultAnalyticsAuthorizer } from './analytics-authorizer';

describe('DefaultAnalyticsAuthorizer (R13-G)', () => {
  describe('allowlist from ANALYTICS_ACCESS_EMAILS', () => {
    it('allows an email in the allowlist (case-insensitive)', async () => {
      const authorizer = new DefaultAnalyticsAuthorizer(
        'Founder@Example.com, ops@twincap.app',
      );

      expect(await authorizer.canView('u-1', 'founder@example.com')).toBe(true);
      expect(await authorizer.canView('u-2', 'OPS@twincap.app')).toBe(true);
    });

    it('trims whitespace around emails', async () => {
      const authorizer = new DefaultAnalyticsAuthorizer('  founder@x.com , boss@x.com  ');

      expect(await authorizer.canView('u-1', 'founder@x.com')).toBe(true);
      expect(await authorizer.canView('u-2', 'boss@x.com')).toBe(true);
    });

    it('denies an email NOT in the allowlist', async () => {
      const authorizer = new DefaultAnalyticsAuthorizer('founder@x.com');

      expect(await authorizer.canView('u-9', 'random@x.com')).toBe(false);
    });

    it('denies when the env is unset (deny-by-default)', async () => {
      const authorizer = new DefaultAnalyticsAuthorizer(undefined);

      expect(
        await authorizer.canView('u-1', 'founder@example.com'),
      ).toBe(false);
    });

    it('denies when the env is empty', async () => {
      const authorizer = new DefaultAnalyticsAuthorizer('');

      expect(
        await authorizer.canView('u-1', 'founder@example.com'),
      ).toBe(false);
    });

    it('denies when the email is missing/empty', async () => {
      const authorizer = new DefaultAnalyticsAuthorizer('founder@x.com');

      expect(await authorizer.canView('u-1', '')).toBe(false);
      expect(await authorizer.canView('u-1', undefined as unknown as string)).toBe(false);
    });

    it('denies when the email is structurally identical but a different user id', async () => {
      // Email is the identity here — any user id with the allowed email passes
      // (beta: one user per email). Registers the behavioral contract.
      const authorizer = new DefaultAnalyticsAuthorizer('founder@x.com');
      expect(await authorizer.canView('someone-else', 'founder@x.com')).toBe(true);
    });
  });
});