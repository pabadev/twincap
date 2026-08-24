import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // TZ is set here too so worker processes START with it already applied
    // (startup-time read); vitest.setup.ts re-asserts it inside each worker.
    env: {
      TZ: "America/Bogota",
    },
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
