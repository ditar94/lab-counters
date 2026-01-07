"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.methodConfigRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const error_handler_1 = require("../middleware/error-handler");
const audit_1 = require("../services/audit");
const shared_1 = require("@lab-counters/shared");
const method_config_1 = require("../services/method-config");
exports.methodConfigRouter = (0, express_1.Router)();
// All routes require authentication and admin role
exports.methodConfigRouter.use(auth_1.authenticate);
exports.methodConfigRouter.use(auth_1.enforceOrgScope);
exports.methodConfigRouter.use((0, auth_1.authorize)('admin'));
/**
 * GET /api/method-config
 * List all method configs for the org
 */
exports.methodConfigRouter.get('/', async (req, res, next) => {
    try {
        const configs = await (0, method_config_1.getAllOrgMethodConfigs)(req.user.orgId);
        res.json(configs);
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/method-config/:counterType
 * Get config for specific counter type
 */
exports.methodConfigRouter.get('/:counterType', async (req, res, next) => {
    try {
        const counterType = shared_1.CountRecordTypeSchema.parse(req.params.counterType);
        const config = await (0, method_config_1.getOrgMethodConfig)(req.user.orgId, counterType);
        res.json(config);
    }
    catch (error) {
        next(error);
    }
});
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
 * PUT /api/method-config/:counterType
 * Update config for specific counter type
 */
exports.methodConfigRouter.put('/:counterType', async (req, res, next) => {
    try {
        const counterType = shared_1.CountRecordTypeSchema.parse(req.params.counterType);
        // Validate config based on counter type
        const configSchema = getConfigSchema(counterType);
        const config = configSchema.parse(req.body);
        // Get before state for audit
        const before = await (0, method_config_1.getOrgMethodConfig)(req.user.orgId, counterType);
        // Update config
        const updated = await (0, method_config_1.updateOrgMethodConfig)(req.user.orgId, counterType, config);
        // Audit log
        await (0, audit_1.auditLog)({
            orgId: req.user.orgId,
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
        const result = await (0, method_config_1.getOrgMethodConfig)(req.user.orgId, counterType);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
/**
 * DELETE /api/method-config/:counterType
 * Reset config to system defaults
 */
exports.methodConfigRouter.delete('/:counterType', async (req, res, next) => {
    try {
        const counterType = shared_1.CountRecordTypeSchema.parse(req.params.counterType);
        // Get before state for audit
        const before = await (0, method_config_1.getOrgMethodConfig)(req.user.orgId, counterType);
        // Delete config (resets to system defaults)
        await (0, method_config_1.resetOrgMethodConfig)(req.user.orgId, counterType);
        // Audit log
        await (0, audit_1.auditLog)({
            orgId: req.user.orgId,
            actorUserId: req.user.id,
            action: 'reset',
            entityType: 'org_method_config',
            entityId: `${req.user.orgId}_${counterType}`,
            metadata: {
                counterType,
                before: before.config,
                resetToDefaults: true,
            },
            req,
        });
        // Return config (now showing system defaults)
        const result = await (0, method_config_1.getOrgMethodConfig)(req.user.orgId, counterType);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0aG9kLWNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9yb3V0ZXMvbWV0aG9kLWNvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxQ0FBa0U7QUFDbEUsNkNBQThFO0FBQzlFLCtEQUF1RDtBQUN2RCw2Q0FBNkM7QUFDN0MsaURBTThCO0FBQzlCLDZEQUttQztBQUd0QixRQUFBLGtCQUFrQixHQUFHLElBQUEsZ0JBQU0sR0FBRSxDQUFDO0FBRTNDLG1EQUFtRDtBQUNuRCwwQkFBa0IsQ0FBQyxHQUFHLENBQUMsbUJBQVksQ0FBQyxDQUFDO0FBQ3JDLDBCQUFrQixDQUFDLEdBQUcsQ0FBQyxzQkFBZSxDQUFDLENBQUM7QUFDeEMsMEJBQWtCLENBQUMsR0FBRyxDQUFDLElBQUEsZ0JBQVMsRUFBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBRTNDOzs7R0FHRztBQUNILDBCQUFrQixDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLEdBQVksRUFBRSxHQUFhLEVBQUUsSUFBa0IsRUFBRSxFQUFFO0lBQ3BGLElBQUksQ0FBQztRQUNILE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBQSxzQ0FBc0IsRUFBQyxHQUFHLENBQUMsSUFBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzlELEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDcEIsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDZCxDQUFDO0FBQ0gsQ0FBQyxDQUFDLENBQUM7QUFFSDs7O0dBR0c7QUFDSCwwQkFBa0IsQ0FBQyxHQUFHLENBQUMsZUFBZSxFQUFFLEtBQUssRUFBRSxHQUFZLEVBQUUsR0FBYSxFQUFFLElBQWtCLEVBQUUsRUFBRTtJQUNoRyxJQUFJLENBQUM7UUFDSCxNQUFNLFdBQVcsR0FBRyw4QkFBcUIsQ0FBQyxLQUFLLENBQUMsR0FBRyxD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IH0gZnJvbSAnZXhwcmVzcyc7XG5pbXBvcnQgeyBhdXRoZW50aWNhdGUsIGF1dGhvcml6ZSwgZW5mb3JjZU9yZ1Njb3BlIH0gZnJvbSAnLi4vbWlkZGxld2FyZS9hdXRoJztcbmltcG9ydCB7IEFwcEVycm9yIH0gZnJvbSAnLi4vbWlkZGxld2FyZS9lcnJvci1oYW5kbGVyJztcbmltcG9ydCB7IGF1ZGl0TG9nIH0gZnJvbSAnLi4vc2VydmljZXMvYXVkaXQnO1xuaW1wb3J0IHtcbiAgQ291bnRSZWNvcmRUeXBlU2NoZW1hLFxuICBIZW1vY3l0b21ldGVyTWV0aG9kUGFyYW1zU2NoZW1hLFxuICBGZXRhbE1ldGhvZFBhcmFtc1NjaGVtYSxcbiAgUmV0aWNNZXRob2RQYXJhbXNTY2hlbWEsXG4gIFBhcmFzaXRlTWV0aG9kUGFyYW1zU2NoZW1hLFxufSBmcm9tICdAbGFiLWNvdW50ZXJzL3NoYXJlZCc7XG5pbXBvcnQge1xuICBnZXRBbGxPcmdNZXRob2RDb25maWdzLFxuICBnZXRPcmdNZXRob2RDb25maWcsXG4gIHVwZGF0ZU9yZ01ldGhvZENvbmZpZyxcbiAgcmVzZXRPcmdNZXRob2RDb25maWcsXG59IGZyb20gJy4uL3NlcnZpY2VzL21ldGhvZC1jb25maWcnO1xuaW1wb3J0IHR5cGUgeyBDb3VudFJlY29yZFR5cGUgfSBmcm9tICdAbGFiLWNvdW50ZXJzL3NoYXJlZCc7XG5cbmV4cG9ydCBjb25zdCBtZXRob2RDb25maWdSb3V0ZXIgPSBSb3V0ZXIoKTtcblxuLy8gQWxsIHJvdXRlcyByZXF1aXJlIGF1dGhlbnRpY2F0aW9uIGFuZCBhZG1pbiByb2xlXG5tZXRob2RDb25maWdSb3V0ZXIudXNlKGF1dGhlbnRpY2F0ZSk7XG5tZXRob2RDb25maWdSb3V0ZXIudXNlKGVuZm9yY2VPcmdTY29wZSk7XG5tZXRob2RDb25maWdSb3V0ZXIudXNlKGF1dGhvcml6ZSgnYWRtaW4nKSk7XG5cbi8qKlxuICogR0VUIC9hcGkvbWV0aG9kLWNvbmZpZ1xuICogTGlzdCBhbGwgbWV0aG9kIGNvbmZpZ3MgZm9yIHRoZSBvcmdcbiAqL1xubWV0aG9kQ29uZmlnUm91dGVyLmdldCgnLycsIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGNvbmZpZ3MgPSBhd2FpdCBnZXRBbGxPcmdNZXRob2RDb25maWdzKHJlcS51c2VyIS5vcmdJZCk7XG4gICAgcmVzLmpzb24oY29uZmlncyk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbmV4dChlcnJvcik7XG4gIH1cbn0pO1xuXG4vKipcbiAqIEdFVCAvYXBpL21ldGhvZC1jb25maWcvOmNvdW50ZXJUeXBlXG4gKiBHZXQgY29uZmlnIGZvciBzcGVjaWZpYyBjb3VudGVyIHR5cGVcbiAqL1xubWV0aG9kQ29uZmlnUm91dGVyLmdldCgnLzpjb3VudGVyVHlwZScsIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGNvdW50ZXJUeXBlID0gQ291bnRSZWNvcmRUeXBlU2NoZW1hLnBhcnNlKHJlcS5wYXJhbXMuY291bnRlclR5cGUpO1xuICAgIGNvbnN0IGNvbmZpZyA9IGF3YWl0IGdldE9yZ01ldGhvZENvbmZpZyhyZXEudXNlciEub3JnSWQsIGNvdW50ZXJUeXBlKTtcbiAgICByZXMuanNvbihjb25maWcpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIG5leHQoZXJyb3IpO1xuICB9XG59KTtcblxuLyoqXG4gKiBHZXQgdGhlIGFwcHJvcHJpYXRlIHNjaGVtYSBmb3IgdmFsaWRhdGluZyBjb25maWcgYmFzZWQgb24gY291bnRlciB0eXBlXG4gKi9cbmZ1bmN0aW9uIGdldENvbmZpZ1NjaGVtYShjb3VudGVyVHlwZTogQ291bnRSZWNvcmRUeXBlKSB7XG4gIHN3aXRjaCAoY291bnRlclR5cGUpIHtcbiAgICBjYXNlICdoZW1vY3l0b21ldGVyJzpcbiAgICAgIHJldHVybiBIZW1vY3l0b21ldGVyTWV0aG9kUGFyYW1zU2NoZW1hLnBhcnRpYWwoKTtcbiAgICBjYXNlICdmZXRhbCc6XG4gICAgICByZXR1cm4gRmV0YWxNZXRob2RQYXJhbXNTY2hlbWEucGFydGlhbCgpO1xuICAgIGNhc2UgJ3JldGljJzpcbiAgICAgIHJldHVybiBSZXRpY01ldGhvZFBhcmFtc1NjaGVtYS5wYXJ0aWFsKCk7XG4gICAgY2FzZSAncGFyYXNpdGUnOlxuICAgICAgcmV0dXJuIFBhcmFzaXRlTWV0aG9kUGFyYW1zU2NoZW1hLnBhcnRpYWwoKTtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgJ0lOVkFMSURfQ09VTlRFUl9UWVBFJywgJ0ludmFsaWQgY291bnRlciB0eXBlJyk7XG4gIH1cbn1cblxuLyoqXG4gKiBQVVQgL2FwaS9tZXRob2QtY29uZmlnLzpjb3VudGVyVHlwZVxuICogVXBkYXRlIGNvbmZpZyBmb3Igc3BlY2lmaWMgY291bnRlciB0eXBlXG4gKi9cbm1ldGhvZENvbmZpZ1JvdXRlci5wdXQoJy86Y291bnRlclR5cGUnLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBjb3VudGVyVHlwZSA9IENvdW50UmVjb3JkVHlwZVNjaGVtYS5wYXJzZShyZXEucGFyYW1zLmNvdW50ZXJUeXBlKTtcblxuICAgIC8vIFZhbGlkYXRlIGNvbmZpZyBiYXNlZCBvbiBjb3VudGVyIHR5cGVcbiAgICBjb25zdCBjb25maWdTY2hlbWEgPSBnZXRDb25maWdTY2hlbWEoY291bnRlclR5cGUpO1xuICAgIGNvbnN0IGNvbmZpZyA9IGNvbmZpZ1NjaGVtYS5wYXJzZShyZXEuYm9keSk7XG5cbiAgICAvLyBHZXQgYmVmb3JlIHN0YXRlIGZvciBhdWRpdFxuICAgIGNvbnN0IGJlZm9yZSA9IGF3YWl0IGdldE9yZ01ldGhvZENvbmZpZyhyZXEudXNlciEub3JnSWQsIGNvdW50ZXJUeXBlKTtcblxuICAgIC8vIFVwZGF0ZSBjb25maWdcbiAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgdXBkYXRlT3JnTWV0aG9kQ29uZmlnKHJlcS51c2VyIS5vcmdJZCwgY291bnRlclR5cGUsIGNvbmZpZyk7XG5cbiAgICAvLyBBdWRpdCBsb2dcbiAgICBhd2FpdCBhdWRpdExvZyh7XG4gICAgICBvcmdJZDogcmVxLnVzZXIhLm9yZ0lkLFxuICAgICAgYWN0b3JVc2VySWQ6IHJlcS51c2VyIS5pZCxcbiAgICAgIGFjdGlvbjogJ3VwZGF0ZScsXG4gICAgICBlbnRpdHlUeXBlOiAnb3JnX21ldGhvZF9jb25maWcnLFxuICAgICAgZW50aXR5SWQ6IHVwZGF0ZWQuaWQsXG4gICAgICBtZXRhZGF0YToge1xuICAgICAgICBjb3VudGVyVHlwZSxcbiAgICAgICAgYmVmb3JlOiBiZWZvcmUuY29uZmlnLFxuICAgICAgICBhZnRlcjogY29uZmlnLFxuICAgICAgfSxcbiAgICAgIHJlcSxcbiAgICB9KTtcblxuICAgIC8vIFJldHVybiB1cGRhdGVkIGNvbmZpZyB3aXRoIGRlZmF1bHRzIG1lcmdlZFxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGdldE9yZ01ldGhvZENvbmZpZyhyZXEudXNlciEub3JnSWQsIGNvdW50ZXJUeXBlKTtcbiAgICByZXMuanNvbihyZXN1bHQpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIG5leHQoZXJyb3IpO1xuICB9XG59KTtcblxuLyoqXG4gKiBERUxFVEUgL2FwaS9tZXRob2QtY29uZmlnLzpjb3VudGVyVHlwZVxuICogUmVzZXQgY29uZmlnIHRvIHN5c3RlbSBkZWZhdWx0c1xuICovXG5tZXRob2RDb25maWdSb3V0ZXIuZGVsZXRlKCcvOmNvdW50ZXJUeXBlJywgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgY291bnRlclR5cGUgPSBDb3VudFJlY29yZFR5cGVTY2hlbWEucGFyc2UocmVxLnBhcmFtcy5jb3VudGVyVHlwZSk7XG5cbiAgICAvLyBHZXQgYmVmb3JlIHN0YXRlIGZvciBhdWRpdFxuICAgIGNvbnN0IGJlZm9yZSA9IGF3YWl0IGdldE9yZ01ldGhvZENvbmZpZyhyZXEudXNlciEub3JnSWQsIGNvdW50ZXJUeXBlKTtcblxuICAgIC8vIERlbGV0ZSBjb25maWcgKHJlc2V0cyB0byBzeXN0ZW0gZGVmYXVsdHMpXG4gICAgYXdhaXQgcmVzZXRPcmdNZXRob2RDb25maWcocmVxLnVzZXIhLm9yZ0lkLCBjb3VudGVyVHlwZSk7XG5cbiAgICAvLyBBdWRpdCBsb2dcbiAgICBhd2FpdCBhdWRpdExvZyh7XG4gICAgICBvcmdJZDogcmVxLnVzZXIhLm9yZ0lkLFxuICAgICAgYWN0b3JVc2VySWQ6IHJlcS51c2VyIS5pZCxcbiAgICAgIGFjdGlvbjogJ3Jlc2V0JyxcbiAgICAgIGVudGl0eVR5cGU6ICdvcmdfbWV0aG9kX2NvbmZpZycsXG4gICAgICBlbnRpdHlJZDogYCR7cmVxLnVzZXIhLm9yZ0lkfV8ke2NvdW50ZXJUeXBlfWAsXG4gICAgICBtZXRhZGF0YToge1xuICAgICAgICBjb3VudGVyVHlwZSxcbiAgICAgICAgYmVmb3JlOiBiZWZvcmUuY29uZmlnLFxuICAgICAgICByZXNldFRvRGVmYXVsdHM6IHRydWUsXG4gICAgICB9LFxuICAgICAgcmVxLFxuICAgIH0pO1xuXG4gICAgLy8gUmV0dXJuIGNvbmZpZyAobm93IHNob3dpbmcgc3lzdGVtIGRlZmF1bHRzKVxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGdldE9yZ01ldGhvZENvbmZpZyhyZXEudXNlciEub3JnSWQsIGNvdW50ZXJUeXBlKTtcbiAgICByZXMuanNvbihyZXN1bHQpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIG5leHQoZXJyb3IpO1xuICB9XG59KTtcbiJdfQ==