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
    // Timeouts POR TEST/HOOK (60s): generosos para mongod boot bajo carga;
    // los defaults de vitest (10s hooks / 5s tests) son demasiado ajustados
    // una vez que interviene el replset. NO bajar.
    //
    // El tiempo TOTAL de la suite (medido 2026-09-14: 1265s ≈ 21,1 min con
    // 131 archivos / 1439 tests) NO se gobierna aquí: vitest no tiene un
    // límite de wall-clock global. La regla está en docs/PROJECT-RULES.md §14:
    // toda corrida completa DEBE ejecutarse con timeout explícito ≥ 45 min
    // (2_700_000 ms en el runner de comandos; CI quality = 60 min, cf. ci.yml).
    hookTimeout: 60_000,
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});