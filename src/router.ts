import { Router } from 'express';
import { authRouter } from './modules/auth/auth.router.js';
import { healthRouter } from './modules/health/health.router.js';
import { exampleRouter } from './modules/example/example.router.js';

// Central route registry — one line per module. Routes are versioned (/v1)
// so breaking changes ship as /v2 alongside /v1.
export const router = Router();

router.use('/v1/health', healthRouter);
router.use('/v1/auth', authRouter);
router.use('/v1/examples', exampleRouter);
