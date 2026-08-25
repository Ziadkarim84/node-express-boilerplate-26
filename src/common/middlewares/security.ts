import type { Request, RequestHandler, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { roleIdByKey, type SessionUser } from '../libs/auth.js';
import { getCurrentUserCached } from '../libs/identity-api.js';
import { clearAuthCookie, getForwardableAuthHeader } from '../libs/session.js';

/**
 * Guard-style middlewares (shopup-lite's services/security.js). Self-
 * sufficient: pass through when req.user is set, otherwise resolve the
 * caller via the identity service; clear the cookie and reject on failure.
 * Usage: router.use(isAuthenticated) / [isAuthenticated, onlySuperAdmin].
 */
async function resolveUser(
  req: Request,
  res: Response,
): Promise<SessionUser | null> {
  if (req.user) return req.user;

  const authHeader = getForwardableAuthHeader(req);
  if (!authHeader) {
    clearAuthCookie(res);
    return null;
  }

  const user = await getCurrentUserCached(authHeader);
  if (!user) {
    clearAuthCookie(res);
    return null;
  }

  req.user = user;
  return user;
}

// 401 unless a valid session.
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = await resolveUser(req, res);
  if (!user) {
    next(AppError.unauthorized('No valid token found'));
    return;
  }
  next();
};

// 401 / 403 unless a SYSADMIN.
export const onlySuperAdmin: RequestHandler = async (req, res, next) => {
  const user = await resolveUser(req, res);
  if (!user) {
    next(AppError.unauthorized('No valid token found'));
    return;
  }
  if (!user.roleIds?.includes(roleIdByKey.SYSADMIN)) {
    next(AppError.forbidden('You are not a super admin'));
    return;
  }
  next();
};
