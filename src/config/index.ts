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
  /* Wait after flipping readiness to 503 before closing the listener */
  SHUTDOWN_DRAIN_DELAY_MS: z.coerce.number().int().nonnegative().default(2_000),
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
  REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(2_000),
  REDIS_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(300),
  /* Upper bound for each readiness dependency check */
  HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().int().positive().default(1_500),

  /* CORS: comma-separated list of allowed origins. Required in staging and
     production; empty = allow all in development / test. */
  CORS_ORIGINS: z.string().default(''),

  /* File storage: GCS bucket, required in staging and production. When unset
     in development / test, files go to STORAGE_LOCAL_DIR. */
  GCS_BUCKET: z.string().optional(),
  GCS_PROJECT_ID: z.string().optional(),
  STORAGE_LOCAL_DIR: z.string().default('.storage'),
  STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(900),
  UPLOAD_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),

  GIT_COMMIT: z.string().optional(),

  /* Auth (backed by the central identity service) */
  IDENTITY_SERVICE_URL: z.url().optional(),
  IDENTITY_SERVICE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5_000),
  AUTH_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  /* How long an invalid / expired token is remembered as invalid */
  AUTH_NEGATIVE_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(15),
  COOKIE_NAME: z.string().default('token'),
  COOKIE_SECRET: z.string().default('dev-cookie-secret-change-me'),
  AUTH_JWT_PUBLIC_KEY: z.string().optional(),
  /* Dev-only bypass: JIMMY_AUTH=true injects a SYSADMIN principal whose
     identity user id is JIMMY_IDENTITY. */
  JIMMY_AUTH: z.stringbool().default(false),
  JIMMY_IDENTITY: z.coerce.number().int().nonnegative().default(1),
});

export const guardedEnvSchema = envSchema.superRefine((env, ctx) => {
  // Deployed environments only; development and test stay unguarded.
  if (!['staging', 'production'].includes(env.NODE_ENV)) return;
  if (env.JIMMY_AUTH) {
    ctx.addIssue({
      code: 'custom',
      path: ['JIMMY_AUTH'],
      message: `JIMMY_AUTH must not be enabled in ${env.NODE_ENV}`,
    });
  }
  if (env.COOKIE_SECRET === 'dev-cookie-secret-change-me') {
    ctx.addIssue({
      code: 'custom',
      path: ['COOKIE_SECRET'],
      message: `COOKIE_SECRET must be set to a real secret in ${env.NODE_ENV}`,
    });
  }
  if (!env.GCS_BUCKET) {
    ctx.addIssue({
      code: 'custom',
      path: ['GCS_BUCKET'],
      message: `GCS_BUCKET is required in ${env.NODE_ENV} (local storage is dev-only)`,
    });
  }
  if (!env.CORS_ORIGINS.trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['CORS_ORIGINS'],
      message: `CORS_ORIGINS must list the allowed origins in ${env.NODE_ENV}`,
    });
  }
  if (!env.IDENTITY_SERVICE_URL && !env.AUTH_JWT_PUBLIC_KEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['IDENTITY_SERVICE_URL'],
      message: `In ${env.NODE_ENV} configure IDENTITY_SERVICE_URL and/or AUTH_JWT_PUBLIC_KEY — otherwise no request can authenticate`,
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
  isDeployed: ['staging', 'production'].includes(NODE_ENV),
  appName: env.APP_NAME,
  port: env.APP_PORT,
  logLevel: env.LOG_LEVEL,
  shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
  shutdownDrainDelayMs: env.SHUTDOWN_DRAIN_DELAY_MS,
  docsEnabled: env.DOCS_ENABLED ?? NODE_ENV !== 'production',
  gitCommit: env.GIT_COMMIT,
  auth: {
    jwtPublicKey: env.AUTH_JWT_PUBLIC_KEY,
    jimmy: env.JIMMY_AUTH,
    jimmyIdentity: env.JIMMY_IDENTITY,
  },
  identity: {
    url: env.IDENTITY_SERVICE_URL,
    timeoutMs: env.IDENTITY_SERVICE_TIMEOUT_MS,
    cacheTtlSeconds: env.AUTH_CACHE_TTL_SECONDS,
    negativeCacheTtlSeconds: env.AUTH_NEGATIVE_CACHE_TTL_SECONDS,
  },
  cookie: {
    name: env.COOKIE_NAME,
    secret: env.COOKIE_SECRET,
  },
  redis: {
    url: env.REDIS_URL,
    connectTimeoutMs: env.REDIS_CONNECT_TIMEOUT_MS,
    commandTimeoutMs: env.REDIS_COMMAND_TIMEOUT_MS,
  },
  health: {
    checkTimeoutMs: env.HEALTH_CHECK_TIMEOUT_MS,
  },
  cors: {
    origins: env.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },
  storage: {
    gcsBucket: env.GCS_BUCKET,
    gcsProjectId: env.GCS_PROJECT_ID,
    localDir: env.STORAGE_LOCAL_DIR,
    signedUrlTtlSeconds: env.STORAGE_SIGNED_URL_TTL_SECONDS,
    uploadMaxBytes: env.UPLOAD_MAX_BYTES,
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
