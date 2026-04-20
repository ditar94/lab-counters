import { Router } from 'express';
import { authenticate, superadminOnly } from '../../middleware/auth';
import { organizationsRouter } from './organizations';
import { sitesRouter } from './sites';
import { usersRouter } from './users';
import { syncRouter } from './sync';
import { methodConfigRouter } from './method-config';

export const superadminRouter = Router();

// All superadmin routes require authentication and superadmin role
superadminRouter.use(authenticate);
superadminRouter.use(superadminOnly);

// Mount routes
superadminRouter.use('/organizations', organizationsRouter);
superadminRouter.use('/sync', syncRouter);

// Nested routes for sites, users, and method-config under organizations
superadminRouter.use('/organizations/:orgId/sites', sitesRouter);
superadminRouter.use('/organizations/:orgId/users', usersRouter);
superadminRouter.use('/organizations/:orgId/method-config', methodConfigRouter);
