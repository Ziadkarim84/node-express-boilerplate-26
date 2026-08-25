import { z } from 'zod';
import { NODE_ENV } from './env.js';

// All env vars are declared and validated here — the process fails fast at
// boot on invalid config. Never read process.env anywhere else.
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

  /* Redis (optional — caching falls back to in-memory when unset) */
  REDIS_URL: z.url().optional(),

  GIT_COMMIT: z.string().optional(),

  /* Auth (backed by the central identity service) */
  IDENTITY_SERVICE_URL: z.url().optional(),
  IDENTITY_SERVICE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5_000),
  AUTH_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  COOKIE_NAME: z.string().default('token'),
  COOKIE_SECRET: z.string().default('dev-cookie-secret-change-me'),
  AUTH_JWT_PUBLIC_KEY: z.string().optional(),
  AUTH_SKIP: z.stringbool().default(false),
});

const guardedEnvSchema = envSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production') return;
  if (env.AUTH_SKIP) {
    ctx.addIssue({
      code: 'custom',
      path: ['AUTH_SKIP'],
      message: 'AUTH_SKIP must not be enabled in production',
    });
  }
  if (env.COOKIE_SECRET === 'dev-cookie-secret-change-me') {
    ctx.addIssue({
      code: 'custom',
      path: ['COOKIE_SECRET'],
      message: 'COOKIE_SECRET must be set to a real secret in production',
    });
  }
  if (!env.IDENTITY_SERVICE_URL && !env.AUTH_JWT_PUBLIC_KEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['IDENTITY_SERVICE_URL'],
      message:
        'In production configure IDENTITY_SERVICE_URL and/or AUTH_JWT_PUBLIC_KEY — otherwise no request can authenticate',
    });
  }
});

const parsed = guardedEnvSchema.safeParse(process.env);

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
  auth: {
    jwtPublicKey: env.AUTH_JWT_PUBLIC_KEY,
    skip: env.AUTH_SKIP,
  },
  identity: {
    url: env.IDENTITY_SERVICE_URL,
    timeoutMs: env.IDENTITY_SERVICE_TIMEOUT_MS,
    cacheTtlSeconds: env.AUTH_CACHE_TTL_SECONDS,
  },
  cookie: {
    name: env.COOKIE_NAME,
    secret: env.COOKIE_SECRET,
  },
  redis: {
    url: env.REDIS_URL,
  },
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
