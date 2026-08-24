import { Router } from 'express';
import { getValidated, validate } from '../../common/middlewares/validate.js';
import {
  createUserSchemas,
  getUserSchemas,
  listUsersSchemas,
} from './users.schemas.js';
import * as usersService from './users.service.js';

/**
 * Router convention: parse/validate the request, call the service,
 * shape the response. No business logic here.
 * Express 5 forwards rejected promises to the error handler automatically —
 * no try/catch or asyncHandler wrappers needed.
 */
export const usersRouter = Router();

usersRouter.get('/', validate(listUsersSchemas), async (req, res) => {
  const { query } = getValidated<typeof listUsersSchemas>(req);
  const users = await usersService.listUsers(query.limit, query.offset);
  res.json({ data: users });
});

usersRouter.get('/:userId', validate(getUserSchemas), async (req, res) => {
  const { params } = getValidated<typeof getUserSchemas>(req);
  const user = await usersService.getUserById(params.userId);
  res.json({ data: user });
});

usersRouter.post('/', validate(createUserSchemas), async (req, res) => {
  const { body } = getValidated<typeof createUserSchemas>(req);
  const user = await usersService.createUser(body);
  res.status(201).json({ data: user });
});
