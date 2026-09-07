import type { SessionCookieManager } from '../ports';

export async function logout(
  sessionCookieManager: SessionCookieManager,
): Promise<void> {
  await sessionCookieManager.destroy();
}