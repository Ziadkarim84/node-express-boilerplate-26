import { generateKeyPairSync } from 'node:crypto';
import jsonwebtoken from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import type { SessionUser } from './auth.js';

// JWT contract test with a real RS256 keypair: sign as the identity service
// would, verify with the base64-encoded public key as this service does.
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

process.env.AUTH_JWT_PUBLIC_KEY = Buffer.from(publicKey).toString('base64');

const { verifyJwt, isJwtEnabled } = await import('./jwt.js');

const user: SessionUser = {
  id: 42,
  email: 'engineer@shopup.org',
  roleIds: [3],
  scopeIds: null,
  permissions: ['users:read'],
};

function sign(payload: object, options: jsonwebtoken.SignOptions = {}) {
  return jsonwebtoken.sign(payload, privateKey, {
    algorithm: 'RS256',
    subject: 'auth',
    expiresIn: '1h',
    ...options,
  });
}

describe('verifyJwt (identity-service contract)', () => {
  it('is enabled when a public key is configured', () => {
    expect(isJwtEnabled).toBe(true);
  });

  it('verifies a token and returns the user claims', () => {
    const token = sign({ data: { user } });
    expect(verifyJwt(token)).toEqual(user);
  });

  it('rejects a token signed with a different key', () => {
    const other = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const token = jsonwebtoken.sign({ data: { user } }, other.privateKey, {
      algorithm: 'RS256',
      subject: 'auth',
      expiresIn: '1h',
    });
    expect(() => verifyJwt(token)).toThrow();
  });

  it('rejects an expired token', () => {
    const token = sign({ data: { user } }, { expiresIn: '-10s' });
    expect(() => verifyJwt(token)).toThrow(/expired/i);
  });

  it('rejects the wrong subject', () => {
    const token = sign({ data: { user } }, { subject: 'other' });
    expect(() => verifyJwt(token)).toThrow();
  });
});
