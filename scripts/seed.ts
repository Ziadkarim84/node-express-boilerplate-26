#!/usr/bin/env tsx
/**
 * Seeds reference data. Runs every seeds/*.sql file in name order inside one
 * connection; each file must be idempotent (INSERT ... ON DUPLICATE KEY UPDATE
 * or INSERT IGNORE) so the script can be re-run after every migration.
 *
 *   npm run seed            # all files
 *   npm run seed -- 020     # only files whose name starts with 020
 *
 * Reads the same .env cascade as the app (config/index.ts).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { config } from '../src/config/index.js';

const SEEDS_DIR = path.resolve('seeds');

async function main(): Promise<void> {
  const prefix = process.argv[2] ?? '';
  const files = (await fs.readdir(SEEDS_DIR))
    .filter((f) => f.endsWith('.sql') && f.startsWith(prefix))
    .sort();

  if (files.length === 0) {
    console.log(`No seed files matching "${prefix}" in ${SEEDS_DIR}`);
    return;
  }

  const { database } = config;
  const connection = await mysql.createConnection({
    host: database.host,
    port: database.port,
    user: database.username,
    password: database.password,
    database: database.name,
    multipleStatements: true,
  });

  try {
    for (const file of files) {
      const sql = await fs.readFile(path.join(SEEDS_DIR, file), 'utf8');
      const started = Date.now();
      await connection.query(sql);
      console.log(`✔ ${file} (${String(Date.now() - started)} ms)`);
    }
  } finally {
    await connection.end();
  }
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
