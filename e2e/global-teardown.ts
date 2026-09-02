/**
 * R12-C3 E2E global-teardown.
 * Stops the mongod instance started in global-setup (if still running).
 */
export default async function globalTeardown() {
  const mongod = (globalThis as any).__MONGOINSTANCE;
  if (mongod) {
    await mongod.stop();
    (globalThis as any).__MONGOINSTANCE = undefined;
    console.log('[e2e] mongod stopped');
  }
}
