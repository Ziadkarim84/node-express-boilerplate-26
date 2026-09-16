import { Router } from 'express';
import { ok } from '../../common/utils/response.js';
import { authorize } from '../../common/middlewares/authorize.js';

// Login/registration/logout/passwords live in the identity service —
// this service only exposes introspection of the current principal.
export const authRouter = Router();

authRouter.get('/me', authorize(), (req, res) => {
  ok(res, req.user);
});
