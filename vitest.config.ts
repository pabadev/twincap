import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // TZ is set here too so worker processes START with it already applied
    // (startup-time read); vitest.setup.ts re-asserts it inside each worker.
    env: {
      TZ: "America/Bogota",
    },
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
    // R15-F2: the real multi-document transaction tests boot a
    // MongoMemoryReplSet. The ORIGINAL flakiness (ECONNREFUSED mid-file,
    // "Cannot cleanup because instance.mongodProcess is still defined") was
    // NOT parallel contention — it was the mongod binary itself: the default
    // LATEST (8.2.6) crashes on Windows ~1 min after boot (exit 14,
    // 0xC000001D in tcmalloc), and only survives short replset suites. The
    // fix is the binary pin to 7.0.41 in every MPI test that boots a replset
    // (R14-J global-setup, mongo-unit-of-work, use-case-rollback) — verified
    // stable isolated AND as a full suite (1084/1084), with and without
    // parallelism.
    fileParallelism: false,
    // Generous timeouts for mongod boot under load; the vitest defaults
    // (10s hooks / 5s tests) are too tight once the replset is involved.
    hookTimeout: 60_000,
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});