import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';
import { roleIdByKey, type RoleKey } from '../libs/auth.js';
import {
  checkPermissions,
  getCurrentUserCached,
} from '../libs/identity-api.js';
import { getForwardableAuthHeader } from '../libs/session.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Permissions that satisfied the authorize() check for this request. */
    permits?: string[];
  }
}

export type AuthorizeOptions = {
  only?: string;
  oneOf?: string[];
};

/**
 * authorize()                   → 401 unless authenticated
 * authorize({ only: 'x:read' }) → 403 unless permission granted
 * authorize({ oneOf: [...] })   → at least one required
 * JWT permissions claim is checked locally; bearer callers go through the
 * identity service, forwarding their own auth header.
 */
export function authorize(options?: AuthorizeOptions): RequestHandler {
  const required = options?.only ? [options.only] : (options?.oneOf ?? []);

  return async (req, _res, next) => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }

    if (required.length === 0) {
      req.permits = [];
      next();
      return;
    }

    let granted: string[];

    if (req.user.permissions) {
      const claims = req.user.permissions;
      granted = claims.includes('*')
        ? required
        : required.filter((p) => claims.includes(p));
    } else {
      const authHeader = getForwardableAuthHeader(req);
      if (!authHeader) {
        next(AppError.unauthorized());
        return;
      }
      granted = await checkPermissions(authHeader, required);
    }

    if (granted.length === 0) {
      next(AppError.forbidden());
      return;
    }

    req.permits = granted;
    next();
  };
}

// authorizeRoles(['SYSADMIN']) — role keys map to identity role ids via
// roleIdByKey; falls back to the identity service when roleIds are missing.
export function authorizeRoles(allowedRoleKeys: RoleKey[]): RequestHandler {
  const allowedRoleIds = allowedRoleKeys.map((key) => roleIdByKey[key]);

  return async (req, _res, next) => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }

    let roleIds = req.user.roleIds;

    if (!roleIds || roleIds.length === 0) {
      const authHeader = getForwardableAuthHeader(req);
      const fresh = authHeader ? await getCurrentUserCached(authHeader) : null;
      roleIds = fresh?.roleIds ?? [];
    }

    const authorized = roleIds.some((id) => allowedRoleIds.includes(id));
    if (!authorized) {
      next(AppError.forbidden());
      return;
    }

    next();
  };
}
