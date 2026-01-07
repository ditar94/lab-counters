"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordsRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const error_handler_1 = require("../middleware/error-handler");
const security_1 = require("../middleware/security");
const audit_1 = require("../services/audit");
const method_config_1 = require("../services/method-config");
const shared_1 = require("@lab-counters/shared");
const calculations_1 = require("../services/calculations");
exports.recordsRouter = (0, express_1.Router)();
// All routes require authentication
exports.recordsRouter.use(auth_1.authenticate);
exports.recordsRouter.use(auth_1.enforceOrgScope);
// List records (with filtering and pagination)
exports.recordsRouter.get('/', async (req, res, next) => {
    try {
        const filters = shared_1.RecordFilterSchema.parse(req.query);
        const { page, pageSize, type, status, specimenId, startDate, endDate, performedBy, siteId, month, year } = filters;
        // Technologists only see records from their current site
        // Other roles can see all records in the org (optionally filtered by site)
        const siteFilter = req.user.role === 'technologist'
            ? { siteId: req.user.siteId }
            : siteId
                ? { siteId }
                : {};
        // Build date filter for month/year
        let dateFilter = {};
        if (month && year) {
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
            dateFilter = { createdAt: { gte: monthStart, lte: monthEnd } };
        }
        else if (year) {
            const yearStart = new Date(year, 0, 1);
            const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
            dateFilter = { createdAt: { gte: yearStart, lte: yearEnd } };
        }
        else if (month) {
            // Month without year - use current year
            const currentYear = new Date().getFullYear();
            const monthStart = new Date(currentYear, month - 1, 1);
            const monthEnd = new Date(currentYear, month, 0, 23, 59, 59, 999);
            dateFilter = { createdAt: { gte: monthStart, lte: monthEnd } };
        }
        const where = {
            orgId: req.user.orgId,
            ...siteFilter,
            ...(type && { type }),
            ...(status && { status }),
            ...(specimenId && { specimenId: { contains: specimenId } }),
            ...(startDate && !month && !year && { createdAt: { gte: startDate } }),
            ...(endDate && !month && !year && { createdAt: { lte: endDate } }),
            ...dateFilter,
            ...(performedBy && { performedById: performedBy }),
        };
        const [records, total] = await Promise.all([
            prisma_1.prisma.manualCountRecord.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
                include: {
                    site: { select: { id: true, name: true } },
                    performedBy: { select: { id: true, name: true } },
                    verifiedBy: { select: { id: true, name: true } },
                },
            }),
            prisma_1.prisma.manualCountRecord.count({ where }),
        ]);
        res.json({
            data: records,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        });
    }
    catch (error) {
        next(error);
    }
});
// Get overdue pending records (pending for more than 24 hours, non-QC only)
// For supervisors/admins to see records needing attention
exports.recordsRouter.get('/alerts/overdue', (0, auth_1.authorize)('supervisor', 'admin'), async (req, res, next) => {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        // Get sites user has access to by querying UserSite table
        const userSites = await prisma_1.prisma.userSite.findMany({
            where: { userId: req.user.id },
            select: { siteId: true },
        });
        const userSiteIds = userSites.map((us) => us.siteId);
        // If user has no site assignments, return empty result
        if (userSiteIds.length === 0) {
            res.json({ count: 0, records: [] });
            return;
        }
        const overdueRecords = await prisma_1.prisma.manualCountRecord.findMany({
            where: {
                orgId: req.user.orgId,
                siteId: { in: userSiteIds },
                status: 'pending_verification',
                isQC: false,
                performedAt: { lt: twentyFourHoursAgo },
            },
            select: {
                id: true,
                specimenId: true,
                type: true,
                performedAt: true,
                site: { select: { id: true, name: true } },
                performedBy: { select: { id: true, name: true } },
            },
            orderBy: { performedAt: 'asc' },
            take: 50, // Limit to prevent huge responses
        });
        res.json({
            count: overdueRecords.length,
            records: overdueRecords,
        });
    }
    catch (error) {
        next(error);
    }
});
// Get single record
exports.recordsRouter.get('/:id', async (req, res, next) => {
    try {
        const record = await prisma_1.prisma.manualCountRecord.findFirst({
            where: {
                id: req.params.id,
                orgId: req.user.orgId,
            },
            include: {
                site: { select: { id: true, name: true } },
                performedBy: { select: { id: true, name: true, email: true } },
                verifiedBy: { select: { id: true, name: true, email: true } },
            },
        });
        if (!record) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'Record not found');
        }
        res.json(record);
    }
    catch (error) {
        next(error);
    }
});
// Create new record
exports.recordsRouter.post('/', async (req, res, next) => {
    try {
        const body = shared_1.CreateRecordRequestSchema.parse(req.body);
        const calculations = (0, calculations_1.calculateResults)(body.type, body.rawTallies);
        // Capture method params snapshot for historical accuracy
        const paramsSnapshot = await (0, method_config_1.createParamsSnapshot)(req.user.orgId, body.type);
        const record = await prisma_1.prisma.manualCountRecord.create({
            data: {
                orgId: req.user.orgId,
                siteId: req.user.siteId,
                type: body.type,
                specimenId: body.specimenId,
                fluidType: body.fluidType,
                dilution: body.dilution,
                squaresCounted: body.squaresCounted,
                isQC: body.isQC ?? false,
                status: 'draft',
                rawTallies: body.rawTallies,
                calculations: calculations,
                methodVersion: shared_1.CURRENT_METHOD_VERSION,
                paramsSnapshot: paramsSnapshot,
                performedById: req.user.id,
            },
            include: {
                site: { select: { id: true, name: true } },
                performedBy: { select: { id: true, name: true } },
            },
        });
        await (0, audit_1.auditLog)({
            orgId: req.user.orgId,
            entityType: 'manual_count_record',
            entityId: record.id,
            action: 'create',
            metadata: { record },
            actorUserId: req.user.id,
            req,
        });
        res.status(201).json(record);
    }
    catch (error) {
        next(error);
    }
});
// Update record (only drafts can be updated)
exports.recordsRouter.patch('/:id', async (req, res, next) => {
    try {
        const body = shared_1.UpdateRecordRequestSchema.parse(req.body);
        const existing = await prisma_1.prisma.manualCountRecord.findFirst({
            where: {
                id: req.params.id,
                orgId: req.user.orgId,
            },
        });
        if (!existing) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'Record not found');
        }
        if (existing.status !== 'draft') {
            throw new error_handler_1.AppError(400, 'INVALID_STATUS', 'Only draft records can be updated');
        }
        const updateData = {};
        if (body.rawTallies) {
            updateData.rawTallies = body.rawTallies;
            updateData.calculations = (0, calculations_1.calculateResults)(existing.type, body.rawTallies);
        }
        if (body.status) {
            updateData.status = body.status;
        }
        const record = await prisma_1.prisma.manualCountRecord.update({
            where: { id: req.params.id },
            data: updateData,
            include: {
                performedBy: { select: { id: true, name: true } },
            },
        });
        await (0, audit_1.auditLog)({
            orgId: req.user.orgId,
            entityType: 'manual_count_record',
            entityId: record.id,
            action: 'update',
            metadata: { before: existing, after: record },
            actorUserId: req.user.id,
            req,
        });
        res.json(record);
    }
    catch (error) {
        next(error);
    }
});
// Submit for verification (QC records auto-verify)
exports.recordsRouter.post('/:id/submit', async (req, res, next) => {
    try {
        const body = shared_1.SubmitRecordRequestSchema.parse(req.body);
        const existing = await prisma_1.prisma.manualCountRecord.findFirst({
            where: {
                id: req.params.id,
                orgId: req.user.orgId,
            },
        });
        if (!existing) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'Record not found');
        }
        if (existing.status !== 'draft') {
            throw new error_handler_1.AppError(400, 'INVALID_STATUS', 'Only draft records can be submitted');
        }
        // QC records auto-verify (no peer review needed)
        const isQC = existing.isQC;
        const newStatus = isQC ? 'verified' : 'pending_verification';
        const record = await prisma_1.prisma.manualCountRecord.update({
            where: { id: req.params.id },
            data: {
                status: newStatus,
                performerAttestation: body.performerAttestation,
                performerAttestedAt: new Date(),
                ...(isQC && {
                    verifiedById: req.user.id,
                    verifiedAt: new Date(),
                }),
            },
        });
        await (0, audit_1.auditLog)({
            orgId: req.user.orgId,
            entityType: 'manual_count_record',
            entityId: record.id,
            action: isQC ? 'submit_qc_auto_verified' : 'submit_pending',
            metadata: { statusBefore: existing.status, statusAfter: record.status, isQC, performerAttestation: body.performerAttestation },
            actorUserId: req.user.id,
            req,
        });
        res.json(record);
    }
    catch (error) {
        next(error);
    }
});
// Verify record (technologists, supervisors, and admins can verify others' records)
// Apply strict rate limiting to prevent abuse
exports.recordsRouter.post('/:id/verify', security_1.sensitiveRateLimiter, (0, auth_1.authorize)('technologist', 'supervisor', 'admin'), async (req, res, next) => {
    try {
        const body = shared_1.VerifyRecordRequestSchema.parse(req.body);
        const existing = await prisma_1.prisma.manualCountRecord.findFirst({
            where: {
                id: req.params.id,
                orgId: req.user.orgId,
            },
        });
        if (!existing) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'Record not found');
        }
        if (existing.status !== 'pending_verification') {
            throw new error_handler_1.AppError(400, 'INVALID_STATUS', 'Only pending records can be verified');
        }
        // Self-verification is never allowed - a different user must verify
        if (existing.performedById === req.user.id) {
            throw new error_handler_1.AppError(403, 'SELF_VERIFICATION_NOT_ALLOWED', 'You cannot verify your own records');
        }
        const record = await prisma_1.prisma.manualCountRecord.update({
            where: { id: req.params.id },
            data: {
                status: 'verified',
                verifiedById: req.user.id,
                verifiedAt: new Date(),
                verifierAttestation: body.verifierAttestation,
            },
            include: {
                performedBy: { select: { id: true, name: true } },
                verifiedBy: { select: { id: true, name: true } },
            },
        });
        await (0, audit_1.auditLog)({
            orgId: req.user.orgId,
            entityType: 'manual_count_record',
            entityId: record.id,
            action: 'verify',
            metadata: { statusBefore: existing.status, statusAfter: record.status, verifiedById: record.verifiedById, verifierAttestation: body.verifierAttestation },
            actorUserId: req.user.id,
            req,
        });
        res.json(record);
    }
    catch (error) {
        next(error);
    }
});
// Delete record (only drafts, admins only)
exports.recordsRouter.delete('/:id', (0, auth_1.authorize)('admin'), async (req, res, next) => {
    try {
        const existing = await prisma_1.prisma.manualCountRecord.findFirst({
            where: {
                id: req.params.id,
                orgId: req.user.orgId,
            },
        });
        if (!existing) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'Record not found');
        }
        if (existing.status !== 'draft') {
            throw new error_handler_1.AppError(400, 'INVALID_STATUS', 'Only draft records can be deleted');
        }
        await prisma_1.prisma.manualCountRecord.delete({
            where: { id: req.params.id },
        });
        await (0, audit_1.auditLog)({
            orgId: req.user.orgId,
            entityType: 'manual_count_record',
            entityId: req.params.id,
            action: 'delete',
            metadata: { record: existing },
            actorUserId: req.user.id,
            req,
        });
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
// Amend/correct a verified record (updates in place, no new version)
// Supervisors/admins can amend any record, technologists can only amend their own
// Status changes to 'corrected', changes are logged to audit trail
exports.recordsRouter.post('/:id/amend', security_1.sensitiveRateLimiter, (0, auth_1.authorize)('technologist', 'supervisor', 'admin'), async (req, res, next) => {
    try {
        const body = shared_1.CreateCorrectionRequestSchema.parse(req.body);
        const existing = await prisma_1.prisma.manualCountRecord.findFirst({
            where: {
                id: req.params.id,
                orgId: req.user.orgId,
            },
            include: {
                performedBy: { select: { id: true, name: true } },
                verifiedBy: { select: { id: true, name: true } },
            },
        });
        if (!existing) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'Record not found');
        }
        // Allow amending verified or already-corrected records
        if (existing.status !== 'verified' && existing.status !== 'corrected') {
            throw new error_handler_1.AppError(400, 'INVALID_STATUS', 'Only verified or corrected records can be amended');
        }
        // Check permission: technologists can only amend their own records
        const isOwnRecord = existing.performedById === req.user.id;
        const isSupervisorOrAdmin = req.user.role === 'supervisor' || req.user.role === 'admin';
        if (!isOwnRecord && !isSupervisorOrAdmin) {
            throw new error_handler_1.AppError(403, 'FORBIDDEN', 'You can only amend your own records');
        }
        // Track what changed for the audit log
        const changes = {};
        // Determine what's being changed
        const rawTalliesToUse = body.rawTallies ?? existing.rawTallies;
        const talliesChanged = body.rawTallies !== undefined &&
            JSON.stringify(body.rawTallies) !== JSON.stringify(existing.rawTallies);
        if (talliesChanged) {
            changes.rawTallies = { before: existing.rawTallies, after: body.rawTallies };
            // Note: calculations is a derived field, not tracked separately in changedFields
        }
        if (body.specimenId && body.specimenId !== existing.specimenId) {
            changes.specimenId = { before: existing.specimenId, after: body.specimenId };
        }
        if (body.performedAt) {
            const newPerformedAt = new Date(body.performedAt);
            if (newPerformedAt.getTime() !== existing.performedAt.getTime()) {
                changes.performedAt = { before: existing.performedAt, after: newPerformedAt };
            }
        }
        // Must have at least one change
        if (Object.keys(changes).length === 0) {
            throw new error_handler_1.AppError(400, 'NO_CHANGES', 'No changes were made to the record');
        }
        // Build update data
        const updateData = {
            status: 'corrected',
            correctionReason: body.reason,
        };
        if (talliesChanged && body.rawTallies) {
            updateData.rawTallies = body.rawTallies;
            updateData.calculations = (0, calculations_1.calculateResults)(existing.type, body.rawTallies);
        }
        if (body.specimenId) {
            updateData.specimenId = body.specimenId;
        }
        if (body.performedAt) {
            updateData.performedAt = new Date(body.performedAt);
        }
        // Update the record in place
        const updatedRecord = await prisma_1.prisma.manualCountRecord.update({
            where: { id: req.params.id },
            data: updateData,
            include: {
                site: { select: { id: true, name: true } },
                performedBy: { select: { id: true, name: true } },
                verifiedBy: { select: { id: true, name: true } },
            },
        });
        // Log detailed changes to audit trail
        await (0, audit_1.auditLog)({
            orgId: req.user.orgId,
            entityType: 'manual_count_record',
            entityId: updatedRecord.id,
            action: 'amend',
            metadata: {
                correctionReason: body.reason,
                changes,
                changedFields: Object.keys(changes),
            },
            actorUserId: req.user.id,
            req,
        });
        res.json(updatedRecord);
    }
    catch (error) {
        next(error);
    }
});
// Get audit log for a record
// Returns all audit events related to this record
exports.recordsRouter.get('/:id/audit', async (req, res, next) => {
    try {
        const record = await prisma_1.prisma.manualCountRecord.findFirst({
            where: {
                id: req.params.id,
                orgId: req.user.orgId,
            },
        });
        if (!record) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'Record not found');
        }
        // Get all audit events for this record
        const auditEvents = await prisma_1.prisma.auditEvent.findMany({
            where: {
                entityType: 'manual_count_record',
                entityId: req.params.id,
                orgId: req.user.orgId,
            },
            include: {
                actor: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        // Format the audit events for display
        const events = auditEvents.map((event) => ({
            id: event.id,
            action: event.action,
            createdAt: event.createdAt,
            actor: event.actor,
            metadata: event.metadata,
        }));
        res.json({ events });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjb3Jkcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9yb3V0ZXMvcmVjb3Jkcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxQ0FBa0U7QUFDbEUsMENBQXVDO0FBQ3ZDLDZDQUE4RTtBQUM5RSwrREFBdUQ7QUFDdkQscURBQThEO0FBQzlELDZDQUE2QztBQUM3Qyw2REFBaUU7QUFDakUsaURBUThCO0FBQzlCLDJEQUE0RDtBQUUvQyxRQUFBLGFBQWEsR0FBRyxJQUFBLGdCQUFNLEdBQUUsQ0FBQztBQUV0QyxvQ0FBb0M7QUFDcEMscUJBQWEsQ0FBQyxHQUFHLENBQUMsbUJBQVksQ0FBQyxDQUFDO0FBQ2hDLHFCQUFhLENBQUMsR0FBRyxDQUFDLHNCQUFlLENBQUMsQ0FBQztBQUVuQywrQ0FBK0M7QUFDL0MscUJBQWEsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxHQUFZLEVBQUUsR0FBYSxFQUFFLElBQWtCLEVBQUUsRUFBRTtJQUMvRSxJQUFJLENBQUM7UUFDSCxNQUFNLE9BQU8sR0FBRywyQkFBa0IsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3BELE1BQU0sRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEdBQUcsT0FBTyxDQUFDO1FBRW5ILHlEQUF5RDtRQUN6RCwyRUFBMkU7UUFDM0UsTUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDLElBQUssQ0FBQyxJQUFJLEtBQUssY0FBYztZQUNsRCxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsR0FBRyxDQUFDLElBQUssQ0FBQyxNQUFNLEVBQUU7WUFDOUIsQ0FBQyxDQUFDLE1BQU07Z0JBQ04sQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFO2dCQUNaLENBQUMs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b25zZSwgTmV4dEZ1bmN0aW9uIH0gZnJvbSAnZXhwcmVzcyc7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tICcuLi9saWIvcHJpc21hJztcbmltcG9ydCB7IGF1dGhlbnRpY2F0ZSwgYXV0aG9yaXplLCBlbmZvcmNlT3JnU2NvcGUgfSBmcm9tICcuLi9taWRkbGV3YXJlL2F1dGgnO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tICcuLi9taWRkbGV3YXJlL2Vycm9yLWhhbmRsZXInO1xuaW1wb3J0IHsgc2Vuc2l0aXZlUmF0ZUxpbWl0ZXIgfSBmcm9tICcuLi9taWRkbGV3YXJlL3NlY3VyaXR5JztcbmltcG9ydCB7IGF1ZGl0TG9nIH0gZnJvbSAnLi4vc2VydmljZXMvYXVkaXQnO1xuaW1wb3J0IHsgY3JlYXRlUGFyYW1zU25hcHNob3QgfSBmcm9tICcuLi9zZXJ2aWNlcy9tZXRob2QtY29uZmlnJztcbmltcG9ydCB7XG4gIENyZWF0ZVJlY29yZFJlcXVlc3RTY2hlbWEsXG4gIFVwZGF0ZVJlY29yZFJlcXVlc3RTY2hlbWEsXG4gIFN1Ym1pdFJlY29yZFJlcXVlc3RTY2hlbWEsXG4gIFZlcmlmeVJlY29yZFJlcXVlc3RTY2hlbWEsXG4gIENyZWF0ZUNvcnJlY3Rpb25SZXF1ZXN0U2NoZW1hLFxuICBSZWNvcmRGaWx0ZXJTY2hlbWEsXG4gIENVUlJFTlRfTUVUSE9EX1ZFUlNJT04sXG59IGZyb20gJ0BsYWItY291bnRlcnMvc2hhcmVkJztcbmltcG9ydCB7IGNhbGN1bGF0ZVJlc3VsdHMgfSBmcm9tICcuLi9zZXJ2aWNlcy9jYWxjdWxhdGlvbnMnO1xuXG5leHBvcnQgY29uc3QgcmVjb3Jkc1JvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBBbGwgcm91dGVzIHJlcXVpcmUgYXV0aGVudGljYXRpb25cbnJlY29yZHNSb3V0ZXIudXNlKGF1dGhlbnRpY2F0ZSk7XG5yZWNvcmRzUm91dGVyLnVzZShlbmZvcmNlT3JnU2NvcGUpO1xuXG4vLyBMaXN0IHJlY29yZHMgKHdpdGggZmlsdGVyaW5nIGFuZCBwYWdpbmF0aW9uKVxucmVjb3Jkc1JvdXRlci5nZXQoJy8nLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBmaWx0ZXJzID0gUmVjb3JkRmlsdGVyU2NoZW1hLnBhcnNlKHJlcS5xdWVyeSk7XG4gICAgY29uc3QgeyBwYWdlLCBwYWdlU2l6ZSwgdHlwZSwgc3RhdHVzLCBzcGVjaW1lbklkLCBzdGFydERhdGUsIGVuZERhdGUsIHBlcmZvcm1lZEJ5LCBzaXRlSWQsIG1vbnRoLCB5ZWFyIH0gPSBmaWx0ZXJzO1xuXG4gICAgLy8gVGVjaG5vbG9naXN0cyBvbmx5IHNlZSByZWNvcmRzIGZyb20gdGhlaXIgY3VycmVudCBzaXRlXG4gICAgLy8gT3RoZXIgcm9sZXMgY2FuIHNlZSBhbGwgcmVjb3JkcyBpbiB0aGUgb3JnIChvcHRpb25hbGx5IGZpbHRlcmVkIGJ5IHNpdGUpXG4gICAgY29uc3Qgc2l0ZUZpbHRlciA9IHJlcS51c2VyIS5yb2xlID09PSAndGVjaG5vbG9naXN0J1xuICAgICAgPyB7IHNpdGVJZDogcmVxLnVzZXIhLnNpdGVJZCB9XG4gICAgICA6IHNpdGVJZFxuICAgICAgICA/IHsgc2l0ZUlkIH1cbiAgICAgICAgOiB7fTtcblxuICAgIC8vIEJ1aWxkIGRhdGUgZmlsdGVyIGZvciBtb250aC95ZWFyXG4gICAgbGV0IGRhdGVGaWx0ZXIgPSB7fTtcbiAgICBpZiAobW9udGggJiYgeWVhcikge1xuICAgICAgY29uc3QgbW9udGhTdGFydCA9IG5ldyBEYXRlKHllYXIsIG1vbnRoIC0gMSwgMSk7XG4gICAgICBjb25zdCBtb250aEVuZCA9IG5ldyBEYXRlKHllYXIsIG1vbnRoLCAwLCAyMywgNTksIDU5LCA5OTkpO1xuICAgICAgZGF0ZUZpbHRlciA9IHsgY3JlYXRlZEF0OiB7IGd0ZTogbW9udGhTdGFydCwgbHRlOiBtb250aEVuZCB9IH07XG4gICAgfSBlbHNlIGlmICh5ZWFyKSB7XG4gICAgICBjb25zdCB5ZWFyU3RhcnQgPSBuZXcgRGF0ZSh5ZWFyLCAwLCAxKTtcbiAgICAgIGNvbnN0IHllYXJFbmQgPSBuZXcgRGF0ZSh5ZWFyLCAxMSwgMzEsIDIzLCA1OSwgNTksIDk5OSk7XG4gICAgICBkYXRlRmlsdGVyID0geyBjcmVhdGVkQXQ6IHsgZ3RlOiB5ZWFyU3RhcnQsIGx0ZTogeWVhckVuZCB9IH07XG4gICAgfSBlbHNlIGlmIChtb250aCkge1xuICAgICAgLy8gTW9udGggd2l0aG91dCB5ZWFyIC0gdXNlIGN1cnJlbnQgeWVhclxuICAgICAgY29uc3QgY3VycmVudFllYXIgPSBuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCk7XG4gICAgICBjb25zdCBtb250aFN0YXJ0ID0gbmV3IERhdGUoY3VycmVudFllYXIsIG1vbnRoIC0gMSwgMSk7XG4gICAgICBjb25zdCBtb250aEVuZCA9IG5ldyBEYXRlKGN1cnJlbnRZZWFyLCBtb250aCwgMCwgMjMsIDU5LCA1OSwgOTk5KTtcbiAgICAgIGRhdGVGaWx0ZXIgPSB7IGNyZWF0ZWRBdDogeyBndGU6IG1vbnRoU3RhcnQsIGx0ZTogbW9udGhFbmQgfSB9O1xuICAgIH1cblxuICAgIGNvbnN0IHdoZXJlID0ge1xuICAgICAgb3JnSWQ6IHJlcS51c2VyIS5vcmdJZCxcbiAgICAgIC4uLnNpdGVGaWx0ZXIsXG4gICAgICAuLi4odHlwZSAmJiB7IHR5cGUgfSksXG4gICAgICAuLi4oc3RhdHVzICYmIHsgc3RhdHVzIH0pLFxuICAgICAgLi4uKHNwZWNpbWVuSWQgJiYgeyBzcGVjaW1lbklkOiB7IGNvbnRhaW5zOiBzcGVjaW1lbklkIH0gfSksXG4gICAgICAuLi4oc3RhcnREYXRlICYmICFtb250aCAmJiAheWVhciAmJiB7IGNyZWF0ZWRBdDogeyBndGU6IHN0YXJ0RGF0ZSB9IH0pLFxuICAgICAgLi4uKGVuZERhdGUgJiYgIW1vbnRoICYmICF5ZWFyICYmIHsgY3JlYXRlZEF0OiB7IGx0ZTogZW5kRGF0ZSB9IH0pLFxuICAgICAgLi4uZGF0ZUZpbHRlcixcbiAgICAgIC4uLihwZXJmb3JtZWRCeSAmJiB7IHBlcmZvcm1lZEJ5SWQ6IHBlcmZvcm1lZEJ5IH0pLFxuICAgIH07XG5cbiAgICBjb25zdCBbcmVjb3JkcywgdG90YWxdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgcHJpc21hLm1hbnVhbENvdW50UmVjb3JkLmZpbmRNYW55KHtcbiAgICAgICAgd2hlcmUsXG4gICAgICAgIHNraXA6IChwYWdlIC0gMSkgKiBwYWdlU2l6ZSxcbiAgICAgICAgdGFrZTogcGFnZVNpemUsXG4gICAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiAnZGVzYycgfSxcbiAgICAgICAgaW5jbHVkZToge1xuICAgICAgICAgIHNpdGU6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlIH0gfSxcbiAgICAgICAgICBwZXJmb3JtZWRCeTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUgfSB9LFxuICAgICAgICAgIHZlcmlmaWVkQnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlIH0gfSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAgcHJpc21hLm1hbnVhbENvdW50UmVjb3JkLmNvdW50KHsgd2hlcmUgfSksXG4gICAgXSk7XG5cbiAgICByZXMuanNvbih7XG4gICAgICBkYXRhOiByZWNvcmRzLFxuICAgICAgdG90YWwsXG4gICAgICBwYWdlLFxuICAgICAgcGFnZVNpemUsXG4gICAgICB0b3RhbFBhZ2VzOiBNYXRoLmNlaWwodG90YWwgLyBwYWdlU2l6ZSksXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbmV4dChlcnJvcik7XG4gIH1cbn0pO1xuXG4vLyBHZXQgb3ZlcmR1ZSBwZW5kaW5nIHJlY29yZHMgKHBlbmRpbmcgZm9yIG1vcmUgdGhhbiAyNCBob3Vycywgbm9uLVFDIG9ubHkpXG4vLyBGb3Igc3VwZXJ2aXNvcnMvYWRtaW5zIHRvIHNlZSByZWNvcmRzIG5lZWRpbmcgYXR0ZW50aW9uXG5yZWNvcmRzUm91dGVyLmdldCgnL2FsZXJ0cy9vdmVyZHVlJywgYXV0aG9yaXplKCdzdXBlcnZpc29yJywgJ2FkbWluJyksIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHR3ZW50eUZvdXJIb3Vyc0FnbyA9IG5ldyBEYXRlKERhdGUubm93KCkgLSAyNCAqIDYwICogNjAgKiAxMDAwKTtcblxuICAgIC8vIEdldCBzaXRlcyB1c2VyIGhhcyBhY2Nlc3MgdG8gYnkgcXVlcnlpbmcgVXNlclNpdGUgdGFibGVcbiAgICBjb25zdCB1c2VyU2l0ZXMgPSBhd2FpdCBwcmlzbWEudXNlclNpdGUuZmluZE1hbnkoe1xuICAgICAgd2hlcmU6IHsgdXNlcklkOiByZXEudXNlciEuaWQgfSxcbiAgICAgIHNlbGVjdDogeyBzaXRlSWQ6IHRydWUgfSxcbiAgICB9KTtcbiAgICBjb25zdCB1c2VyU2l0ZUlkcyA9IHVzZXJTaXRlcy5tYXAoKHVzKSA9PiB1cy5zaXRlSWQpO1xuXG4gICAgLy8gSWYgdXNlciBoYXMgbm8gc2l0ZSBhc3NpZ25tZW50cywgcmV0dXJuIGVtcHR5IHJlc3VsdFxuICAgIGlmICh1c2VyU2l0ZUlkcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJlcy5qc29uKHsgY291bnQ6IDAsIHJlY29yZHM6IFtdIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG92ZXJkdWVSZWNvcmRzID0gYXdhaXQgcHJpc21hLm1hbnVhbENvdW50UmVjb3JkLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIG9yZ0lkOiByZXEudXNlciEub3JnSWQsXG4gICAgICAgIHNpdGVJZDogeyBpbjogdXNlclNpdGVJZHMgfSxcbiAgICAgICAgc3RhdHVzOiAncGVuZGluZ192ZXJpZmljYXRpb24nLFxuICAgICAgICBpc1FDOiBmYWxzZSxcbiAgICAgICAgcGVyZm9ybWVkQXQ6IHsgbHQ6IHR3ZW50eUZvdXJIb3Vyc0FnbyB9LFxuICAgICAgfSxcbiAgICAgIHNlbGVjdDoge1xuICAgICAgICBpZDogdHJ1ZSxcbiAgICAgICAgc3BlY2ltZW5JZDogdHJ1ZSxcbiAgICAgICAgdHlwZTogdHJ1ZSxcbiAgICAgICAgcGVyZm9ybWVkQXQ6IHRydWUsXG4gICAgICAgIHNpdGU6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlIH0gfSxcbiAgICAgICAgcGVyZm9ybWVkQnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlIH0gfSxcbiAgICAgIH0sXG4gICAgICBvcmRlckJ5OiB7IHBlcmZvcm1lZEF0OiAnYXNjJyB9LFxuICAgICAgdGFrZTogNTAsIC8vIExpbWl0IHRvIHByZXZlbnQgaHVnZSByZXNwb25zZXNcbiAgICB9KTtcblxuICAgIHJlcy5qc29uKHtcbiAgICAgIGNvdW50OiBvdmVyZHVlUmVjb3Jkcy5sZW5ndGgsXG4gICAgICByZWNvcmRzOiBvdmVyZHVlUmVjb3JkcyxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBuZXh0KGVycm9yKTtcbiAgfVxufSk7XG5cbi8vIEdldCBzaW5nbGUgcmVjb3JkXG5yZWNvcmRzUm91dGVyLmdldCgnLzppZCcsIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHJlY29yZCA9IGF3YWl0IHByaXNtYS5tYW51YWxDb3VudFJlY29yZC5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgaWQ6IHJlcS5wYXJhbXMuaWQsXG4gICAgICAgIG9yZ0lkOiByZXEudXNlciEub3JnSWQsXG4gICAgICB9LFxuICAgICAgaW5jbHVkZToge1xuICAgICAgICBzaXRlOiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSB9IH0sXG4gICAgICAgIHBlcmZvcm1lZEJ5OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSB9LFxuICAgICAgICB2ZXJpZmllZEJ5OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGlmICghcmVjb3JkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCAnTk9UX0ZPVU5EJywgJ1JlY29yZCBub3QgZm91bmQnKTtcbiAgICB9XG5cbiAgICByZXMuanNvbihyZWNvcmQpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIG5leHQoZXJyb3IpO1xuICB9XG59KTtcblxuLy8gQ3JlYXRlIG5ldyByZWNvcmRcbnJlY29yZHNSb3V0ZXIucG9zdCgnLycsIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGJvZHkgPSBDcmVhdGVSZWNvcmRSZXF1ZXN0U2NoZW1hLnBhcnNlKHJlcS5ib2R5KTtcbiAgICBjb25zdCBjYWxjdWxhdGlvbnMgPSBjYWxjdWxhdGVSZXN1bHRzKGJvZHkudHlwZSwgYm9keS5yYXdUYWxsaWVzKTtcblxuICAgIC8vIENhcHR1cmUgbWV0aG9kIHBhcmFtcyBzbmFwc2hvdCBmb3IgaGlzdG9yaWNhbCBhY2N1cmFjeVxuICAgIGNvbnN0IHBhcmFtc1NuYXBzaG90ID0gYXdhaXQgY3JlYXRlUGFyYW1zU25hcHNob3QocmVxLnVzZXIhLm9yZ0lkLCBib2R5LnR5cGUpO1xuXG4gICAgY29uc3QgcmVjb3JkID0gYXdhaXQgcHJpc21hLm1hbnVhbENvdW50UmVjb3JkLmNyZWF0ZSh7XG4gICAgICBkYXRhOiB7XG4gICAgICAgIG9yZ0lkOiByZXEudXNlciEub3JnSWQsXG4gICAgICAgIHNpdGVJZDogcmVxLnVzZXIhLnNpdGVJZCEsXG4gICAgICAgIHR5cGU6IGJvZHkudHlwZSxcbiAgICAgICAgc3BlY2ltZW5JZDogYm9keS5zcGVjaW1lbklkLFxuICAgICAgICBmbHVpZFR5cGU6IGJvZHkuZmx1aWRUeXBlLFxuICAgICAgICBkaWx1dGlvbjogYm9keS5kaWx1dGlvbixcbiAgICAgICAgc3F1YXJlc0NvdW50ZWQ6IGJvZHkuc3F1YXJlc0NvdW50ZWQsXG4gICAgICAgIGlzUUM6IGJvZHkuaXNRQyA/PyBmYWxzZSxcbiAgICAgICAgc3RhdHVzOiAnZHJhZnQnLFxuICAgICAgICByYXdUYWxsaWVzOiBib2R5LnJhd1RhbGxpZXMgYXMgb2JqZWN0LFxuICAgICAgICBjYWxjdWxhdGlvbnM6IGNhbGN1bGF0aW9ucyBhcyBvYmplY3QsXG4gICAgICAgIG1ldGhvZFZlcnNpb246IENVUlJFTlRfTUVUSE9EX1ZFUlNJT04sXG4gICAgICAgIHBhcmFtc1NuYXBzaG90OiBwYXJhbXNTbmFwc2hvdCBhcyBvYmplY3QsXG4gICAgICAgIHBlcmZvcm1lZEJ5SWQ6IHJlcS51c2VyIS5pZCxcbiAgICAgIH0sXG4gICAgICBpbmNsdWRlOiB7XG4gICAgICAgIHNpdGU6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlIH0gfSxcbiAgICAgICAgcGVyZm9ybWVkQnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlIH0gfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBhd2FpdCBhdWRpdExvZyh7XG4gICAgICBvcmdJZDogcmVxLnVzZXIhLm9yZ0lkLFxuICAgICAgZW50aXR5VHlwZTogJ21hbnVhbF9jb3VudF9yZWNvcmQnLFxuICAgICAgZW50aXR5SWQ6IHJlY29yZC5pZCxcbiAgICAgIGFjdGlvbjogJ2NyZWF0ZScsXG4gICAgICBtZXRhZGF0YTogeyByZWNvcmQgfSxcbiAgICAgIGFjdG9yVXNlcklkOiByZXEudXNlciEuaWQsXG4gICAgICByZXEsXG4gICAgfSk7XG5cbiAgICByZXMuc3RhdHVzKDIwMSkuanNvbihyZWNvcmQpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIG5leHQoZXJyb3IpO1xuICB9XG59KTtcblxuLy8gVXBkYXRlIHJlY29yZCAob25seSBkcmFmdHMgY2FuIGJlIHVwZGF0ZWQpXG5yZWNvcmRzUm91dGVyLnBhdGNoKCcvOmlkJywgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgYm9keSA9IFVwZGF0ZVJlY29yZFJlcXVlc3RTY2hlbWEucGFyc2UocmVxLmJvZHkpO1xuXG4gICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcmlzbWEubWFudWFsQ291bnRSZWNvcmQuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIGlkOiByZXEucGFyYW1zLmlkLFxuICAgICAgICBvcmdJZDogcmVxLnVzZXIhLm9yZ0lkLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGlmICghZXhpc3RpbmcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsICdOT1RfRk9VTkQnLCAnUmVjb3JkIG5vdCBmb3VuZCcpO1xuICAgIH1cblxuICAgIGlmIChleGlzdGluZy5zdGF0dXMgIT09ICdkcmFmdCcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsICdJTlZBTElEX1NUQVRVUycsICdPbmx5IGRyYWZ0IHJlY29yZHMgY2FuIGJlIHVwZGF0ZWQnKTtcbiAgICB9XG5cbiAgICBjb25zdCB1cGRhdGVEYXRhOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHt9O1xuICAgIGlmIChib2R5LnJhd1RhbGxpZXMpIHtcbiAgICAgIHVwZGF0ZURhdGEucmF3VGFsbGllcyA9IGJvZHkucmF3VGFsbGllcztcbiAgICAgIHVwZGF0ZURhdGEuY2FsY3VsYXRpb25zID0gY2FsY3VsYXRlUmVzdWx0cyhleGlzdGluZy50eXBlLCBib2R5LnJhd1RhbGxpZXMpO1xuICAgIH1cbiAgICBpZiAoYm9keS5zdGF0dXMpIHtcbiAgICAgIHVwZGF0ZURhdGEuc3RhdHVzID0gYm9keS5zdGF0dXM7XG4gICAgfVxuXG4gICAgY29uc3QgcmVjb3JkID0gYXdhaXQgcHJpc21hLm1hbnVhbENvdW50UmVjb3JkLnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcmVxLnBhcmFtcy5pZCB9LFxuICAgICAgZGF0YTogdXBkYXRlRGF0YSxcbiAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgcGVyZm9ybWVkQnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlIH0gfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBhd2FpdCBhdWRpdExvZyh7XG4gICAgICBvcmdJZDogcmVxLnVzZXIhLm9yZ0lkLFxuICAgICAgZW50aXR5VHlwZTogJ21hbnVhbF9jb3VudF9yZWNvcmQnLFxuICAgICAgZW50aXR5SWQ6IHJlY29yZC5pZCxcbiAgICAgIGFjdGlvbjogJ3VwZGF0ZScsXG4gICAgICBtZXRhZGF0YTogeyBiZWZvcmU6IGV4aXN0aW5nLCBhZnRlcjogcmVjb3JkIH0sXG4gICAgICBhY3RvclVzZXJJZDogcmVxLnVzZXIhLmlkLFxuICAgICAgcmVxLFxuICAgIH0pO1xuXG4gICAgcmVzLmpzb24ocmVjb3JkKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBuZXh0KGVycm9yKTtcbiAgfVxufSk7XG5cbi8vIFN1Ym1pdCBmb3IgdmVyaWZpY2F0aW9uIChRQyByZWNvcmRzIGF1dG8tdmVyaWZ5KVxucmVjb3Jkc1JvdXRlci5wb3N0KCcvOmlkL3N1Ym1pdCcsIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGJvZHkgPSBTdWJtaXRSZWNvcmRSZXF1ZXN0U2NoZW1hLnBhcnNlKHJlcS5ib2R5KTtcblxuICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLm1hbnVhbENvdW50UmVjb3JkLmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZToge1xuICAgICAgICBpZDogcmVxLnBhcmFtcy5pZCxcbiAgICAgICAgb3JnSWQ6IHJlcS51c2VyIS5vcmdJZCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIWV4aXN0aW5nKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCAnTk9UX0ZPVU5EJywgJ1JlY29yZCBub3QgZm91bmQnKTtcbiAgICB9XG5cbiAgICBpZiAoZXhpc3Rpbmcuc3RhdHVzICE9PSAnZHJhZnQnKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCAnSU5WQUxJRF9TVEFUVVMnLCAnT25seSBkcmFmdCByZWNvcmRzIGNhbiBiZSBzdWJtaXR0ZWQnKTtcbiAgICB9XG5cbiAgICAvLyBRQyByZWNvcmRzIGF1dG8tdmVyaWZ5IChubyBwZWVyIHJldmlldyBuZWVkZWQpXG4gICAgY29uc3QgaXNRQyA9IGV4aXN0aW5nLmlzUUM7XG4gICAgY29uc3QgbmV3U3RhdHVzID0gaXNRQyA/ICd2ZXJpZmllZCcgOiAncGVuZGluZ192ZXJpZmljYXRpb24nO1xuXG4gICAgY29uc3QgcmVjb3JkID0gYXdhaXQgcHJpc21hLm1hbnVhbENvdW50UmVjb3JkLnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcmVxLnBhcmFtcy5pZCB9LFxuICAgICAgZGF0YToge1xuICAgICAgICBzdGF0dXM6IG5ld1N0YXR1cyxcbiAgICAgICAgcGVyZm9ybWVyQXR0ZXN0YXRpb246IGJvZHkucGVyZm9ybWVyQXR0ZXN0YXRpb24sXG4gICAgICAgIHBlcmZvcm1lckF0dGVzdGVkQXQ6IG5ldyBEYXRlKCksXG4gICAgICAgIC4uLihpc1FDICYmIHtcbiAgICAgICAgICB2ZXJpZmllZEJ5SWQ6IHJlcS51c2VyIS5pZCxcbiAgICAgICAgICB2ZXJpZmllZEF0OiBuZXcgRGF0ZSgpLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBhd2FpdCBhdWRpdExvZyh7XG4gICAgICBvcmdJZDogcmVxLnVzZXIhLm9yZ0lkLFxuICAgICAgZW50aXR5VHlwZTogJ21hbnVhbF9jb3VudF9yZWNvcmQnLFxuICAgICAgZW50aXR5SWQ6IHJlY29yZC5pZCxcbiAgICAgIGFjdGlvbjogaXNRQyA/ICdzdWJtaXRfcWNfYXV0b192ZXJpZmllZCcgOiAnc3VibWl0X3BlbmRpbmcnLFxuICAgICAgbWV0YWRhdGE6IHsgc3RhdHVzQmVmb3JlOiBleGlzdGluZy5zdGF0dXMsIHN0YXR1c0FmdGVyOiByZWNvcmQuc3RhdHVzLCBpc1FDLCBwZXJmb3JtZXJBdHRlc3RhdGlvbjogYm9keS5wZXJmb3JtZXJBdHRlc3RhdGlvbiB9LFxuICAgICAgYWN0b3JVc2VySWQ6IHJlcS51c2VyIS5pZCxcbiAgICAgIHJlcSxcbiAgICB9KTtcblxuICAgIHJlcy5qc29uKHJlY29yZCk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbmV4dChlcnJvcik7XG4gIH1cbn0pO1xuXG4vLyBWZXJpZnkgcmVjb3JkICh0ZWNobm9sb2dpc3RzLCBzdXBlcnZpc29ycywgYW5kIGFkbWlucyBjYW4gdmVyaWZ5IG90aGVycycgcmVjb3Jkcylcbi8vIEFwcGx5IHN0cmljdCByYXRlIGxpbWl0aW5nIHRvIHByZXZlbnQgYWJ1c2VcbnJlY29yZHNSb3V0ZXIucG9zdChcbiAgJy86aWQvdmVyaWZ5JyxcbiAgc2Vuc2l0aXZlUmF0ZUxpbWl0ZXIsXG4gIGF1dGhvcml6ZSgndGVjaG5vbG9naXN0JywgJ3N1cGVydmlzb3InLCAnYWRtaW4nKSxcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGJvZHkgPSBWZXJpZnlSZWNvcmRSZXF1ZXN0U2NoZW1hLnBhcnNlKHJlcS5ib2R5KTtcblxuICAgICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcmlzbWEubWFudWFsQ291bnRSZWNvcmQuZmluZEZpcnN0KHtcbiAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICBpZDogcmVxLnBhcmFtcy5pZCxcbiAgICAgICAgICBvcmdJZDogcmVxLnVzZXIhLm9yZ0lkLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghZXhpc3RpbmcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgJ05PVF9GT1VORCcsICdSZWNvcmQgbm90IGZvdW5kJyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChleGlzdGluZy5zdGF0dXMgIT09ICdwZW5kaW5nX3ZlcmlmaWNhdGlvbicpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgJ0lOVkFMSURfU1RBVFVTJywgJ09ubHkgcGVuZGluZyByZWNvcmRzIGNhbiBiZSB2ZXJpZmllZCcpO1xuICAgICAgfVxuXG4gICAgICAvLyBTZWxmLXZlcmlmaWNhdGlvbiBpcyBuZXZlciBhbGxvd2VkIC0gYSBkaWZmZXJlbnQgdXNlciBtdXN0IHZlcmlmeVxuICAgICAgaWYgKGV4aXN0aW5nLnBlcmZvcm1lZEJ5SWQgPT09IHJlcS51c2VyIS5pZCkge1xuICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCAnU0VMRl9WRVJJRklDQVRJT05fTk9UX0FMTE9XRUQnLCAnWW91IGNhbm5vdCB2ZXJpZnkgeW91ciBvd24gcmVjb3JkcycpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByZWNvcmQgPSBhd2FpdCBwcmlzbWEubWFudWFsQ291bnRSZWNvcmQudXBkYXRlKHtcbiAgICAgICAgd2hlcmU6IHsgaWQ6IHJlcS5wYXJhbXMuaWQgfSxcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIHN0YXR1czogJ3ZlcmlmaWVkJyxcbiAgICAgICAgICB2ZXJpZmllZEJ5SWQ6IHJlcS51c2VyIS5pZCxcbiAgICAgICAgICB2ZXJpZmllZEF0OiBuZXcgRGF0ZSgpLFxuICAgICAgICAgIHZlcmlmaWVyQXR0ZXN0YXRpb246IGJvZHkudmVyaWZpZXJBdHRlc3RhdGlvbixcbiAgICAgICAgfSxcbiAgICAgICAgaW5jbHVkZToge1xuICAgICAgICAgIHBlcmZvcm1lZEJ5OiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSB9IH0sXG4gICAgICAgICAgdmVyaWZpZWRCeTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUgfSB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIGF3YWl0IGF1ZGl0TG9nKHtcbiAgICAgICAgb3JnSWQ6IHJlcS51c2VyIS5vcmdJZCxcbiAgICAgICAgZW50aXR5VHlwZTogJ21hbnVhbF9jb3VudF9yZWNvcmQnLFxuICAgICAgICBlbnRpdHlJZDogcmVjb3JkLmlkLFxuICAgICAgICBhY3Rpb246ICd2ZXJpZnknLFxuICAgICAgICBtZXRhZGF0YTogeyBzdGF0dXNCZWZvcmU6IGV4aXN0aW5nLnN0YXR1cywgc3RhdHVzQWZ0ZXI6IHJlY29yZC5zdGF0dXMsIHZlcmlmaWVkQnlJZDogcmVjb3JkLnZlcmlmaWVkQnlJZCwgdmVyaWZpZXJBdHRlc3RhdGlvbjogYm9keS52ZXJpZmllckF0dGVzdGF0aW9uIH0sXG4gICAgICAgIGFjdG9yVXNlcklkOiByZXEudXNlciEuaWQsXG4gICAgICAgIHJlcSxcbiAgICAgIH0pO1xuXG4gICAgICByZXMuanNvbihyZWNvcmQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBuZXh0KGVycm9yKTtcbiAgICB9XG4gIH1cbik7XG5cbi8vIERlbGV0ZSByZWNvcmQgKG9ubHkgZHJhZnRzLCBhZG1pbnMgb25seSlcbnJlY29yZHNSb3V0ZXIuZGVsZXRlKFxuICAnLzppZCcsXG4gIGF1dGhvcml6ZSgnYWRtaW4nKSxcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLm1hbnVhbENvdW50UmVjb3JkLmZpbmRGaXJzdCh7XG4gICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgaWQ6IHJlcS5wYXJhbXMuaWQsXG4gICAgICAgICAgb3JnSWQ6IHJlcS51c2VyIS5vcmdJZCxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIWV4aXN0aW5nKSB7XG4gICAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsICdOT1RfRk9VTkQnLCAnUmVjb3JkIG5vdCBmb3VuZCcpO1xuICAgICAgfVxuXG4gICAgICBpZiAoZXhpc3Rpbmcuc3RhdHVzICE9PSAnZHJhZnQnKSB7XG4gICAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsICdJTlZBTElEX1NUQVRVUycsICdPbmx5IGRyYWZ0IHJlY29yZHMgY2FuIGJlIGRlbGV0ZWQnKTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgcHJpc21hLm1hbnVhbENvdW50UmVjb3JkLmRlbGV0ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkOiByZXEucGFyYW1zLmlkIH0sXG4gICAgICB9KTtcblxuICAgICAgYXdhaXQgYXVkaXRMb2coe1xuICAgICAgICBvcmdJZDogcmVxLnVzZXIhLm9yZ0lkLFxuICAgICAgICBlbnRpdHlUeXBlOiAnbWFudWFsX2NvdW50X3JlY29yZCcsXG4gICAgICAgIGVudGl0eUlkOiByZXEucGFyYW1zLmlkLFxuICAgICAgICBhY3Rpb246ICdkZWxldGUnLFxuICAgICAgICBtZXRhZGF0YTogeyByZWNvcmQ6IGV4aXN0aW5nIH0sXG4gICAgICAgIGFjdG9yVXNlcklkOiByZXEudXNlciEuaWQsXG4gICAgICAgIHJlcSxcbiAgICAgIH0pO1xuXG4gICAgICByZXMuc3RhdHVzKDIwNCkuc2VuZCgpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBuZXh0KGVycm9yKTtcbiAgICB9XG4gIH1cbik7XG5cbi8vIEFtZW5kL2NvcnJlY3QgYSB2ZXJpZmllZCByZWNvcmQgKHVwZGF0ZXMgaW4gcGxhY2UsIG5vIG5ldyB2ZXJzaW9uKVxuLy8gU3VwZXJ2aXNvcnMvYWRtaW5zIGNhbiBhbWVuZCBhbnkgcmVjb3JkLCB0ZWNobm9sb2dpc3RzIGNhbiBvbmx5IGFtZW5kIHRoZWlyIG93blxuLy8gU3RhdHVzIGNoYW5nZXMgdG8gJ2NvcnJlY3RlZCcsIGNoYW5nZXMgYXJlIGxvZ2dlZCB0byBhdWRpdCB0cmFpbFxucmVjb3Jkc1JvdXRlci5wb3N0KFxuICAnLzppZC9hbWVuZCcsXG4gIHNlbnNpdGl2ZVJhdGVMaW1pdGVyLFxuICBhdXRob3JpemUoJ3RlY2hub2xvZ2lzdCcsICdzdXBlcnZpc29yJywgJ2FkbWluJyksXG4gIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBib2R5ID0gQ3JlYXRlQ29ycmVjdGlvblJlcXVlc3RTY2hlbWEucGFyc2UocmVxLmJvZHkpO1xuXG4gICAgICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHByaXNtYS5tYW51YWxDb3VudFJlY29yZC5maW5kRmlyc3Qoe1xuICAgICAgICB3aGVyZToge1xuICAgICAgICAgIGlkOiByZXEucGFyYW1zLmlkLFxuICAgICAgICAgIG9yZ0lkOiByZXEudXNlciEub3JnSWQsXG4gICAgICAgIH0sXG4gICAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgICBwZXJmb3JtZWRCeTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUgfSB9LFxuICAgICAgICAgIHZlcmlmaWVkQnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlIH0gfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIWV4aXN0aW5nKSB7XG4gICAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsICdOT1RfRk9VTkQnLCAnUmVjb3JkIG5vdCBmb3VuZCcpO1xuICAgICAgfVxuXG4gICAgICAvLyBBbGxvdyBhbWVuZGluZyB2ZXJpZmllZCBvciBhbHJlYWR5LWNvcnJlY3RlZCByZWNvcmRzXG4gICAgICBpZiAoZXhpc3Rpbmcuc3RhdHVzICE9PSAndmVyaWZpZWQnICYmIGV4aXN0aW5nLnN0YXR1cyAhPT0gJ2NvcnJlY3RlZCcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgJ0lOVkFMSURfU1RBVFVTJywgJ09ubHkgdmVyaWZpZWQgb3IgY29ycmVjdGVkIHJlY29yZHMgY2FuIGJlIGFtZW5kZWQnKTtcbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgcGVybWlzc2lvbjogdGVjaG5vbG9naXN0cyBjYW4gb25seSBhbWVuZCB0aGVpciBvd24gcmVjb3Jkc1xuICAgICAgY29uc3QgaXNPd25SZWNvcmQgPSBleGlzdGluZy5wZXJmb3JtZWRCeUlkID09PSByZXEudXNlciEuaWQ7XG4gICAgICBjb25zdCBpc1N1cGVydmlzb3JPckFkbWluID0gcmVxLnVzZXIhLnJvbGUgPT09ICdzdXBlcnZpc29yJyB8fCByZXEudXNlciEucm9sZSA9PT0gJ2FkbWluJztcblxuICAgICAgaWYgKCFpc093blJlY29yZCAmJiAhaXNTdXBlcnZpc29yT3JBZG1pbikge1xuICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCAnRk9SQklEREVOJywgJ1lvdSBjYW4gb25seSBhbWVuZCB5b3VyIG93biByZWNvcmRzJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIFRyYWNrIHdoYXQgY2hhbmdlZCBmb3IgdGhlIGF1ZGl0IGxvZ1xuICAgICAgY29uc3QgY2hhbmdlczogUmVjb3JkPHN0cmluZywgeyBiZWZvcmU6IHVua25vd247IGFmdGVyOiB1bmtub3duIH0+ID0ge307XG5cbiAgICAgIC8vIERldGVybWluZSB3aGF0J3MgYmVpbmcgY2hhbmdlZFxuICAgICAgY29uc3QgcmF3VGFsbGllc1RvVXNlID0gYm9keS5yYXdUYWxsaWVzID8/IGV4aXN0aW5nLnJhd1RhbGxpZXM7XG4gICAgICBjb25zdCB0YWxsaWVzQ2hhbmdlZCA9IGJvZHkucmF3VGFsbGllcyAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KGJvZHkucmF3VGFsbGllcykgIT09IEpTT04uc3RyaW5naWZ5KGV4aXN0aW5nLnJhd1RhbGxpZXMpO1xuXG4gICAgICBpZiAodGFsbGllc0NoYW5nZWQpIHtcbiAgICAgICAgY2hhbmdlcy5yYXdUYWxsaWVzID0geyBiZWZvcmU6IGV4aXN0aW5nLnJhd1RhbGxpZXMsIGFmdGVyOiBib2R5LnJhd1RhbGxpZXMgfTtcbiAgICAgICAgLy8gTm90ZTogY2FsY3VsYXRpb25zIGlzIGEgZGVyaXZlZCBmaWVsZCwgbm90IHRyYWNrZWQgc2VwYXJhdGVseSBpbiBjaGFuZ2VkRmllbGRzXG4gICAgICB9XG5cbiAgICAgIGlmIChib2R5LnNwZWNpbWVuSWQgJiYgYm9keS5zcGVjaW1lbklkICE9PSBleGlzdGluZy5zcGVjaW1lbklkKSB7XG4gICAgICAgIGNoYW5nZXMuc3BlY2ltZW5JZCA9IHsgYmVmb3JlOiBleGlzdGluZy5zcGVjaW1lbklkLCBhZnRlcjogYm9keS5zcGVjaW1lbklkIH07XG4gICAgICB9XG5cbiAgICAgIGlmIChib2R5LnBlcmZvcm1lZEF0KSB7XG4gICAgICAgIGNvbnN0IG5ld1BlcmZvcm1lZEF0ID0gbmV3IERhdGUoYm9keS5wZXJmb3JtZWRBdCk7XG4gICAgICAgIGlmIChuZXdQZXJmb3JtZWRBdC5nZXRUaW1lKCkgIT09IGV4aXN0aW5nLnBlcmZvcm1lZEF0LmdldFRpbWUoKSkge1xuICAgICAgICAgIGNoYW5nZXMucGVyZm9ybWVkQXQgPSB7IGJlZm9yZTogZXhpc3RpbmcucGVyZm9ybWVkQXQsIGFmdGVyOiBuZXdQZXJmb3JtZWRBdCB9O1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIE11c3QgaGF2ZSBhdCBsZWFzdCBvbmUgY2hhbmdlXG4gICAgICBpZiAoT2JqZWN0LmtleXMoY2hhbmdlcykubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsICdOT19DSEFOR0VTJywgJ05vIGNoYW5nZXMgd2VyZSBtYWRlIHRvIHRoZSByZWNvcmQnKTtcbiAgICAgIH1cblxuICAgICAgLy8gQnVpbGQgdXBkYXRlIGRhdGFcbiAgICAgIGNvbnN0IHVwZGF0ZURhdGE6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge1xuICAgICAgICBzdGF0dXM6ICdjb3JyZWN0ZWQnLFxuICAgICAgICBjb3JyZWN0aW9uUmVhc29uOiBib2R5LnJlYXNvbixcbiAgICAgIH07XG5cbiAgICAgIGlmICh0YWxsaWVzQ2hhbmdlZCAmJiBib2R5LnJhd1RhbGxpZXMpIHtcbiAgICAgICAgdXBkYXRlRGF0YS5yYXdUYWxsaWVzID0gYm9keS5yYXdUYWxsaWVzO1xuICAgICAgICB1cGRhdGVEYXRhLmNhbGN1bGF0aW9ucyA9IGNhbGN1bGF0ZVJlc3VsdHMoZXhpc3RpbmcudHlwZSwgYm9keS5yYXdUYWxsaWVzIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KTtcbiAgICAgIH1cblxuICAgICAgaWYgKGJvZHkuc3BlY2ltZW5JZCkge1xuICAgICAgICB1cGRhdGVEYXRhLnNwZWNpbWVuSWQgPSBib2R5LnNwZWNpbWVuSWQ7XG4gICAgICB9XG5cbiAgICAgIGlmIChib2R5LnBlcmZvcm1lZEF0KSB7XG4gICAgICAgIHVwZGF0ZURhdGEucGVyZm9ybWVkQXQgPSBuZXcgRGF0ZShib2R5LnBlcmZvcm1lZEF0KTtcbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIHRoZSByZWNvcmQgaW4gcGxhY2VcbiAgICAgIGNvbnN0IHVwZGF0ZWRSZWNvcmQgPSBhd2FpdCBwcmlzbWEubWFudWFsQ291bnRSZWNvcmQudXBkYXRlKHtcbiAgICAgICAgd2hlcmU6IHsgaWQ6IHJlcS5wYXJhbXMuaWQgfSxcbiAgICAgICAgZGF0YTogdXBkYXRlRGF0YSxcbiAgICAgICAgaW5jbHVkZToge1xuICAgICAgICAgIHNpdGU6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlIH0gfSxcbiAgICAgICAgICBwZXJmb3JtZWRCeTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUgfSB9LFxuICAgICAgICAgIHZlcmlmaWVkQnk6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlIH0gfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBMb2cgZGV0YWlsZWQgY2hhbmdlcyB0byBhdWRpdCB0cmFpbFxuICAgICAgYXdhaXQgYXVkaXRMb2coe1xuICAgICAgICBvcmdJZDogcmVxLnVzZXIhLm9yZ0lkLFxuICAgICAgICBlbnRpdHlUeXBlOiAnbWFudWFsX2NvdW50X3JlY29yZCcsXG4gICAgICAgIGVudGl0eUlkOiB1cGRhdGVkUmVjb3JkLmlkLFxuICAgICAgICBhY3Rpb246ICdhbWVuZCcsXG4gICAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgICAgY29ycmVjdGlvblJlYXNvbjogYm9keS5yZWFzb24sXG4gICAgICAgICAgY2hhbmdlcyxcbiAgICAgICAgICBjaGFuZ2VkRmllbGRzOiBPYmplY3Qua2V5cyhjaGFuZ2VzKSxcbiAgICAgICAgfSxcbiAgICAgICAgYWN0b3JVc2VySWQ6IHJlcS51c2VyIS5pZCxcbiAgICAgICAgcmVxLFxuICAgICAgfSk7XG5cbiAgICAgIHJlcy5qc29uKHVwZGF0ZWRSZWNvcmQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBuZXh0KGVycm9yKTtcbiAgICB9XG4gIH1cbik7XG5cbi8vIEdldCBhdWRpdCBsb2cgZm9yIGEgcmVjb3JkXG4vLyBSZXR1cm5zIGFsbCBhdWRpdCBldmVudHMgcmVsYXRlZCB0byB0aGlzIHJlY29yZFxucmVjb3Jkc1JvdXRlci5nZXQoJy86aWQvYXVkaXQnLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCByZWNvcmQgPSBhd2FpdCBwcmlzbWEubWFudWFsQ291bnRSZWNvcmQuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIGlkOiByZXEucGFyYW1zLmlkLFxuICAgICAgICBvcmdJZDogcmVxLnVzZXIhLm9yZ0lkLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGlmICghcmVjb3JkKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCAnTk9UX0ZPVU5EJywgJ1JlY29yZCBub3QgZm91bmQnKTtcbiAgICB9XG5cbiAgICAvLyBHZXQgYWxsIGF1ZGl0IGV2ZW50cyBmb3IgdGhpcyByZWNvcmRcbiAgICBjb25zdCBhdWRpdEV2ZW50cyA9IGF3YWl0IHByaXNtYS5hdWRpdEV2ZW50LmZpbmRNYW55KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIGVudGl0eVR5cGU6ICdtYW51YWxfY291bnRfcmVjb3JkJyxcbiAgICAgICAgZW50aXR5SWQ6IHJlcS5wYXJhbXMuaWQsXG4gICAgICAgIG9yZ0lkOiByZXEudXNlciEub3JnSWQsXG4gICAgICB9LFxuICAgICAgaW5jbHVkZToge1xuICAgICAgICBhY3RvcjogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUgfSB9LFxuICAgICAgfSxcbiAgICAgIG9yZGVyQnk6IHsgY3JlYXRlZEF0OiAnZGVzYycgfSxcbiAgICB9KTtcblxuICAgIC8vIEZvcm1hdCB0aGUgYXVkaXQgZXZlbnRzIGZvciBkaXNwbGF5XG4gICAgY29uc3QgZXZlbnRzID0gYXVkaXRFdmVudHMubWFwKChldmVudCkgPT4gKHtcbiAgICAgIGlkOiBldmVudC5pZCxcbiAgICAgIGFjdGlvbjogZXZlbnQuYWN0aW9uLFxuICAgICAgY3JlYXRlZEF0OiBldmVudC5jcmVhdGVkQXQsXG4gICAgICBhY3RvcjogZXZlbnQuYWN0b3IsXG4gICAgICBtZXRhZGF0YTogZXZlbnQubWV0YWRhdGEgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICAgfSkpO1xuXG4gICAgcmVzLmpzb24oeyBldmVudHMgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbmV4dChlcnJvcik7XG4gIH1cbn0pO1xuIl19