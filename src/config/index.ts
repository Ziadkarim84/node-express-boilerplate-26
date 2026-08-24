import { z } from 'zod';
import { NODE_ENV } from './env.js';

/**
 * All environment variables are declared and validated here with Zod.
 * The process fails fast at boot if configuration is invalid.
 * Never read process.env anywhere else in the codebase.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'staging', 'production'])
    .default('development'),
  APP_NAME: z.string().default('node-express-boilerplate'),
  APP_PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  DOCS_ENABLED: z.stringbool().optional(),

  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().int().positive().default(3306),
  DATABASE_NAME: z.string().default('node_express_boilerplate'),
  DATABASE_USERNAME: z.string().default('root'),
  DATABASE_PASSWORD: z.string().default('root'),
  DATABASE_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  GIT_COMMIT: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Cannot use the logger here: the logger depends on config.
  console.error('❌ Invalid environment configuration:');
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

const env = parsed.data;

export const config = {
  env: NODE_ENV as typeof env.NODE_ENV,
  appName: env.APP_NAME,
  port: env.APP_PORT,
  logLevel: env.LOG_LEVEL,
  shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
  docsEnabled: env.DOCS_ENABLED ?? NODE_ENV !== 'production',
  gitCommit: env.GIT_COMMIT,
  database: {
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    name: env.DATABASE_NAME,
    username: env.DATABASE_USERNAME,
    password: env.DATABASE_PASSWORD,
    pool: {
      min: env.DATABASE_POOL_MIN,
      max: env.DATABASE_POOL_MAX,
    },
  },
} as const;

export type Config = typeof config;
