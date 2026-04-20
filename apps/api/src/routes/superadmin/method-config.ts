import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error-handler';
import { auditLog } from '../../services/audit';
import {
  CountRecordTypeSchema,
  HemocytometerMethodConfigUpdateSchema,
  FetalMethodConfigUpdateSchema,
  ReticMethodConfigUpdateSchema,
  ParasiteMethodConfigUpdateSchema,
} from '@lab-counters/shared';
import {
  getAllOrgMethodConfigs,
  getOrgMethodConfig,
  updateOrgMethodConfig,
  resetOrgMethodConfig,
} from '../../services/method-config';
import type { CountRecordType } from '@lab-counters/shared';

export const methodConfigRouter = Router({ mergeParams: true });

/**
 * Verify org exists and is not the system org
 */
async function verifyOrg(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!org) {
    throw new AppError(404, 'NOT_FOUND', 'Organization not found');
  }

  if (org.slug === 'system') {
    throw new AppError(403, 'FORBIDDEN', 'Cannot access system organization');
  }

  return org;
}

/**
 * Get the appropriate schema for validating config based on counter type
 */
function getConfigSchema(counterType: CountRecordType) {
  switch (counterType) {
    case 'hemocytometer':
      return HemocytometerMethodConfigUpdateSchema;
    case 'fetal':
      return FetalMethodConfigUpdateSchema;
    case 'retic':
      return ReticMethodConfigUpdateSchema;
    case 'parasite':
      return ParasiteMethodConfigUpdateSchema;
    default:
      throw new AppError(400, 'INVALID_COUNTER_TYPE', 'Invalid counter type');
  }
}

/**
 * GET /api/superadmin/organizations/:orgId/method-config
 * List all method configs for the org
 */
methodConfigRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params;
    await verifyOrg(orgId);

    const configs = await getAllOrgMethodConfigs(orgId);
    res.json(configs);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/superadmin/organizations/:orgId/method-config/:counterType
 * Get config for specific counter type
 */
methodConfigRouter.get('/:counterType', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params;
    await verifyOrg(orgId);

    const counterType = CountRecordTypeSchema.parse(req.params.counterType);
    const config = await getOrgMethodConfig(orgId, counterType);
    res.json(config);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/superadmin/organizations/:orgId/method-config/:counterType
 * Update config for specific counter type
 */
methodConfigRouter.put('/:counterType', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params;
    await verifyOrg(orgId);

    const counterType = CountRecordTypeSchema.parse(req.params.counterType);

    // Validate config based on counter type
    const configSchema = getConfigSchema(counterType);
    const rawBody = req.body;
    const config = configSchema.parse(rawBody);
    const normalizedConfig =
      rawBody && typeof rawBody === 'object' && ('params' in rawBody || 'method' in rawBody)
        ? config
        : { params: rawBody };

    // Get before state for audit
    const before = await getOrgMethodConfig(orgId, counterType);

    // Update config
    const updated = await updateOrgMethodConfig(orgId, counterType, normalizedConfig);

    // Audit log
    await auditLog({
      orgId,
      actorUserId: req.user!.id,
      action: 'update',
      entityType: 'org_method_config',
      entityId: updated.id,
      metadata: {
        counterType,
        before: before.config,
        after: normalizedConfig,
      },
      req,
    });

    // Return updated config with defaults merged
    const result = await getOrgMethodConfig(orgId, counterType);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/superadmin/organizations/:orgId/method-config/:counterType
 * Reset config to system defaults
 */
methodConfigRouter.delete('/:counterType', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params;
    await verifyOrg(orgId);

    const counterType = CountRecordTypeSchema.parse(req.params.counterType);

    // Get before state for audit
    const before = await getOrgMethodConfig(orgId, counterType);

    // Delete config (resets to system defaults)
    await resetOrgMethodConfig(orgId, counterType);

    // Audit log
    await auditLog({
      orgId,
      actorUserId: req.user!.id,
      action: 'reset',
      entityType: 'org_method_config',
      entityId: `${orgId}_${counterType}`,
      metadata: {
        counterType,
        before: before.config,
        resetToDefaults: true,
      },
      req,
    });

    // Return config (now showing system defaults)
    const result = await getOrgMethodConfig(orgId, counterType);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
