/**
 * R12-C3 E2E global-teardown.
 * Stops the mongod instance started in global-setup (if still running).
 */
export default async function globalTeardown() {
  const mongod = (globalThis as {
    __MONGOINSTANCE?: { stop: () => Promise<void> };
  }).__MONGOINSTANCE;
  if (mongod) {
    await mongod.stop();
    (globalThis as { __MONGOINSTANCE?: unknown }).__MONGOINSTANCE = undefined;
    console.log('[e2e] mongod stopped');
  }
}
