// Loads `.env.e2e` into process.env, then runs the Playwright CLI with clean
// process.execArgv. Using `node --env-file` directly would leak `--env-file`
// into `process.execArgv`, which Next 16's Turbopack workers serialize into
// NODE_OPTIONS and Node rejects ("--env-file= is not allowed in NODE_OPTIONS").
// Spawning the CLI here keeps the E2E env available to the runner AND to the
// `next build && next start` webServer child (which inherits process.env),
// while leaving execArgv clean so the build's workers start normally.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const envFile = path.resolve(__dirname, '..', '.env.e2e');
if (!fs.existsSync(envFile)) {
  console.error(`[e2e] Missing env file: ${envFile}`);
  process.exit(1);
}

for (const rawLine of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq === -1) continue;
  const key = line.slice(0, eq).trim();
  const value = line.slice(eq + 1).trim();
  // Never shadow an already-set value (lets CI/shell override .env.e2e).
  if (key && process.env[key] === undefined) {
    process.env[key] = value;
  }
}

const cli = path.resolve(
  __dirname,
  '..',
  'node_modules',
  '@playwright',
  'test',
  'cli.js',
);

const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status === null ? 1 : result.status);
