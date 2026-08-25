import type { Request, Response } from 'express';
import { config } from '../../config/index.js';

// Credential transport helpers — sessions live in the identity service.
// Accepted: `Authorization: bearer|jwt <token>`, X-Access-Token, signed cookie.
export type AuthToken = { scheme: 'bearer' | 'jwt'; value: string };

export function parseAuthorizationHeader(req: Request): AuthToken | null {
  const header = req.get('Authorization') ?? req.get('X-Access-Token');
  if (!header) return null;

  const matches = header.match(/(\S+)\s+(\S+)/);
  if (!matches) return null;

  const scheme = (matches[1] as string).toLowerCase();
  const value = matches[2] as string;

  if (scheme !== 'bearer' && scheme !== 'jwt') return null;

  return { scheme, value };
}

export function getCookieToken(req: Request): string | null {
  const token = (req.signedCookies as Record<string, string | undefined>)[
    config.cookie.name
  ];
  return token ?? null;
}

// The caller's credentials as a forwardable Authorization header value.
export function getForwardableAuthHeader(req: Request): string | null {
  const parsed = parseAuthorizationHeader(req);
  if (parsed) {
    return `${parsed.scheme === 'jwt' ? 'jwt' : 'bearer'} ${parsed.value}`;
  }

  const cookieToken = getCookieToken(req);
  return cookieToken ? `bearer ${cookieToken}` : null;
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(config.cookie.name);
}
