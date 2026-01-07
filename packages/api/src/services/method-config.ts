import { prisma } from '../lib/prisma';
import type {
  CountRecordType,
  ParamsSnapshot,
  MethodParamsByType,
  MethodParams,
} from '@lab-counters/shared';
import { CURRENT_METHOD_VERSION, getDefaultParams, METHOD_DEFAULTS } from '@lab-counters/shared';

interface EffectiveParamsResult<T extends CountRecordType> {
  params: MethodParamsByType[T];
  source: 'org' | 'system_default';
  orgConfigVersion?: number;
}

/**
 * Get effective method params for a counter type
 * Priority: Org config > System defaults
 */
export async function getEffectiveParams<T extends CountRecordType>(
  orgId: string,
  counterType: T
): Promise<EffectiveParamsResult<T>> {
  // Try org-level config first
  const orgConfig = await prisma.orgMethodConfig.findUnique({
    where: {
      orgId_counterType: { orgId, counterType },
    },
  });

  if (orgConfig) {
    // Merge with defaults to ensure all required fields exist
    const defaults = getDefaultParams(counterType);
    const mergedConfig = { ...defaults, ...(orgConfig.config as object) };

    return {
      params: mergedConfig as MethodParamsByType[T],
      source: 'org',
      orgConfigVersion: orgConfig.version,
    };
  }

  // Fall back to system defaults
  return {
    params: getDefaultParams(counterType),
    source: 'system_default',
  };
}

/**
 * Create a params snapshot for storing on a record
 * This captures the exact parameters used at count time for historical accuracy
 */
export async function createParamsSnapshot(
  orgId: string,
  counterType: CountRecordType
): Promise<ParamsSnapshot> {
  const { params, source, orgConfigVersion } = await getEffectiveParams(orgId, counterType);

  return {
    methodVersion: CURRENT_METHOD_VERSION,
    params,
    source,
    orgConfigVersion,
  };
}

/**
 * Get org method config with defaults merged (for admin UI)
 */
export async function getOrgMethodConfig(orgId: string, counterType: CountRecordType) {
  const config = await prisma.orgMethodConfig.findUnique({
    where: {
      orgId_counterType: { orgId, counterType },
    },
  });

  // Return with defaults merged
  const defaults = getDefaultParams(counterType);

  return {
    counterType,
    config: config ? { ...defaults, ...(config.config as object) } : defaults,
    isCustomized: !!config,
    version: config?.version ?? 0,
  };
}

/**
 * Get all method configs for an org
 */
export async function getAllOrgMethodConfigs(orgId: string) {
  const counterTypes: CountRecordType[] = ['hemocytometer', 'fetal', 'retic', 'parasite'];

  return Promise.all(
    counterTypes.map((counterType) => getOrgMethodConfig(orgId, counterType))
  );
}

/**
 * Update org method config (admin only)
 * Merges with existing config, increments version
 */
export async function updateOrgMethodConfig(
  orgId: string,
  counterType: CountRecordType,
  config: Partial<MethodParams>
) {
  // Get existing config to merge
  const existing = await prisma.orgMethodConfig.findUnique({
    where: {
      orgId_counterType: { orgId, counterType },
    },
  });

  const defaults = getDefaultParams(counterType);
  const existingConfig = existing ? (existing.config as object) : {};
  const mergedConfig = { ...defaults, ...existingConfig, ...config };

  return prisma.orgMethodConfig.upsert({
    where: {
      orgId_counterType: { orgId, counterType },
    },
    create: {
      orgId,
      counterType,
      config: mergedConfig,
    },
    update: {
      config: mergedConfig,
      version: { increment: 1 },
    },
  });
}

/**
 * Reset org method config to system defaults
 */
export async function resetOrgMethodConfig(
  orgId: string,
  counterType: CountRecordType
) {
  return prisma.orgMethodConfig
    .delete({
      where: {
        orgId_counterType: { orgId, counterType },
      },
    })
    .catch(() => null); // Ignore if doesn't exist
}
