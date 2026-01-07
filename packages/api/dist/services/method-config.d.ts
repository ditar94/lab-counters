import type { CountRecordType, ParamsSnapshot, MethodParamsByType, MethodParams } from '@lab-counters/shared';
interface EffectiveParamsResult<T extends CountRecordType> {
    params: MethodParamsByType[T];
    source: 'org' | 'system_default';
    orgConfigVersion?: number;
}
/**
 * Get effective method params for a counter type
 * Priority: Org config > System defaults
 */
export declare function getEffectiveParams<T extends CountRecordType>(orgId: string, counterType: T): Promise<EffectiveParamsResult<T>>;
/**
 * Create a params snapshot for storing on a record
 * This captures the exact parameters used at count time for historical accuracy
 */
export declare function createParamsSnapshot(orgId: string, counterType: CountRecordType): Promise<ParamsSnapshot>;
/**
 * Get org method config with defaults merged (for admin UI)
 */
export declare function getOrgMethodConfig(orgId: string, counterType: CountRecordType): Promise<{
    counterType: CountRecordType;
    config: import("@lab-counters/shared").FetalMethodParams;
    isCustomized: boolean;
    version: number;
}>;
/**
 * Get all method configs for an org
 */
export declare function getAllOrgMethodConfigs(orgId: string): Promise<{
    counterType: CountRecordType;
    config: import("@lab-counters/shared").FetalMethodParams;
    isCustomized: boolean;
    version: number;
}[]>;
/**
 * Update org method config (admin only)
 * Merges with existing config, increments version
 */
export declare function updateOrgMethodConfig(orgId: string, counterType: CountRecordType, config: Partial<MethodParams>): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    orgId: string;
    version: number;
    counterType: import(".prisma/client").$Enums.CountRecordType;
    config: import("@prisma/client/runtime/library").JsonValue;
}>;
/**
 * Reset org method config to system defaults
 */
export declare function resetOrgMethodConfig(orgId: string, counterType: CountRecordType): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    orgId: string;
    version: number;
    counterType: import(".prisma/client").$Enums.CountRecordType;
    config: import("@prisma/client/runtime/library").JsonValue;
} | null>;
export {};
