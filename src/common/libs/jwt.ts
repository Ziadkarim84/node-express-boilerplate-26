import jsonwebtoken from 'jsonwebtoken';
import { config } from '../../config/index.js';
import type { SessionUser } from './auth.js';

// Local verification of identity-service JWTs (`Authorization: jwt <token>`):
// RS256, base64 public key, subject 'auth', payload { data: { user } }.
// Disabled unless AUTH_JWT_PUBLIC_KEY is set.
export type JwtPayload = {
  iat: number;
  exp: number;
  sub: string;
  data: { user: SessionUser };
};

const publicKey = config.auth.jwtPublicKey
  ? Buffer.from(config.auth.jwtPublicKey, 'base64').toString('ascii')
  : null;

export const isJwtEnabled = publicKey !== null;

export function verifyJwt(token: string): SessionUser {
  if (!publicKey) {
    throw new Error('JWT verification is not configured (AUTH_JWT_PUBLIC_KEY)');
  }

  const verified = jsonwebtoken.verify(token, publicKey, {
    algorithms: ['RS256'],
    subject: 'auth',
  }) as JwtPayload;

  return verified.data.user;
}
