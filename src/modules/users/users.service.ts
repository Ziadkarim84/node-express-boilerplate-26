import { AppError } from '../../common/errors/app-error.js';
import { User } from '../../db/index.js';
import type { CreateUserInput } from './users.schemas.js';

/**
 * Service layer convention: all business logic and DB access lives here.
 * Services throw AppError for expected failures; routers stay thin.
 */

export async function listUsers(
  limit: number,
  offset: number,
): Promise<User[]> {
  return User.findAll({
    limit,
    offset,
    order: [['id', 'DESC']],
  });
}

export async function getUserById(userId: number): Promise<User> {
  const user = await User.findByPk(userId);
  if (!user) {
    throw AppError.notFound(`User ${userId} not found`);
  }
  return user;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const existing = await User.findOne({ where: { email: input.email } });
  if (existing) {
    throw AppError.conflict(`Email ${input.email} is already in use`);
  }

  return User.create({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
  });
}
