import { UniqueConstraintError } from 'sequelize';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/index.js', () => ({
  User: { findOne: vi.fn(), create: vi.fn() },
}));
vi.mock('./cache.js', () => ({ cacheGet: vi.fn(), cacheSet: vi.fn() }));

const { User } = await import('../../db/index.js');
const { cacheGet, cacheSet } = await import('./cache.js');
const { resolveLocalUserId } = await import('./users-mirror.js');

const principal = {
  id: 42,
  firstName: 'Sam',
  lastName: 'Alvarez',
  email: 'sam@shopup.org',
  roleIds: [],
  scopeIds: null,
};
const row = (over = {}) => ({
  id: 7,
  userId: 42,
  name: 'Sam Alvarez',
  phoneNumber: null,
  email: 'sam@shopup.org',
  isActive: true,
  update: vi.fn().mockResolvedValue(undefined),
  ...over,
});

describe('resolveLocalUserId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the cached id without touching the DB when the profile is unchanged', async () => {
    vi.mocked(cacheGet).mockResolvedValue({
      id: 7,
      name: 'Sam Alvarez',
      phone: null,
      email: 'sam@shopup.org',
    });

    expect(await resolveLocalUserId(principal)).toBe(7);
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('creates the row on first sight', async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);
    vi.mocked(User.findOne).mockResolvedValue(null);
    vi.mocked(User.create).mockResolvedValue(row() as never);

    expect(await resolveLocalUserId(principal)).toBe(7);
    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 42, name: 'Sam Alvarez' }),
    );
    expect(cacheSet).toHaveBeenCalled();
  });

  it('survives a concurrent first insert by re-reading the winner', async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);
    vi.mocked(User.findOne)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(row() as never);
    vi.mocked(User.create).mockRejectedValue(
      new UniqueConstraintError({ message: 'dup', errors: [] }),
    );

    expect(await resolveLocalUserId(principal)).toBe(7);
  });

  it('does not write when the stored profile already matches', async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);
    const existing = row();
    vi.mocked(User.findOne).mockResolvedValue(existing as never);

    await resolveLocalUserId(principal);

    expect(existing.update).not.toHaveBeenCalled();
    expect(User.create).not.toHaveBeenCalled();
  });

  it('updates the row when the identity profile changed', async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);
    const existing = row({ name: 'Old Name' });
    vi.mocked(User.findOne).mockResolvedValue(existing as never);

    await resolveLocalUserId(principal);

    expect(existing.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sam Alvarez' }),
    );
  });
});
