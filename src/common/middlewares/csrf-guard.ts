import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';
import { isAllowedOrigin } from './cors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF guard for cookie-authenticated callers.
 *
 * Browsers attach the auth cookie to any request, including one started by
 * a foreign page. CORS alone does not stop such a request from executing:
 * it only hides the response. So for a state-changing request authenticated
 * by cookie, the Origin (or Sec-Fetch-Site) must show it came from one of
 * our own front-ends; otherwise 403.
 *
 * Header-authenticated callers (bearer / jwt) are untouched: a foreign page
 * cannot read or forge those headers.
 */
export const csrfGuard: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method) || req.tokenType !== 'cookie') {
    next();
    return;
  }

  const origin = req.get('Origin');
  const site = req.get('Sec-Fetch-Site');

  const trusted =
    (origin ? isAllowedOrigin(origin) : site === 'same-origin') ||
    site === 'same-origin' ||
    site === 'none';

  if (!trusted) {
    next(
      AppError.forbidden(
        'Cross-site request rejected: cookie-authenticated mutations must come from an allowed origin',
      ),
    );
    return;
  }
  next();
};
