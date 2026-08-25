import { Router } from 'express';
import { isAuthenticated } from '../../common/middlewares/security.js';

// Login/registration/logout/passwords live in the identity service —
// this service only exposes introspection of the current principal.
export const authRouter = Router();

authRouter.get('/me', isAuthenticated, (req, res) => {
  res.json({ data: req.user });
});
