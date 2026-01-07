import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, enforceOrgScope } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { auditLog } from '../services/audit';
import {
  CountRecordTypeSchema,
  HemocytometerMethodParamsSchema,
  FetalMethodParamsSchema,
  ReticMethodParamsSchema,
  ParasiteMethodParamsSchema,
} from '@lab-counters/shared';
import {
  getAllOrgMethodConfigs,
  getOrgMethodConfig,
  updateOrgMethodConfig,
  resetOrgMethodConfig,
} from '../services/method-config';
import type { CountRecordType } from '@lab-counters/shared';

export const methodConfigRouter = Router();

// All routes require authentication and admin role
methodConfigRouter.use(authenticate);
methodConfigRouter.use(enforceOrgScope);
methodConfigRouter.use(authorize('admin'));

/**
 * GET /api/method-config
 * List all method configs for the org
 */
methodConfigRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = await getAllOrgMethodConfigs(req.user!.orgId);
    res.json(configs);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/method-config/:counterType
 * Get config for specific counter type
 */
methodConfigRouter.get('/:counterType', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const counterType = CountRecordTypeSchema.parse(req.params.counterType);
    const config = await getOrgMethodConfig(req.user!.orgId, counterType);
    res.json(config);
  } catch (error) {
    next(error);
  }
});

/**
 * Get the appropriate schema for validating config based on counter type
 */
function getConfigSchema(counterType: CountRecordType) {
  switch (counterType) {
    case 'hemocytometer':
      return HemocytometerMethodParamsSchema.partial();
    case 'fetal':
      return FetalMethodParamsSchema.partial();
    case 'retic':
      return ReticMethodParamsSchema.partial();
    case 'parasite':
      return ParasiteMethodParamsSchema.partial();
    default:
      throw new AppError(400, 'INVALID_COUNTER_TYPE', 'Invalid counter type');
  }
}

/**
 * PUT /api/method-config/:counterType
 * Update config for specific counter type
 */
methodConfigRouter.put('/:counterType', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const counterType = CountRecordTypeSchema.parse(req.params.counterType);

    // Validate config based on counter type
    const configSchema = getConfigSchema(counterType);
    const config = configSchema.parse(req.body);

    // Get before state for audit
    const before = await getOrgMethodConfig(req.user!.orgId, counterType);

    // Update config
    const updated = await updateOrgMethodConfig(req.user!.orgId, counterType, config);

    // Audit log
    await auditLog({
      orgId: req.user!.orgId,
      actorUserId: req.user!.id,
      action: 'update',
      entityType: 'org_method_config',
      entityId: updated.id,
      metadata: {
        counterType,
        before: before.config,
        after: config,
      },
      req,
    });

    // Return updated config with defaults merged
    const result = await getOrgMethodConfig(req.user!.orgId, counterType);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/method-config/:counterType
 * Reset config to system defaults
 */
methodConfigRouter.delete('/:counterType', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const counterType = CountRecordTypeSchema.parse(req.params.counterType);

    // Get before state for audit
    const before = await getOrgMethodConfig(req.user!.orgId, counterType);

    // Delete config (resets to system defaults)
    await resetOrgMethodConfig(req.user!.orgId, counterType);

    // Audit log
    await auditLog({
      orgId: req.user!.orgId,
      actorUserId: req.user!.id,
      action: 'reset',
      entityType: 'org_method_config',
      entityId: `${req.user!.orgId}_${counterType}`,
      metadata: {
        counterType,
        before: before.config,
        resetToDefaults: true,
      },
      req,
    });

    // Return config (now showing system defaults)
    const result = await getOrgMethodConfig(req.user!.orgId, counterType);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
