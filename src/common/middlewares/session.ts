import type { RequestHandler } from 'express';
import { config } from '../../config/index.js';
import { roleIdByKey, type SessionUser } from '../libs/auth.js';
import { getCurrentUserCached } from '../libs/identity-api.js';
import { isJwtEnabled, verifyJwt } from '../libs/jwt.js';
import { resolveLocalUserId } from '../libs/users-mirror.js';
import {
  clearAuthCookie,
  getCookieToken,
  parseAuthorizationHeader,
} from '../libs/session.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: SessionUser;
    /** Local users.id for the caller — the value *_by columns store. */
    actorId?: number;
    tokenType?: 'bearer' | 'jwt' | 'cookie';
  }
}

// Injected when JIMMY_AUTH=true (config rejects it in production). The
// identity id comes from JIMMY_IDENTITY so a tester can act as different
// users and exercise two-person rules (create vs approve).
const devUser: SessionUser = {
  id: config.auth.jimmyIdentity,
  email: `dev+${String(config.auth.jimmyIdentity)}@localhost`,
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
        req.tokenType = fromCookie ? 'cookie' : 'bearer';
      } else if (fromCookie) {
        clearAuthCookie(res);
      }
    }
  }

  if (!user && config.auth.jimmy) {
    user = devUser;
  }

  if (user) {
    req.user = user;
    try {
      req.actorId = await resolveLocalUserId(user);
    } catch (err) {
      // Degrade to unauthenticated: routes that need an actor will 401.
      req.log.error({ err }, 'sessionMiddleware: could not resolve local user');
      req.user = undefined;
    }
  }

  next();
};
