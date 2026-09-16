#!/usr/bin/env node
// Creates the configured database if it does not exist, so `npm run mg:latest`
// works on a fresh MySQL. Reads the same .env cascade as the app and Synor.
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

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

if (!/^[A-Za-z0-9_]+$/.test(DATABASE_NAME)) {
  console.error(
    `Refusing to create database with unsafe name: ${DATABASE_NAME}`,
  );
  process.exit(1);
}

const connection = await mysql.createConnection({
  host: DATABASE_HOST,
  port: Number(DATABASE_PORT),
  user: DATABASE_USERNAME,
  password: DATABASE_PASSWORD,
});
try {
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${DATABASE_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  console.log(
    `Database ${DATABASE_NAME} ready on ${DATABASE_HOST}:${DATABASE_PORT}`,
  );
} finally {
  await connection.end();
}
