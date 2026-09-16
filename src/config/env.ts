import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// .env cascade, first match wins per variable (dotenv never overrides):
// .env.{NODE_ENV}.local > .env.{NODE_ENV} > .env.local (skipped in test) > .env
// Committed per-environment defaults live in .env.{NODE_ENV}; personal
// overrides go in .env.{NODE_ENV}.local (git-ignored).
// Keep in step with .synorrc.cjs and scripts/db-create.js.
export const NODE_ENV = process.env.NODE_ENV ?? 'development';

const dotEnvPath = path.resolve('.env');

const dotenvFiles = [
  `${dotEnvPath}.${NODE_ENV}.local`,
  `${dotEnvPath}.${NODE_ENV}`,
  NODE_ENV === 'test' ? '' : `${dotEnvPath}.local`,
  dotEnvPath,
].filter(Boolean);

for (const dotenvFile of dotenvFiles) {
  if (fs.existsSync(dotenvFile)) {
    dotenv.config({ path: dotenvFile, quiet: true });
  }
}
