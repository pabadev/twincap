import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const trackMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../infrastructure/repositories/analytics-repository', () => ({
  MongoAnalyticsRepository: vi.fn().mockImplementation(() => ({ track: trackMock })),
}));

import { trackAnalytics } from './track-analytics';

describe('trackAnalytics (R13-G)', () => {
  const original = process.env.ANALYTICS_ENABLED;

  beforeEach(() => {
    trackMock.mockClear();
    vi.mocked(trackMock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ANALYTICS_ENABLED;
    } else {
      process.env.ANALYTICS_ENABLED = original;
    }
  });

  it('is a no-op when ANALYTICS_ENABLED is unset (default off)', async () => {
    delete process.env.ANALYTICS_ENABLED;
    await trackAnalytics('register', 'ws-1', 'u-1');
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('is a no-op when ANALYTICS_ENABLED=false', async () => {
    process.env.ANALYTICS_ENABLED = 'false';
    await trackAnalytics('register', 'ws-1', 'u-1');
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('tracks when ANALYTICS_ENABLED=true', async () => {
    process.env.ANALYTICS_ENABLED = 'true';
    await trackAnalytics('saleCreated', 'ws-1', 'u-1');
    expect(trackMock).toHaveBeenCalledWith({ eventName: 'saleCreated', workspaceId: 'ws-1', userId: 'u-1' });
  });

  it('never throws even if the repository throws', async () => {
    process.env.ANALYTICS_ENABLED = 'true';
    trackMock.mockRejectedValueOnce(new Error('boom'));
    await expect(trackAnalytics('register', 'ws-1', 'u-1')).resolves.toBeUndefined();
  });
});