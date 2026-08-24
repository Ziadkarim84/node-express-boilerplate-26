import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../common/errors/app-error.js';

vi.mock('../../db/index.js', () => ({
  User: {
    findAll: vi.fn(),
    findByPk: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

const { User } = await import('../../db/index.js');
const usersService = await import('./users.service.js');

const mockUser = {
  id: 1,
  firstName: 'Jamal',
  lastName: 'Uddin',
  email: 'jamal@example.com',
};

describe('users.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserById', () => {
    it('returns the user when found', async () => {
      vi.mocked(User.findByPk).mockResolvedValue(mockUser as never);

      const user = await usersService.getUserById(1);

      expect(user).toEqual(mockUser);
      expect(User.findByPk).toHaveBeenCalledWith(1);
    });

    it('throws 404 AppError when not found', async () => {
      vi.mocked(User.findByPk).mockResolvedValue(null);

      await expect(usersService.getUserById(999)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('createUser', () => {
    it('creates a user when the email is unused', async () => {
      vi.mocked(User.findOne).mockResolvedValue(null);
      vi.mocked(User.create).mockResolvedValue(mockUser as never);

      const user = await usersService.createUser({
        firstName: 'Jamal',
        lastName: 'Uddin',
        email: 'jamal@example.com',
      });

      expect(user).toEqual(mockUser);
      expect(User.create).toHaveBeenCalledWith({
        firstName: 'Jamal',
        lastName: 'Uddin',
        email: 'jamal@example.com',
      });
    });

    it('throws 409 AppError when the email is taken', async () => {
      vi.mocked(User.findOne).mockResolvedValue(mockUser as never);

      await expect(
        usersService.createUser({
          firstName: 'Jamal',
          lastName: 'Uddin',
          email: 'jamal@example.com',
        }),
      ).rejects.toBeInstanceOf(AppError);
      expect(User.create).not.toHaveBeenCalled();
    });
  });
});
