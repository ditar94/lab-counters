"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEffectiveParams = getEffectiveParams;
exports.createParamsSnapshot = createParamsSnapshot;
exports.getOrgMethodConfig = getOrgMethodConfig;
exports.getAllOrgMethodConfigs = getAllOrgMethodConfigs;
exports.updateOrgMethodConfig = updateOrgMethodConfig;
exports.resetOrgMethodConfig = resetOrgMethodConfig;
const prisma_1 = require("../lib/prisma");
const shared_1 = require("@lab-counters/shared");
/**
 * Get effective method params for a counter type
 * Priority: Org config > System defaults
 */
async function getEffectiveParams(orgId, counterType) {
    // Try org-level config first
    const orgConfig = await prisma_1.prisma.orgMethodConfig.findUnique({
        where: {
            orgId_counterType: { orgId, counterType },
        },
    });
    if (orgConfig) {
        // Merge with defaults to ensure all required fields exist
        const defaults = (0, shared_1.getDefaultParams)(counterType);
        const mergedConfig = { ...defaults, ...orgConfig.config };
        return {
            params: mergedConfig,
            source: 'org',
            orgConfigVersion: orgConfig.version,
        };
    }
    // Fall back to system defaults
    return {
        params: (0, shared_1.getDefaultParams)(counterType),
        source: 'system_default',
    };
}
/**
 * Create a params snapshot for storing on a record
 * This captures the exact parameters used at count time for historical accuracy
 */
async function createParamsSnapshot(orgId, counterType) {
    const { params, source, orgConfigVersion } = await getEffectiveParams(orgId, counterType);
    return {
        methodVersion: shared_1.CURRENT_METHOD_VERSION,
        params,
        source,
        orgConfigVersion,
    };
}
/**
 * Get org method config with defaults merged (for admin UI)
 */
async function getOrgMethodConfig(orgId, counterType) {
    const config = await prisma_1.prisma.orgMethodConfig.findUnique({
        where: {
            orgId_counterType: { orgId, counterType },
        },
    });
    // Return with defaults merged
    const defaults = (0, shared_1.getDefaultParams)(counterType);
    return {
        counterType,
        config: config ? { ...defaults, ...config.config } : defaults,
        isCustomized: !!config,
        version: config?.version ?? 0,
    };
}
/**
 * Get all method configs for an org
 */
async function getAllOrgMethodConfigs(orgId) {
    const counterTypes = ['hemocytometer', 'fetal', 'retic', 'parasite'];
    return Promise.all(counterTypes.map((counterType) => getOrgMethodConfig(orgId, counterType)));
}
/**
 * Update org method config (admin only)
 * Merges with existing config, increments version
 */
async function updateOrgMethodConfig(orgId, counterType, config) {
    // Get existing config to merge
    const existing = await prisma_1.prisma.orgMethodConfig.findUnique({
        where: {
            orgId_counterType: { orgId, counterType },
        },
    });
    const defaults = (0, shared_1.getDefaultParams)(counterType);
    const existingConfig = existing ? existing.config : {};
    const mergedConfig = { ...defaults, ...existingConfig, ...config };
    return prisma_1.prisma.orgMethodConfig.upsert({
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
async function resetOrgMethodConfig(orgId, counterType) {
    return prisma_1.prisma.orgMethodConfig
        .delete({
        where: {
            orgId_counterType: { orgId, counterType },
        },
    })
        .catch(() => null); // Ignore if doesn't exist
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0aG9kLWNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zZXJ2aWNlcy9tZXRob2QtY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBbUJBLGdEQTRCQztBQU1ELG9EQVlDO0FBS0QsZ0RBZ0JDO0FBS0Qsd0RBTUM7QUFNRCxzREE4QkM7QUFLRCxvREFXQztBQXJKRCwwQ0FBdUM7QUFPdkMsaURBQWlHO0FBUWpHOzs7R0FHRztBQUNJLEtBQUssVUFBVSxrQkFBa0IsQ0FDdEMsS0FBYSxFQUNiLFdBQWM7SUFFZCw2QkFBNkI7SUFDN0IsTUFBTSxTQUFTLEdBQUcsTUFBTSxlQUFNLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQztRQUN4RCxLQUFLLEVBQUU7WUFDTCxpQkFBaUIsRUFBRSxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUU7U0FDMUM7S0FDRixDQUFDLENBQUM7SUFFSCxJQUFJLFNBQVMsRUFBRSxDQUFDO1FBQ2QsMERBQTBEO1FBQzFELE1BQU0sUUFBUSxHQUFHLElBQUEseUJBQWdCLEVBQUMsV0FBVyxDQUFDLENBQUM7UUFDL0MsTUFBTSxZQUFZLEdBQUcsRUFBRSxHQUFHLFFBQVEsRUFBRSxHQUFJLFNBQVMsQ0FBQyxNQUFpQixFQUFFLENBQUM7UUFFdEUsT0FBTztZQUNMLE1BQU0sRUFBRSxZQUFxQztZQUM3QyxNQUFNLEVBQUUsS0FBSztZQUNiLGdCQUFnQixFQUFFLFNBQVMsQ0FBQyxPQUFPO1NBQ3BDLENBQUM7SUFDSixDQUFDO0lBRUQsK0JBQStCO0lBQy9CLE9BQU87UUFDTCxNQUFNLEVBQUUsSUFBQSx5QkFBZ0IsRUFBQyxXQUFXLENBQUM7UUFDckMsTUFBTSxFQUFFLGdCQUFnQjtLQUN6QixDQUFDO0FBQ0osQ0FBQztBQUVEOzs7R0FHRztBQUNJLEtBQUssVUFBVSxvQkFBb0IsQ0FDeEMsS0FBYSxFQUNiLFdBQTRCO0lBRTVCLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLGdC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LCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwcmlzbWEgfSBmcm9tICcuLi9saWIvcHJpc21hJztcbmltcG9ydCB0eXBlIHtcbiAgQ291bnRSZWNvcmRUeXBlLFxuICBQYXJhbXNTbmFwc2hvdCxcbiAgTWV0aG9kUGFyYW1zQnlUeXBlLFxuICBNZXRob2RQYXJhbXMsXG59IGZyb20gJ0BsYWItY291bnRlcnMvc2hhcmVkJztcbmltcG9ydCB7IENVUlJFTlRfTUVUSE9EX1ZFUlNJT04sIGdldERlZmF1bHRQYXJhbXMsIE1FVEhPRF9ERUZBVUxUUyB9IGZyb20gJ0BsYWItY291bnRlcnMvc2hhcmVkJztcblxuaW50ZXJmYWNlIEVmZmVjdGl2ZVBhcmFtc1Jlc3VsdDxUIGV4dGVuZHMgQ291bnRSZWNvcmRUeXBlPiB7XG4gIHBhcmFtczogTWV0aG9kUGFyYW1zQnlUeXBlW1RdO1xuICBzb3VyY2U6ICdvcmcnIHwgJ3N5c3RlbV9kZWZhdWx0JztcbiAgb3JnQ29uZmlnVmVyc2lvbj86IG51bWJlcjtcbn1cblxuLyoqXG4gKiBHZXQgZWZmZWN0aXZlIG1ldGhvZCBwYXJhbXMgZm9yIGEgY291bnRlciB0eXBlXG4gKiBQcmlvcml0eTogT3JnIGNvbmZpZyA+IFN5c3RlbSBkZWZhdWx0c1xuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0RWZmZWN0aXZlUGFyYW1zPFQgZXh0ZW5kcyBDb3VudFJlY29yZFR5cGU+KFxuICBvcmdJZDogc3RyaW5nLFxuICBjb3VudGVyVHlwZTogVFxuKTogUHJvbWlzZTxFZmZlY3RpdmVQYXJhbXNSZXN1bHQ8VD4+IHtcbiAgLy8gVHJ5IG9yZy1sZXZlbCBjb25maWcgZmlyc3RcbiAgY29uc3Qgb3JnQ29uZmlnID0gYXdhaXQgcHJpc21hLm9yZ01ldGhvZENvbmZpZy5maW5kVW5pcXVlKHtcbiAgICB3aGVyZToge1xuICAgICAgb3JnSWRfY291bnRlclR5cGU6IHsgb3JnSWQsIGNvdW50ZXJUeXBlIH0sXG4gICAgfSxcbiAgfSk7XG5cbiAgaWYgKG9yZ0NvbmZpZykge1xuICAgIC8vIE1lcmdlIHdpdGggZGVmYXVsdHMgdG8gZW5zdXJlIGFsbCByZXF1aXJlZCBmaWVsZHMgZXhpc3RcbiAgICBjb25zdCBkZWZhdWx0cyA9IGdldERlZmF1bHRQYXJhbXMoY291bnRlclR5cGUpO1xuICAgIGNvbnN0IG1lcmdlZENvbmZpZyA9IHsgLi4uZGVmYXVsdHMsIC4uLihvcmdDb25maWcuY29uZmlnIGFzIG9iamVjdCkgfTtcblxuICAgIHJldHVybiB7XG4gICAgICBwYXJhbXM6IG1lcmdlZENvbmZpZyBhcyBNZXRob2RQYXJhbXNCeVR5cGVbVF0sXG4gICAgICBzb3VyY2U6ICdvcmcnLFxuICAgICAgb3JnQ29uZmlnVmVyc2lvbjogb3JnQ29uZmlnLnZlcnNpb24sXG4gICAgfTtcbiAgfVxuXG4gIC8vIEZhbGwgYmFjayB0byBzeXN0ZW0gZGVmYXVsdHNcbiAgcmV0dXJuIHtcbiAgICBwYXJhbXM6IGdldERlZmF1bHRQYXJhbXMoY291bnRlclR5cGUpLFxuICAgIHNvdXJjZTogJ3N5c3RlbV9kZWZhdWx0JyxcbiAgfTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBwYXJhbXMgc25hcHNob3QgZm9yIHN0b3Jpbmcgb24gYSByZWNvcmRcbiAqIFRoaXMgY2FwdHVyZXMgdGhlIGV4YWN0IHBhcmFtZXRlcnMgdXNlZCBhdCBjb3VudCB0aW1lIGZvciBoaXN0b3JpY2FsIGFjY3VyYWN5XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVQYXJhbXNTbmFwc2hvdChcbiAgb3JnSWQ6IHN0cmluZyxcbiAgY291bnRlclR5cGU6IENvdW50UmVjb3JkVHlwZVxuKTogUHJvbWlzZTxQYXJhbXNTbmFwc2hvdD4ge1xuICBjb25zdCB7IHBhcmFtcywgc291cmNlLCBvcmdDb25maWdWZXJzaW9uIH0gPSBhd2FpdCBnZXRFZmZlY3RpdmVQYXJhbXMob3JnSWQsIGNvdW50ZXJUeXBlKTtcblxuICByZXR1cm4ge1xuICAgIG1ldGhvZFZlcnNpb246IENVUlJFTlRfTUVUSE9EX1ZFUlNJT04sXG4gICAgcGFyYW1zLFxuICAgIHNvdXJjZSxcbiAgICBvcmdDb25maWdWZXJzaW9uLFxuICB9O1xufVxuXG4vKipcbiAqIEdldCBvcmcgbWV0aG9kIGNvbmZpZyB3aXRoIGRlZmF1bHRzIG1lcmdlZCAoZm9yIGFkbWluIFVJKVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0T3JnTWV0aG9kQ29uZmlnKG9yZ0lkOiBzdHJpbmcsIGNvdW50ZXJUeXBlOiBDb3VudFJlY29yZFR5cGUpIHtcbiAgY29uc3QgY29uZmlnID0gYXdhaXQgcHJpc21hLm9yZ01ldGhvZENvbmZpZy5maW5kVW5pcXVlKHtcbiAgICB3aGVyZToge1xuICAgICAgb3JnSWRfY291bnRlclR5cGU6IHsgb3JnSWQsIGNvdW50ZXJUeXBlIH0sXG4gICAgfSxcbiAgfSk7XG5cbiAgLy8gUmV0dXJuIHdpdGggZGVmYXVsdHMgbWVyZ2VkXG4gIGNvbnN0IGRlZmF1bHRzID0gZ2V0RGVmYXVsdFBhcmFtcyhjb3VudGVyVHlwZSk7XG5cbiAgcmV0dXJuIHtcbiAgICBjb3VudGVyVHlwZSxcbiAgICBjb25maWc6IGNvbmZpZyA/IHsgLi4uZGVmYXVsdHMsIC4uLihjb25maWcuY29uZmlnIGFzIG9iamVjdCkgfSA6IGRlZmF1bHRzLFxuICAgIGlzQ3VzdG9taXplZDogISFjb25maWcsXG4gICAgdmVyc2lvbjogY29uZmlnPy52ZXJzaW9uID8/IDAsXG4gIH07XG59XG5cbi8qKlxuICogR2V0IGFsbCBtZXRob2QgY29uZmlncyBmb3IgYW4gb3JnXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRBbGxPcmdNZXRob2RDb25maWdzKG9yZ0lkOiBzdHJpbmcpIHtcbiAgY29uc3QgY291bnRlclR5cGVzOiBDb3VudFJlY29yZFR5cGVbXSA9IFsnaGVtb2N5dG9tZXRlcicsICdmZXRhbCcsICdyZXRpYycsICdwYXJhc2l0ZSddO1xuXG4gIHJldHVybiBQcm9taXNlLmFsbChcbiAgICBjb3VudGVyVHlwZXMubWFwKChjb3VudGVyVHlwZSkgPT4gZ2V0T3JnTWV0aG9kQ29uZmlnKG9yZ0lkLCBjb3VudGVyVHlwZSkpXG4gICk7XG59XG5cbi8qKlxuICogVXBkYXRlIG9yZyBtZXRob2QgY29uZmlnIChhZG1pbiBvbmx5KVxuICogTWVyZ2VzIHdpdGggZXhpc3RpbmcgY29uZmlnLCBpbmNyZW1lbnRzIHZlcnNpb25cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZU9yZ01ldGhvZENvbmZpZyhcbiAgb3JnSWQ6IHN0cmluZyxcbiAgY291bnRlclR5cGU6IENvdW50UmVjb3JkVHlwZSxcbiAgY29uZmlnOiBQYXJ0aWFsPE1ldGhvZFBhcmFtcz5cbikge1xuICAvLyBHZXQgZXhpc3RpbmcgY29uZmlnIHRvIG1lcmdlXG4gIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLm9yZ01ldGhvZENvbmZpZy5maW5kVW5pcXVlKHtcbiAgICB3aGVyZToge1xuICAgICAgb3JnSWRfY291bnRlclR5cGU6IHsgb3JnSWQsIGNvdW50ZXJUeXBlIH0sXG4gICAgfSxcbiAgfSk7XG5cbiAgY29uc3QgZGVmYXVsdHMgPSBnZXREZWZhdWx0UGFyYW1zKGNvdW50ZXJUeXBlKTtcbiAgY29uc3QgZXhpc3RpbmdDb25maWcgPSBleGlzdGluZyA/IChleGlzdGluZy5jb25maWcgYXMgb2JqZWN0KSA6IHt9O1xuICBjb25zdCBtZXJnZWRDb25maWcgPSB7IC4uLmRlZmF1bHRzLCAuLi5leGlzdGluZ0NvbmZpZywgLi4uY29uZmlnIH07XG5cbiAgcmV0dXJuIHByaXNtYS5vcmdNZXRob2RDb25maWcudXBzZXJ0KHtcbiAgICB3aGVyZToge1xuICAgICAgb3JnSWRfY291bnRlclR5cGU6IHsgb3JnSWQsIGNvdW50ZXJUeXBlIH0sXG4gICAgfSxcbiAgICBjcmVhdGU6IHtcbiAgICAgIG9yZ0lkLFxuICAgICAgY291bnRlclR5cGUsXG4gICAgICBjb25maWc6IG1lcmdlZENvbmZpZyxcbiAgICB9LFxuICAgIHVwZGF0ZToge1xuICAgICAgY29uZmlnOiBtZXJnZWRDb25maWcsXG4gICAgICB2ZXJzaW9uOiB7IGluY3JlbWVudDogMSB9LFxuICAgIH0sXG4gIH0pO1xufVxuXG4vKipcbiAqIFJlc2V0IG9yZyBtZXRob2QgY29uZmlnIHRvIHN5c3RlbSBkZWZhdWx0c1xuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVzZXRPcmdNZXRob2RDb25maWcoXG4gIG9yZ0lkOiBzdHJpbmcsXG4gIGNvdW50ZXJUeXBlOiBDb3VudFJlY29yZFR5cGVcbikge1xuICByZXR1cm4gcHJpc21hLm9yZ01ldGhvZENvbmZpZ1xuICAgIC5kZWxldGUoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgb3JnSWRfY291bnRlclR5cGU6IHsgb3JnSWQsIGNvdW50ZXJUeXBlIH0sXG4gICAgICB9LFxuICAgIH0pXG4gICAgLmNhdGNoKCgpID0+IG51bGwpOyAvLyBJZ25vcmUgaWYgZG9lc24ndCBleGlzdFxufVxuIl19