import type { RequestHandler } from 'express';
import { config } from '../../config/index.js';
import { roleIdByKey, type SessionUser } from '../libs/auth.js';
import { getCurrentUserCached } from '../libs/identity-api.js';
import { isJwtEnabled, verifyJwt } from '../libs/jwt.js';
import {
  clearAuthCookie,
  getCookieToken,
  parseAuthorizationHeader,
} from '../libs/session.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: SessionUser;
    tokenType?: 'bearer' | 'jwt';
  }
}

// Injected when AUTH_SKIP=true (config rejects it in production).
const devUser: SessionUser = {
  id: 0,
  email: 'dev@localhost',
  firstName: 'Dev',
  lastName: 'Superadmin',
  roleIds: [roleIdByKey.SYSADMIN],
  scopeIds: null,
  permissions: ['*'],
};

/**
 * Resolves the caller into req.user: `jwt <token>` verified locally,
 * `bearer <token>` / signed cookie resolved via the identity service (cached).
 * Never rejects — enforcement is per-route. Invalid cookies are cleared.
 */
export const sessionMiddleware: RequestHandler = async (req, res, next) => {
  const parsed = parseAuthorizationHeader(req);

  let user: SessionUser | null = null;

  if (parsed?.scheme === 'jwt' && isJwtEnabled) {
    try {
      user = verifyJwt(parsed.value);
      req.tokenType = 'jwt';
    } catch (err) {
      req.log.warn({ err }, 'sessionMiddleware: JWT verification failed');
    }
  } else {
    const fromCookie = !parsed;
    const token = parsed?.value ?? getCookieToken(req);

    if (token) {
      try {
        user = await getCurrentUserCached(`bearer ${token}`);
      } catch (err) {
        // Identity service unreachable: log and continue unauthenticated —
        // public routes keep working; protected routes will 401.
        req.log.error(
          { err },
          'sessionMiddleware: identity service lookup failed',
        );
      }

      if (user) {
        req.tokenType = 'bearer';
      } else if (fromCookie) {
        clearAuthCookie(res);
      }
    }
  }

  if (!user && config.auth.skip) {
    user = devUser;
  }

  if (user) {
    req.user = user;
  }

  next();
};
