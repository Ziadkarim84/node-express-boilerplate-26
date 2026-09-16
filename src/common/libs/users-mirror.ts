import { UniqueConstraintError } from 'sequelize';
import { User } from '../../db/index.js';
import { cacheGet, cacheSet } from './cache.js';
import type { SessionUser } from './auth.js';

/**
 * Maps an identity-service principal to our local `users` row and returns
 * its id — the value every created_by / approved_by column stores.
 */
const TTL_SECONDS = 3600;

type Profile = { name: string; phone: string | null; email: string | null };
type Cached = Profile & { id: number };

export function displayName(user: SessionUser): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || `user-${String(user.id)}`;
}

function sameProfile(a: Profile, b: Profile): boolean {
  return a.name === b.name && a.phone === b.phone && a.email === b.email;
}

export async function resolveLocalUserId(user: SessionUser): Promise<number> {
  const profile: Profile = {
    name: displayName(user),
    phone: user.phone ?? null,
    email: user.email ?? null,
  };
  const key = `users:${String(user.id)}`;

  const cached = await cacheGet<Cached>(key);
  if (cached && sameProfile(cached, profile)) return cached.id;

  let row = await User.findOne({ where: { userId: user.id } });
  if (!row) {
    try {
      row = await User.create({
        userId: user.id,
        name: profile.name,
        phoneNumber: profile.phone,
        email: profile.email,
      });
    } catch (err) {
      // Concurrent first requests from a new user: another one won the insert.
      if (!(err instanceof UniqueConstraintError)) throw err;
      row = await User.findOne({ where: { userId: user.id } });
      if (!row) throw err;
    }
  } else if (
    !sameProfile(
      { name: row.name, phone: row.phoneNumber, email: row.email },
      profile,
    ) ||
    !row.isActive
  ) {
    await row.update({
      name: profile.name,
      phoneNumber: profile.phone,
      email: profile.email,
      isActive: true,
    });
  }

  await cacheSet(key, { id: row.id, ...profile }, TTL_SECONDS);
  return row.id;
}
