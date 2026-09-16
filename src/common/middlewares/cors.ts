import cors from 'cors';
import { config } from '../../config/index.js';

/**
 * CORS policy.
 * - Allow-list from CORS_ORIGINS (exact origin match, no wildcards).
 * - In development / test an empty list means "allow every origin" so a
 *   local front-end on any port can talk to the API; staging and production
 *   require the list (config refuses to boot without it).
 * - credentials: true so the signed auth cookie is accepted; this is why the
 *   allow-list must echo the exact origin instead of "*".
 */
const allowed = new Set(config.cors.origins);
const allowAll = allowed.size === 0 && !config.isDeployed;

/** Exact-match origin allow-list (shared with the CSRF guard). */
export function isAllowedOrigin(origin: string): boolean {
  return allowAll || allowed.has(origin);
}

export const corsPolicy = cors({
  origin(origin, callback) {
    // Same-origin / server-to-server requests carry no Origin header.
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    // Deny by returning no CORS headers (browser blocks); the request itself
    // still reaches auth, which rejects it without a valid credential.
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Access-Token',
    'X-Request-Id',
  ],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 600,
});
