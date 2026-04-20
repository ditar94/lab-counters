import { prisma } from '../lib/prisma';
import type {
  CountRecordType,
  ParamsSnapshot,
  MethodParamsByType,
  MethodConfigByType,
  MethodConfig,
} from '@lab-counters/shared';
import { CURRENT_METHOD_VERSION, getDefaultMethodConfig } from '@lab-counters/shared';

interface EffectiveMethodConfigResult<T extends CountRecordType> {
  config: MethodConfigByType[T];
  source: 'org' | 'system_default';
  orgConfigVersion?: number;
}

function normalizeMethodConfig<T extends CountRecordType>(
  counterType: T,
  config: unknown
): MethodConfigByType[T] {
  const defaults = getDefaultMethodConfig(counterType);

  if (!config || typeof config !== 'object') {
    return defaults;
  }

  const configObj = config as Partial<MethodConfig>;

  // Legacy shape: params only (no method/params wrapper)
  if (!('method' in configObj) && !('params' in configObj)) {
    return {
      method: defaults.method,
      params: { ...defaults.params, ...(configObj as MethodParamsByType[T]) },
    };
  }

  return {
    method: (configObj.method as MethodConfigByType[T]['method']) ?? defaults.method,
    params: { ...defaults.params, ...(configObj.params as Partial<MethodParamsByType[T]>) },
  };
}

/**
 * Get effective method params for a counter type
 * Priority: Org config > System defaults
 */
export async function getEffectiveMethodConfig<T extends CountRecordType>(
  orgId: string,
  counterType: T
): Promise<EffectiveMethodConfigResult<T>> {
  // Try org-level config first
  const orgConfig = await prisma.orgMethodConfig.findUnique({
    where: {
      orgId_counterType: { orgId, counterType },
    },
  });

  if (orgConfig) {
    return {
      config: normalizeMethodConfig(counterType, orgConfig.config),
      source: 'org',
      orgConfigVersion: orgConfig.version,
    };
  }

  // Fall back to system defaults
  return {
    config: getDefaultMethodConfig(counterType),
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
  const { config, source, orgConfigVersion } = await getEffectiveMethodConfig(orgId, counterType);

  return {
    methodVersion: CURRENT_METHOD_VERSION,
    methodId: config.method,
    params: config.params,
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
  const defaults = getDefaultMethodConfig(counterType);

  return {
    counterType,
    config: config ? normalizeMethodConfig(counterType, config.config) : defaults,
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
  config: Partial<MethodConfig>
) {
  // Get existing config to merge
  const existing = await prisma.orgMethodConfig.findUnique({
    where: {
      orgId_counterType: { orgId, counterType },
    },
  });

  const defaults = getDefaultMethodConfig(counterType);
  const existingConfig = existing ? normalizeMethodConfig(counterType, existing.config) : defaults;
  const mergedConfig = {
    method: config.method ?? existingConfig.method,
    params: { ...existingConfig.params, ...(config.params ?? {}) },
  };

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
