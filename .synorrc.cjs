/**
 * Synor migration CLI config (CommonJS on purpose — the project itself
 * is ESM, so this file must be .cjs; npm scripts pass --config=.synorrc.cjs).
 * Reads the same .env cascade as the app.
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { MySQLDatabaseEngine } = require('@synor/database-mysql');
const { FileSourceEngine } = require('@synor/source-file');

const NODE_ENV = process.env.NODE_ENV || 'development';

// Same order as src/config/env.ts
[`.env.${NODE_ENV}.local`, `.env.${NODE_ENV}`, '.env.local', '.env']
  .map((f) => path.resolve(f))
  .filter((f) => fs.existsSync(f))
  .forEach((f) => dotenv.config({ path: f, quiet: true }));

const {
  DATABASE_HOST = 'localhost',
  DATABASE_PORT = '3306',
  DATABASE_NAME = 'node_express_boilerplate',
  DATABASE_USERNAME = 'root',
  DATABASE_PASSWORD = 'root',
} = process.env;

const databaseUri =
  `mysql://${encodeURIComponent(DATABASE_USERNAME)}:${encodeURIComponent(DATABASE_PASSWORD)}` +
  `@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}` +
  `?synor_migration_record_table=synor_migration_record`;

const sourceUri = `file://${path.resolve('schema-migrations')}?ignore_invalid_filename=true`;

module.exports = {
  databaseEngine: MySQLDatabaseEngine,
  sourceEngine: FileSourceEngine,
  databaseUri,
  sourceUri,
  baseVersion: '000000000000',
  recordStartId: 1,
  migrationInfoNotation: {
    do: 'do',
    undo: 'undo',
    separator: '.',
    extension: 'sql',
  },
};
