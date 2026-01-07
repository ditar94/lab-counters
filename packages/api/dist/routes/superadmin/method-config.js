"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.methodConfigRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../../lib/prisma");
const error_handler_1 = require("../../middleware/error-handler");
const audit_1 = require("../../services/audit");
const shared_1 = require("@lab-counters/shared");
const method_config_1 = require("../../services/method-config");
exports.methodConfigRouter = (0, express_1.Router)({ mergeParams: true });
/**
 * Verify org exists and is not the system org
 */
async function verifyOrg(orgId) {
    const org = await prisma_1.prisma.organization.findUnique({
        where: { id: orgId },
    });
    if (!org) {
        throw new error_handler_1.AppError(404, 'NOT_FOUND', 'Organization not found');
    }
    if (org.slug === 'system') {
        throw new error_handler_1.AppError(403, 'FORBIDDEN', 'Cannot access system organization');
    }
    return org;
}
/**
 * Get the appropriate schema for validating config based on counter type
 */
function getConfigSchema(counterType) {
    switch (counterType) {
        case 'hemocytometer':
            return shared_1.HemocytometerMethodParamsSchema.partial();
        case 'fetal':
            return shared_1.FetalMethodParamsSchema.partial();
        case 'retic':
            return shared_1.ReticMethodParamsSchema.partial();
        case 'parasite':
            return shared_1.ParasiteMethodParamsSchema.partial();
        default:
            throw new error_handler_1.AppError(400, 'INVALID_COUNTER_TYPE', 'Invalid counter type');
    }
}
/**
 * GET /api/superadmin/organizations/:orgId/method-config
 * List all method configs for the org
 */
exports.methodConfigRouter.get('/', async (req, res, next) => {
    try {
        const { orgId } = req.params;
        await verifyOrg(orgId);
        const configs = await (0, method_config_1.getAllOrgMethodConfigs)(orgId);
        res.json(configs);
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/superadmin/organizations/:orgId/method-config/:counterType
 * Get config for specific counter type
 */
exports.methodConfigRouter.get('/:counterType', async (req, res, next) => {
    try {
        const { orgId } = req.params;
        await verifyOrg(orgId);
        const counterType = shared_1.CountRecordTypeSchema.parse(req.params.counterType);
        const config = await (0, method_config_1.getOrgMethodConfig)(orgId, counterType);
        res.json(config);
    }
    catch (error) {
        next(error);
    }
});
/**
 * PUT /api/superadmin/organizations/:orgId/method-config/:counterType
 * Update config for specific counter type
 */
exports.methodConfigRouter.put('/:counterType', async (req, res, next) => {
    try {
        const { orgId } = req.params;
        await verifyOrg(orgId);
        const counterType = shared_1.CountRecordTypeSchema.parse(req.params.counterType);
        // Validate config based on counter type
        const configSchema = getConfigSchema(counterType);
        const config = configSchema.parse(req.body);
        // Get before state for audit
        const before = await (0, method_config_1.getOrgMethodConfig)(orgId, counterType);
        // Update config
        const updated = await (0, method_config_1.updateOrgMethodConfig)(orgId, counterType, config);
        // Audit log
        await (0, audit_1.auditLog)({
            orgId,
            actorUserId: req.user.id,
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
        const result = await (0, method_config_1.getOrgMethodConfig)(orgId, counterType);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
/**
 * DELETE /api/superadmin/organizations/:orgId/method-config/:counterType
 * Reset config to system defaults
 */
exports.methodConfigRouter.delete('/:counterType', async (req, res, next) => {
    try {
        const { orgId } = req.params;
        await verifyOrg(orgId);
        const counterType = shared_1.CountRecordTypeSchema.parse(req.params.counterType);
        // Get before state for audit
        const before = await (0, method_config_1.getOrgMethodConfig)(orgId, counterType);
        // Delete config (resets to system defaults)
        await (0, method_config_1.resetOrgMethodConfig)(orgId, counterType);
        // Audit log
        await (0, audit_1.auditLog)({
            orgId,
            actorUserId: req.user.id,
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
        const result = await (0, method_config_1.getOrgMethodConfig)(orgId, counterType);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0aG9kLWNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9yb3V0ZXMvc3VwZXJhZG1pbi9tZXRob2QtY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFDQUFrRTtBQUNsRSw2Q0FBMEM7QUFDMUMsa0VBQTBEO0FBQzFELGdEQUFnRDtBQUNoRCxpREFNOEI7QUFDOUIsZ0VBS3NDO0FBR3pCLFFBQUEsa0JBQWtCLEdBQUcsSUFBQSxnQkFBTSxFQUFDLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFFaEU7O0dBRUc7QUFDSCxLQUFLLFVBQVUsU0FBUyxDQUFDLEtBQWE7SUFDcEMsTUFBTSxHQUFHLEdBQUcsTUFBTSxlQUFNLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQztRQUMvQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFO0tBQ3JCLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNULE1BQU0sSUFBSSx3QkFBUSxDQUFDLEdBQUcsRUFBRSxXQUFXLEVBQUUsd0JBQXdCLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBRUQsSUFBSSxHQUFHLENBQUMsSUFBSSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQzFCLE1BQU0sSUFBSSx3QkFBUSxDQUFDLEdBQUcsRUFBRSxXQUFXLEVBQUUsbUNBQW1DLENBQUMsQ0FBQztJQUM1RSxDQUFDO0lBRUQsT0FBTyxHQUFHLENBQUM7QUFDYixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLGVBQWUsQ0FBQyxXQUE0QjtJQUNuRCxRQUFRLFdBQVcsRUFBRSxDQUFDO1FBQ3BCLEtBQUssZUFBZTtZQUNsQixPQUFPLHdDQUErQixDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ25ELEtBQUssT0FBTztZQUNWLE9BQU8sZ0NBQXVCLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDM0MsS0FBSyxPQUFPO1lBQ1YsT0FBTyxn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bkMsUUFBUSxFQUFFO2dCQUNSLFdBQVc7Z0JBQ1gsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNO2dCQUNyQixlQUFlLEVBQUUsSUFBSTthQUN0QjtZQUNELEdBQUc7U0FDSixDQUFDLENBQUM7UUFFSCw4Q0FBOEM7UUFDOUMsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFBLGtDQUFrQixFQUFDLEtBQUssRUFBRSxXQUFXLENBQUMsQ0FBQztRQUM1RCxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ25CLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ2QsQ0FBQztBQUNILENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUm91dGVyLCBSZXF1ZXN0LCBSZXNwb25zZSwgTmV4dEZ1bmN0aW9uIH0gZnJvbSAnZXhwcmVzcyc7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tICcuLi8uLi9saWIvcHJpc21hJztcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSAnLi4vLi4vbWlkZGxld2FyZS9lcnJvci1oYW5kbGVyJztcbmltcG9ydCB7IGF1ZGl0TG9nIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvYXVkaXQnO1xuaW1wb3J0IHtcbiAgQ291bnRSZWNvcmRUeXBlU2NoZW1hLFxuICBIZW1vY3l0b21ldGVyTWV0aG9kUGFyYW1zU2NoZW1hLFxuICBGZXRhbE1ldGhvZFBhcmFtc1NjaGVtYSxcbiAgUmV0aWNNZXRob2RQYXJhbXNTY2hlbWEsXG4gIFBhcmFzaXRlTWV0aG9kUGFyYW1zU2NoZW1hLFxufSBmcm9tICdAbGFiLWNvdW50ZXJzL3NoYXJlZCc7XG5pbXBvcnQge1xuICBnZXRBbGxPcmdNZXRob2RDb25maWdzLFxuICBnZXRPcmdNZXRob2RDb25maWcsXG4gIHVwZGF0ZU9yZ01ldGhvZENvbmZpZyxcbiAgcmVzZXRPcmdNZXRob2RDb25maWcsXG59IGZyb20gJy4uLy4uL3NlcnZpY2VzL21ldGhvZC1jb25maWcnO1xuaW1wb3J0IHR5cGUgeyBDb3VudFJlY29yZFR5cGUgfSBmcm9tICdAbGFiLWNvdW50ZXJzL3NoYXJlZCc7XG5cbmV4cG9ydCBjb25zdCBtZXRob2RDb25maWdSb3V0ZXIgPSBSb3V0ZXIoeyBtZXJnZVBhcmFtczogdHJ1ZSB9KTtcblxuLyoqXG4gKiBWZXJpZnkgb3JnIGV4aXN0cyBhbmQgaXMgbm90IHRoZSBzeXN0ZW0gb3JnXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHZlcmlmeU9yZyhvcmdJZDogc3RyaW5nKSB7XG4gIGNvbnN0IG9yZyA9IGF3YWl0IHByaXNtYS5vcmdhbml6YXRpb24uZmluZFVuaXF1ZSh7XG4gICAgd2hlcmU6IHsgaWQ6IG9yZ0lkIH0sXG4gIH0pO1xuXG4gIGlmICghb3JnKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgJ05PVF9GT1VORCcsICdPcmdhbml6YXRpb24gbm90IGZvdW5kJyk7XG4gIH1cblxuICBpZiAob3JnLnNsdWcgPT09ICdzeXN0ZW0nKSB7XG4gICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgJ0ZPUkJJRERFTicsICdDYW5ub3QgYWNjZXNzIHN5c3RlbSBvcmdhbml6YXRpb24nKTtcbiAgfVxuXG4gIHJldHVybiBvcmc7XG59XG5cbi8qKlxuICogR2V0IHRoZSBhcHByb3ByaWF0ZSBzY2hlbWEgZm9yIHZhbGlkYXRpbmcgY29uZmlnIGJhc2VkIG9uIGNvdW50ZXIgdHlwZVxuICovXG5mdW5jdGlvbiBnZXRDb25maWdTY2hlbWEoY291bnRlclR5cGU6IENvdW50UmVjb3JkVHlwZSkge1xuICBzd2l0Y2ggKGNvdW50ZXJUeXBlKSB7XG4gICAgY2FzZSAnaGVtb2N5dG9tZXRlcic6XG4gICAgICByZXR1cm4gSGVtb2N5dG9tZXRlck1ldGhvZFBhcmFtc1NjaGVtYS5wYXJ0aWFsKCk7XG4gICAgY2FzZSAnZmV0YWwnOlxuICAgICAgcmV0dXJuIEZldGFsTWV0aG9kUGFyYW1zU2NoZW1hLnBhcnRpYWwoKTtcbiAgICBjYXNlICdyZXRpYyc6XG4gICAgICByZXR1cm4gUmV0aWNNZXRob2RQYXJhbXNTY2hlbWEucGFydGlhbCgpO1xuICAgIGNhc2UgJ3BhcmFzaXRlJzpcbiAgICAgIHJldHVybiBQYXJhc2l0ZU1ldGhvZFBhcmFtc1NjaGVtYS5wYXJ0aWFsKCk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsICdJTlZBTElEX0NPVU5URVJfVFlQRScsICdJbnZhbGlkIGNvdW50ZXIgdHlwZScpO1xuICB9XG59XG5cbi8qKlxuICogR0VUIC9hcGkvc3VwZXJhZG1pbi9vcmdhbml6YXRpb25zLzpvcmdJZC9tZXRob2QtY29uZmlnXG4gKiBMaXN0IGFsbCBtZXRob2QgY29uZmlncyBmb3IgdGhlIG9yZ1xuICovXG5tZXRob2RDb25maWdSb3V0ZXIuZ2V0KCcvJywgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBvcmdJZCB9ID0gcmVxLnBhcmFtcztcbiAgICBhd2FpdCB2ZXJpZnlPcmcob3JnSWQpO1xuXG4gICAgY29uc3QgY29uZmlncyA9IGF3YWl0IGdldEFsbE9yZ01ldGhvZENvbmZpZ3Mob3JnSWQpO1xuICAgIHJlcy5qc29uKGNvbmZpZ3MpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIG5leHQoZXJyb3IpO1xuICB9XG59KTtcblxuLyoqXG4gKiBHRVQgL2FwaS9zdXBlcmFkbWluL29yZ2FuaXphdGlvbnMvOm9yZ0lkL21ldGhvZC1jb25maWcvOmNvdW50ZXJUeXBlXG4gKiBHZXQgY29uZmlnIGZvciBzcGVjaWZpYyBjb3VudGVyIHR5cGVcbiAqL1xubWV0aG9kQ29uZmlnUm91dGVyLmdldCgnLzpjb3VudGVyVHlwZScsIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgb3JnSWQgfSA9IHJlcS5wYXJhbXM7XG4gICAgYXdhaXQgdmVyaWZ5T3JnKG9yZ0lkKTtcblxuICAgIGNvbnN0IGNvdW50ZXJUeXBlID0gQ291bnRSZWNvcmRUeXBlU2NoZW1hLnBhcnNlKHJlcS5wYXJhbXMuY291bnRlclR5cGUpO1xuICAgIGNvbnN0IGNvbmZpZyA9IGF3YWl0IGdldE9yZ01ldGhvZENvbmZpZyhvcmdJZCwgY291bnRlclR5cGUpO1xuICAgIHJlcy5qc29uKGNvbmZpZyk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbmV4dChlcnJvcik7XG4gIH1cbn0pO1xuXG4vKipcbiAqIFBVVCAvYXBpL3N1cGVyYWRtaW4vb3JnYW5pemF0aW9ucy86b3JnSWQvbWV0aG9kLWNvbmZpZy86Y291bnRlclR5cGVcbiAqIFVwZGF0ZSBjb25maWcgZm9yIHNwZWNpZmljIGNvdW50ZXIgdHlwZVxuICovXG5tZXRob2RDb25maWdSb3V0ZXIucHV0KCcvOmNvdW50ZXJUeXBlJywgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBvcmdJZCB9ID0gcmVxLnBhcmFtcztcbiAgICBhd2FpdCB2ZXJpZnlPcmcob3JnSWQpO1xuXG4gICAgY29uc3QgY291bnRlclR5cGUgPSBDb3VudFJlY29yZFR5cGVTY2hlbWEucGFyc2UocmVxLnBhcmFtcy5jb3VudGVyVHlwZSk7XG5cbiAgICAvLyBWYWxpZGF0ZSBjb25maWcgYmFzZWQgb24gY291bnRlciB0eXBlXG4gICAgY29uc3QgY29uZmlnU2NoZW1hID0gZ2V0Q29uZmlnU2NoZW1hKGNvdW50ZXJUeXBlKTtcbiAgICBjb25zdCBjb25maWcgPSBjb25maWdTY2hlbWEucGFyc2UocmVxLmJvZHkpO1xuXG4gICAgLy8gR2V0IGJlZm9yZSBzdGF0ZSBmb3IgYXVkaXRcbiAgICBjb25zdCBiZWZvcmUgPSBhd2FpdCBnZXRPcmdNZXRob2RDb25maWcob3JnSWQsIGNvdW50ZXJUeXBlKTtcblxuICAgIC8vIFVwZGF0ZSBjb25maWdcbiAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgdXBkYXRlT3JnTWV0aG9kQ29uZmlnKG9yZ0lkLCBjb3VudGVyVHlwZSwgY29uZmlnKTtcblxuICAgIC8vIEF1ZGl0IGxvZ1xuICAgIGF3YWl0IGF1ZGl0TG9nKHtcbiAgICAgIG9yZ0lkLFxuICAgICAgYWN0b3JVc2VySWQ6IHJlcS51c2VyIS5pZCxcbiAgICAgIGFjdGlvbjogJ3VwZGF0ZScsXG4gICAgICBlbnRpdHlUeXBlOiAnb3JnX21ldGhvZF9jb25maWcnLFxuICAgICAgZW50aXR5SWQ6IHVwZGF0ZWQuaWQsXG4gICAgICBtZXRhZGF0YToge1xuICAgICAgICBjb3VudGVyVHlwZSxcbiAgICAgICAgYmVmb3JlOiBiZWZvcmUuY29uZmlnLFxuICAgICAgICBhZnRlcjogY29uZmlnLFxuICAgICAgfSxcbiAgICAgIHJlcSxcbiAgICB9KTtcblxuICAgIC8vIFJldHVybiB1cGRhdGVkIGNvbmZpZyB3aXRoIGRlZmF1bHRzIG1lcmdlZFxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGdldE9yZ01ldGhvZENvbmZpZyhvcmdJZCwgY291bnRlclR5cGUpO1xuICAgIHJlcy5qc29uKHJlc3VsdCk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbmV4dChlcnJvcik7XG4gIH1cbn0pO1xuXG4vKipcbiAqIERFTEVURSAvYXBpL3N1cGVyYWRtaW4vb3JnYW5pemF0aW9ucy86b3JnSWQvbWV0aG9kLWNvbmZpZy86Y291bnRlclR5cGVcbiAqIFJlc2V0IGNvbmZpZyB0byBzeXN0ZW0gZGVmYXVsdHNcbiAqL1xubWV0aG9kQ29uZmlnUm91dGVyLmRlbGV0ZSgnLzpjb3VudGVyVHlwZScsIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgb3JnSWQgfSA9IHJlcS5wYXJhbXM7XG4gICAgYXdhaXQgdmVyaWZ5T3JnKG9yZ0lkKTtcblxuICAgIGNvbnN0IGNvdW50ZXJUeXBlID0gQ291bnRSZWNvcmRUeXBlU2NoZW1hLnBhcnNlKHJlcS5wYXJhbXMuY291bnRlclR5cGUpO1xuXG4gICAgLy8gR2V0IGJlZm9yZSBzdGF0ZSBmb3IgYXVkaXRcbiAgICBjb25zdCBiZWZvcmUgPSBhd2FpdCBnZXRPcmdNZXRob2RDb25maWcob3JnSWQsIGNvdW50ZXJUeXBlKTtcblxuICAgIC8vIERlbGV0ZSBjb25maWcgKHJlc2V0cyB0byBzeXN0ZW0gZGVmYXVsdHMpXG4gICAgYXdhaXQgcmVzZXRPcmdNZXRob2RDb25maWcob3JnSWQsIGNvdW50ZXJUeXBlKTtcblxuICAgIC8vIEF1ZGl0IGxvZ1xuICAgIGF3YWl0IGF1ZGl0TG9nKHtcbiAgICAgIG9yZ0lkLFxuICAgICAgYWN0b3JVc2VySWQ6IHJlcS51c2VyIS5pZCxcbiAgICAgIGFjdGlvbjogJ3Jlc2V0JyxcbiAgICAgIGVudGl0eVR5cGU6ICdvcmdfbWV0aG9kX2NvbmZpZycsXG4gICAgICBlbnRpdHlJZDogYCR7b3JnSWR9XyR7Y291bnRlclR5cGV9YCxcbiAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgIGNvdW50ZXJUeXBlLFxuICAgICAgICBiZWZvcmU6IGJlZm9yZS5jb25maWcsXG4gICAgICAgIHJlc2V0VG9EZWZhdWx0czogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICByZXEsXG4gICAgfSk7XG5cbiAgICAvLyBSZXR1cm4gY29uZmlnIChub3cgc2hvd2luZyBzeXN0ZW0gZGVmYXVsdHMpXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZ2V0T3JnTWV0aG9kQ29uZmlnKG9yZ0lkLCBjb3VudGVyVHlwZSk7XG4gICAgcmVzLmpzb24ocmVzdWx0KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBuZXh0KGVycm9yKTtcbiAgfVxufSk7XG4iXX0=