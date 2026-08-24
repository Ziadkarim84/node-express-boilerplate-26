import { Router } from 'express';
import { healthRouter } from './modules/health/health.router.js';
import { usersRouter } from './modules/users/users.router.js';

/**
 * Central route registry. Routes are versioned (/v1/...) so breaking
 * changes ship as /v2 alongside /v1 instead of breaking clients.
 * One line per module — modules own their internal routing.
 */
export const router = Router();

router.use('/v1/health', healthRouter);
router.use('/v1/users', usersRouter);
