"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizationsRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../../lib/prisma");
const error_handler_1 = require("../../middleware/error-handler");
const audit_1 = require("../../services/audit");
const cognito_1 = require("../../services/cognito");
const shared_1 = require("@lab-counters/shared");
exports.organizationsRouter = (0, express_1.Router)();
// List all organizations (excluding system org)
exports.organizationsRouter.get('/', async (req, res, next) => {
    try {
        const organizations = await prisma_1.prisma.organization.findMany({
            where: {
                slug: { not: 'system' }, // Hide the system org
            },
            include: {
                sites: { select: { id: true, name: true } },
                users: {
                    where: { role: 'admin' },
                    select: { id: true, name: true, email: true },
                },
                _count: {
                    select: { users: true, sites: true },
                },
            },
            orderBy: { name: 'asc' },
        });
        res.json(organizations);
    }
    catch (error) {
        next(error);
    }
});
// Get single organization with details
exports.organizationsRouter.get('/:id', async (req, res, next) => {
    try {
        const org = await prisma_1.prisma.organization.findUnique({
            where: { id: req.params.id },
            include: {
                sites: {
                    include: {
                        _count: { select: { users: true } },
                    },
                    orderBy: { name: 'asc' },
                },
                users: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        status: true,
                        site: { select: { id: true, name: true } },
                    },
                    orderBy: { name: 'asc' },
                },
            },
        });
        if (!org) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'Organization not found');
        }
        if (org.slug === 'system') {
            throw new error_handler_1.AppError(403, 'FORBIDDEN', 'Cannot access system organization');
        }
        res.json(org);
    }
    catch (error) {
        next(error);
    }
});
// Create organization
exports.organizationsRouter.post('/', async (req, res, next) => {
    try {
        const body = shared_1.CreateOrganizationSchema.parse(req.body);
        // Check slug uniqueness
        const existing = await prisma_1.prisma.organization.findUnique({
            where: { slug: body.slug },
        });
        if (existing) {
            throw new error_handler_1.AppError(400, 'SLUG_EXISTS', 'An organization with this slug already exists');
        }
        // Prevent creating org with reserved slug
        if (body.slug === 'system') {
            throw new error_handler_1.AppError(400, 'RESERVED_SLUG', 'This slug is reserved');
        }
        const defaultSettings = {
            timezone: 'America/New_York',
            defaultDilution: 10,
            requireVerification: true,
            allowSelfVerification: false,
        };
        const org = await prisma_1.prisma.organization.create({
            data: {
                name: body.name,
                slug: body.slug,
                settings: { ...defaultSettings, ...body.settings },
            },
        });
        await (0, audit_1.auditLog)({
            orgId: org.id,
            actorUserId: req.user.id,
            action: 'create',
            entityType: 'organization',
            entityId: org.id,
            metadata: { record: org },
            req,
        });
        res.status(201).json(org);
    }
    catch (error) {
        next(error);
    }
});
// Update organization
exports.organizationsRouter.patch('/:id', async (req, res, next) => {
    try {
        const body = shared_1.UpdateOrganizationSchema.parse(req.body);
        const existing = await prisma_1.prisma.organization.findUnique({
            where: { id: req.params.id },
        });
        if (!existing) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'Organization not found');
        }
        if (existing.slug === 'system') {
            throw new error_handler_1.AppError(403, 'FORBIDDEN', 'Cannot modify system organization');
        }
        const updateData = {};
        if (body.name)
            updateData.name = body.name;
        if (body.settings) {
            updateData.settings = { ...existing.settings, ...body.settings };
        }
        const org = await prisma_1.prisma.organization.update({
            where: { id: req.params.id },
            data: updateData,
        });
        await (0, audit_1.auditLog)({
            orgId: org.id,
            actorUserId: req.user.id,
            action: 'update',
            entityType: 'organization',
            entityId: org.id,
            metadata: { before: existing, after: org },
            req,
        });
        res.json(org);
    }
    catch (error) {
        next(error);
    }
});
// Change organization status (active/inactive)
exports.organizationsRouter.patch('/:id/status', async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!status || !['active', 'inactive'].includes(status)) {
            throw new error_handler_1.AppError(400, 'INVALID_STATUS', 'Status must be active or inactive');
        }
        const existing = await prisma_1.prisma.organization.findUnique({
            where: { id: req.params.id },
        });
        if (!existing) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'Organization not found');
        }
        if (existing.slug === 'system') {
            throw new error_handler_1.AppError(403, 'FORBIDDEN', 'Cannot modify system organization');
        }
        if (existing.status === 'archived') {
            throw new error_handler_1.AppError(400, 'ARCHIVED', 'Cannot change status of archived organization. Restore it first.');
        }
        const org = await prisma_1.prisma.organization.update({
            where: { id: req.params.id },
            data: { status },
        });
        // If deactivating, also deactivate all users
        if (status === 'inactive') {
            await prisma_1.prisma.user.updateMany({
                where: { orgId: req.params.id, status: 'active' },
                data: { status: 'inactive' },
            });
            if (process.env.NODE_ENV !== 'development') {
                const usersToDisable = await prisma_1.prisma.user.findMany({
                    where: { orgId: req.params.id, username: { not: null } },
                    select: { username: true },
                });
                for (const user of usersToDisable) {
                    try {
                        await (0, cognito_1.disableCognitoUser)(user.username);
                    }
                    catch (err) {
                        console.warn('Failed to disable Cognito user:', err);
                    }
                }
            }
        }
        await (0, audit_1.auditLog)({
            orgId: org.id,
            actorUserId: req.user.id,
            action: 'update',
            entityType: 'organization',
            entityId: org.id,
            metadata: { statusBefore: existing.status, statusAfter: org.status },
            req,
        });
        res.json(org);
    }
    catch (error) {
        next(error);
    }
});
// Archive organization (soft delete - can be restored)
exports.organizationsRouter.post('/:id/archive', async (req, res, next) => {
    try {
        const existing = await prisma_1.prisma.organization.findUnique({
            where: { id: req.params.id },
        });
        if (!existing) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'Organization not found');
        }
        if (existing.slug === 'system') {
            throw new error_handler_1.AppError(403, 'FORBIDDEN', 'Cannot archive system organization');
        }
        if (existing.status === 'archived') {
            throw new error_handler_1.AppError(400, 'ALREADY_ARCHIVED', 'Organization is already archived');
        }
        // Archive the org
        const org = await prisma_1.prisma.organization.update({
            where: { id: req.params.id },
            data: {
                status: 'archived',
                archivedAt: new Date(),
            },
        });
        // Archive all users in the org
        await prisma_1.prisma.user.updateMany({
            where: { orgId: req.params.id },
            data: {
                status: 'archived',
                archivedAt: new Date(),
            },
        });
        if (process.env.NODE_ENV !== 'development') {
            const usersToDisable = await prisma_1.prisma.user.findMany({
                where: { orgId: req.params.id, username: { not: null } },
                select: { username: true },
            });
            for (const user of usersToDisable) {
                try {
                    await (0, cognito_1.disableCognitoUser)(user.username);
                }
                catch (err) {
                    console.warn('Failed to disable Cognito user:', err);
                }
            }
        }
        // Archive all sites in the org
        await prisma_1.prisma.site.updateMany({
            where: { orgId: req.params.id },
            data: {
                status: 'archived',
                archivedAt: new Date(),
            },
        });
        await (0, audit_1.auditLog)({
            orgId: org.id,
            actorUserId: req.user.id,
            action: 'archive',
            entityType: 'organization',
            entityId: org.id,
            metadata: { statusBefore: existing.status, statusAfter: 'archived', archivedAt: org.archivedAt },
            req,
        });
        res.json(org);
    }
    catch (error) {
        next(error);
    }
});
// Restore archived organization
exports.organizationsRouter.post('/:id/restore', async (req, res, next) => {
    try {
        const existing = await prisma_1.prisma.organization.findUnique({
            where: { id: req.params.id },
        });
        if (!existing) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'Organization not found');
        }
        if (existing.status !== 'archived') {
            throw new error_handler_1.AppError(400, 'NOT_ARCHIVED', 'Organization is not archived');
        }
        // Restore the org
        const org = await prisma_1.prisma.organization.update({
            where: { id: req.params.id },
            data: {
                status: 'active',
                archivedAt: null,
            },
        });
        // Restore all sites (but not users - they need to be activated individually)
        await prisma_1.prisma.site.updateMany({
            where: { orgId: req.params.id },
            data: {
                status: 'active',
                archivedAt: null,
            },
        });
        // Set users to inactive (not active) - admin needs to reactivate them
        await prisma_1.prisma.user.updateMany({
            where: { orgId: req.params.id, status: 'archived' },
            data: {
                status: 'inactive',
                archivedAt: null,
            },
        });
        await (0, audit_1.auditLog)({
            orgId: org.id,
            actorUserId: req.user.id,
            action: 'restore',
            entityType: 'organization',
            entityId: org.id,
            metadata: { statusBefore: existing.status, statusAfter: 'active', archivedAt: null },
            req,
        });
        res.json(org);
    }
    catch (error) {
        next(error);
    }
});
// Permanently delete organization
// Only allowed for archived orgs with no records, or if confirmed
exports.organizationsRouter.delete('/:id', async (req, res, next) => {
    try {
        const { confirm } = req.query;
        const existing = await prisma_1.prisma.organization.findUnique({
            where: { id: req.params.id },
            include: {
                _count: { select: { users: true, countRecords: true } },
            },
        });
        if (!existing) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'Organization not found');
        }
        if (existing.slug === 'system') {
            throw new error_handler_1.AppError(403, 'FORBIDDEN', 'Cannot delete system organization');
        }
        // If org has records, require explicit confirmation
        if (existing._count.countRecords > 0 && confirm !== 'true') {
            throw new error_handler_1.AppError(400, 'HAS_RECORDS', `Organization has ${existing._count.countRecords} records. Add ?confirm=true to permanently delete.`);
        }
        // Warn if not archived first
        if (existing.status !== 'archived' && confirm !== 'true') {
            throw new error_handler_1.AppError(400, 'NOT_ARCHIVED', 'Organization should be archived before permanent deletion. Add ?confirm=true to delete anyway.');
        }
        // Log before deletion
        await (0, audit_1.auditLog)({
            orgId: existing.id,
            actorUserId: req.user.id,
            action: 'delete',
            entityType: 'organization',
            entityId: existing.id,
            metadata: { record: existing, counts: existing._count },
            req,
        });
        // Cascade delete will handle users, sites, records
        await prisma_1.prisma.organization.delete({
            where: { id: req.params.id },
        });
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JnYW5pemF0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9yb3V0ZXMvc3VwZXJhZG1pbi9vcmdhbml6YXRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFDQUFrRTtBQUNsRSw2Q0FBMEM7QUFDMUMsa0VBQTBEO0FBQzFELGdEQUFnRDtBQUNoRCxvREFBNEQ7QUFDNUQsaURBQTBGO0FBRTdFLFFBQUEsbUJBQW1CLEdBQUcsSUFBQSxnQkFBTSxHQUFFLENBQUM7QUFFNUMsZ0RBQWdEO0FBQ2hELDJCQUFtQixDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLEdBQVksRUFBRSxHQUFhLEVBQUUsSUFBa0IsRUFBRSxFQUFFO0lBQ3JGLElBQUksQ0FBQztRQUNILE1BQU0sYUFBYSxHQUFHLE1BQU0sZUFBTSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUM7WUFDdkQsS0FBSyxFQUFFO2dCQUNMLElBQUksRUFBRSxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUUsRUFBRSxzQkFBc0I7YUFDaEQ7WUFDRCxPQUFPLEVBQUU7Z0JBQ1AsS0FBSyxFQUFFLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEVBQUU7Z0JBQzNDLEtBQUssRUFBRTtvQkFDTCxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFO29CQUN4QixNQUFNLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRTtpQkFDOUM7Z0JBQ0QsTUFBTSxFQUFFO29CQUNOLE1BQU0sRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRTtpQkFDckM7YUFDRjtZQUNELE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUU7U0FDekIsQ0FBQyxDQUFDO1FBRUgs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QUN2RCxHQUFHO1NBQ0osQ0FBQyxDQUFDO1FBRUgsbURBQW1EO1FBQ25ELE1BQU0sZUFBTSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUM7WUFDL0IsS0FBSyxFQUFFLEVBQUUsRUFBRSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFO1NBQzdCLENBQUMsQ0FBQztRQUVILEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDekIsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDZCxDQUFDO0FBQ0gsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBSb3V0ZXIsIFJlcXVlc3QsIFJlc3BvbnNlLCBOZXh0RnVuY3Rpb24gfSBmcm9tICdleHByZXNzJztcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gJy4uLy4uL2xpYi9wcmlzbWEnO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tICcuLi8uLi9taWRkbGV3YXJlL2Vycm9yLWhhbmRsZXInO1xuaW1wb3J0IHsgYXVkaXRMb2cgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9hdWRpdCc7XG5pbXBvcnQgeyBkaXNhYmxlQ29nbml0b1VzZXIgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9jb2duaXRvJztcbmltcG9ydCB7IENyZWF0ZU9yZ2FuaXphdGlvblNjaGVtYSwgVXBkYXRlT3JnYW5pemF0aW9uU2NoZW1hIH0gZnJvbSAnQGxhYi1jb3VudGVycy9zaGFyZWQnO1xuXG5leHBvcnQgY29uc3Qgb3JnYW5pemF0aW9uc1JvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBMaXN0IGFsbCBvcmdhbml6YXRpb25zIChleGNsdWRpbmcgc3lzdGVtIG9yZylcbm9yZ2FuaXphdGlvbnNSb3V0ZXIuZ2V0KCcvJywgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3Qgb3JnYW5pemF0aW9ucyA9IGF3YWl0IHByaXNtYS5vcmdhbml6YXRpb24uZmluZE1hbnkoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgc2x1ZzogeyBub3Q6ICdzeXN0ZW0nIH0sIC8vIEhpZGUgdGhlIHN5c3RlbSBvcmdcbiAgICAgIH0sXG4gICAgICBpbmNsdWRlOiB7XG4gICAgICAgIHNpdGVzOiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSB9IH0sXG4gICAgICAgIHVzZXJzOiB7XG4gICAgICAgICAgd2hlcmU6IHsgcm9sZTogJ2FkbWluJyB9LFxuICAgICAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSwgZW1haWw6IHRydWUgfSxcbiAgICAgICAgfSxcbiAgICAgICAgX2NvdW50OiB7XG4gICAgICAgICAgc2VsZWN0OiB7IHVzZXJzOiB0cnVlLCBzaXRlczogdHJ1ZSB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIG9yZGVyQnk6IHsgbmFtZTogJ2FzYycgfSxcbiAgICB9KTtcblxuICAgIHJlcy5qc29uKG9yZ2FuaXphdGlvbnMpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIG5leHQoZXJyb3IpO1xuICB9XG59KTtcblxuLy8gR2V0IHNpbmdsZSBvcmdhbml6YXRpb24gd2l0aCBkZXRhaWxzXG5vcmdhbml6YXRpb25zUm91dGVyLmdldCgnLzppZCcsIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IG9yZyA9IGF3YWl0IHByaXNtYS5vcmdhbml6YXRpb24uZmluZFVuaXF1ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcmVxLnBhcmFtcy5pZCB9LFxuICAgICAgaW5jbHVkZToge1xuICAgICAgICBzaXRlczoge1xuICAgICAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgICAgIF9jb3VudDogeyBzZWxlY3Q6IHsgdXNlcnM6IHRydWUgfSB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgb3JkZXJCeTogeyBuYW1lOiAnYXNjJyB9LFxuICAgICAgICB9LFxuICAgICAgICB1c2Vyczoge1xuICAgICAgICAgIHNlbGVjdDoge1xuICAgICAgICAgICAgaWQ6IHRydWUsXG4gICAgICAgICAgICBuYW1lOiB0cnVlLFxuICAgICAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICAgICAgICByb2xlOiB0cnVlLFxuICAgICAgICAgICAgc3RhdHVzOiB0cnVlLFxuICAgICAgICAgICAgc2l0ZTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUgfSB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgb3JkZXJCeTogeyBuYW1lOiAnYXNjJyB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGlmICghb3JnKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCAnTk9UX0ZPVU5EJywgJ09yZ2FuaXphdGlvbiBub3QgZm91bmQnKTtcbiAgICB9XG5cbiAgICBpZiAob3JnLnNsdWcgPT09ICdzeXN0ZW0nKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAzLCAnRk9SQklEREVOJywgJ0Nhbm5vdCBhY2Nlc3Mgc3lzdGVtIG9yZ2FuaXphdGlvbicpO1xuICAgIH1cblxuICAgIHJlcy5qc29uKG9yZyk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbmV4dChlcnJvcik7XG4gIH1cbn0pO1xuXG4vLyBDcmVhdGUgb3JnYW5pemF0aW9uXG5vcmdhbml6YXRpb25zUm91dGVyLnBvc3QoJy8nLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBib2R5ID0gQ3JlYXRlT3JnYW5pemF0aW9uU2NoZW1hLnBhcnNlKHJlcS5ib2R5KTtcblxuICAgIC8vIENoZWNrIHNsdWcgdW5pcXVlbmVzc1xuICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLm9yZ2FuaXphdGlvbi5maW5kVW5pcXVlKHtcbiAgICAgIHdoZXJlOiB7IHNsdWc6IGJvZHkuc2x1ZyB9LFxuICAgIH0pO1xuXG4gICAgaWYgKGV4aXN0aW5nKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCAnU0xVR19FWElTVFMnLCAnQW4gb3JnYW5pemF0aW9uIHdpdGggdGhpcyBzbHVnIGFscmVhZHkgZXhpc3RzJyk7XG4gICAgfVxuXG4gICAgLy8gUHJldmVudCBjcmVhdGluZyBvcmcgd2l0aCByZXNlcnZlZCBzbHVnXG4gICAgaWYgKGJvZHkuc2x1ZyA9PT0gJ3N5c3RlbScpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsICdSRVNFUlZFRF9TTFVHJywgJ1RoaXMgc2x1ZyBpcyByZXNlcnZlZCcpO1xuICAgIH1cblxuICAgIGNvbnN0IGRlZmF1bHRTZXR0aW5ncyA9IHtcbiAgICAgIHRpbWV6b25lOiAnQW1lcmljYS9OZXdfWW9yaycsXG4gICAgICBkZWZhdWx0RGlsdXRpb246IDEwLFxuICAgICAgcmVxdWlyZVZlcmlmaWNhdGlvbjogdHJ1ZSxcbiAgICAgIGFsbG93U2VsZlZlcmlmaWNhdGlvbjogZmFsc2UsXG4gICAgfTtcblxuICAgIGNvbnN0IG9yZyA9IGF3YWl0IHByaXNtYS5vcmdhbml6YXRpb24uY3JlYXRlKHtcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgbmFtZTogYm9keS5uYW1lLFxuICAgICAgICBzbHVnOiBib2R5LnNsdWcsXG4gICAgICAgIHNldHRpbmdzOiB7IC4uLmRlZmF1bHRTZXR0aW5ncywgLi4uYm9keS5zZXR0aW5ncyB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGF3YWl0IGF1ZGl0TG9nKHtcbiAgICAgIG9yZ0lkOiBvcmcuaWQsXG4gICAgICBhY3RvclVzZXJJZDogcmVxLnVzZXIhLmlkLFxuICAgICAgYWN0aW9uOiAnY3JlYXRlJyxcbiAgICAgIGVudGl0eVR5cGU6ICdvcmdhbml6YXRpb24nLFxuICAgICAgZW50aXR5SWQ6IG9yZy5pZCxcbiAgICAgIG1ldGFkYXRhOiB7IHJlY29yZDogb3JnIH0sXG4gICAgICByZXEsXG4gICAgfSk7XG5cbiAgICByZXMuc3RhdHVzKDIwMSkuanNvbihvcmcpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIG5leHQoZXJyb3IpO1xuICB9XG59KTtcblxuLy8gVXBkYXRlIG9yZ2FuaXphdGlvblxub3JnYW5pemF0aW9uc1JvdXRlci5wYXRjaCgnLzppZCcsIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGJvZHkgPSBVcGRhdGVPcmdhbml6YXRpb25TY2hlbWEucGFyc2UocmVxLmJvZHkpO1xuXG4gICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcmlzbWEub3JnYW5pemF0aW9uLmZpbmRVbmlxdWUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHJlcS5wYXJhbXMuaWQgfSxcbiAgICB9KTtcblxuICAgIGlmICghZXhpc3RpbmcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsICdOT1RfRk9VTkQnLCAnT3JnYW5pemF0aW9uIG5vdCBmb3VuZCcpO1xuICAgIH1cblxuICAgIGlmIChleGlzdGluZy5zbHVnID09PSAnc3lzdGVtJykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgJ0ZPUkJJRERFTicsICdDYW5ub3QgbW9kaWZ5IHN5c3RlbSBvcmdhbml6YXRpb24nKTtcbiAgICB9XG5cbiAgICBjb25zdCB1cGRhdGVEYXRhOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHt9O1xuICAgIGlmIChib2R5Lm5hbWUpIHVwZGF0ZURhdGEubmFtZSA9IGJvZHkubmFtZTtcbiAgICBpZiAoYm9keS5zZXR0aW5ncykge1xuICAgICAgdXBkYXRlRGF0YS5zZXR0aW5ncyA9IHsgLi4uKGV4aXN0aW5nLnNldHRpbmdzIGFzIG9iamVjdCksIC4uLmJvZHkuc2V0dGluZ3MgfTtcbiAgICB9XG5cbiAgICBjb25zdCBvcmcgPSBhd2FpdCBwcmlzbWEub3JnYW5pemF0aW9uLnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcmVxLnBhcmFtcy5pZCB9LFxuICAgICAgZGF0YTogdXBkYXRlRGF0YSxcbiAgICB9KTtcblxuICAgIGF3YWl0IGF1ZGl0TG9nKHtcbiAgICAgIG9yZ0lkOiBvcmcuaWQsXG4gICAgICBhY3RvclVzZXJJZDogcmVxLnVzZXIhLmlkLFxuICAgICAgYWN0aW9uOiAndXBkYXRlJyxcbiAgICAgIGVudGl0eVR5cGU6ICdvcmdhbml6YXRpb24nLFxuICAgICAgZW50aXR5SWQ6IG9yZy5pZCxcbiAgICAgIG1ldGFkYXRhOiB7IGJlZm9yZTogZXhpc3RpbmcsIGFmdGVyOiBvcmcgfSxcbiAgICAgIHJlcSxcbiAgICB9KTtcblxuICAgIHJlcy5qc29uKG9yZyk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbmV4dChlcnJvcik7XG4gIH1cbn0pO1xuXG4vLyBDaGFuZ2Ugb3JnYW5pemF0aW9uIHN0YXR1cyAoYWN0aXZlL2luYWN0aXZlKVxub3JnYW5pemF0aW9uc1JvdXRlci5wYXRjaCgnLzppZC9zdGF0dXMnLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHN0YXR1cyB9ID0gcmVxLmJvZHk7XG5cbiAgICBpZiAoIXN0YXR1cyB8fCAhWydhY3RpdmUnLCAnaW5hY3RpdmUnXS5pbmNsdWRlcyhzdGF0dXMpKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCAnSU5WQUxJRF9TVEFUVVMnLCAnU3RhdHVzIG11c3QgYmUgYWN0aXZlIG9yIGluYWN0aXZlJyk7XG4gICAgfVxuXG4gICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcmlzbWEub3JnYW5pemF0aW9uLmZpbmRVbmlxdWUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHJlcS5wYXJhbXMuaWQgfSxcbiAgICB9KTtcblxuICAgIGlmICghZXhpc3RpbmcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsICdOT1RfRk9VTkQnLCAnT3JnYW5pemF0aW9uIG5vdCBmb3VuZCcpO1xuICAgIH1cblxuICAgIGlmIChleGlzdGluZy5zbHVnID09PSAnc3lzdGVtJykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgJ0ZPUkJJRERFTicsICdDYW5ub3QgbW9kaWZ5IHN5c3RlbSBvcmdhbml6YXRpb24nKTtcbiAgICB9XG5cbiAgICBpZiAoZXhpc3Rpbmcuc3RhdHVzID09PSAnYXJjaGl2ZWQnKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCAnQVJDSElWRUQnLCAnQ2Fubm90IGNoYW5nZSBzdGF0dXMgb2YgYXJjaGl2ZWQgb3JnYW5pemF0aW9uLiBSZXN0b3JlIGl0IGZpcnN0LicpO1xuICAgIH1cblxuICAgIGNvbnN0IG9yZyA9IGF3YWl0IHByaXNtYS5vcmdhbml6YXRpb24udXBkYXRlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiByZXEucGFyYW1zLmlkIH0sXG4gICAgICBkYXRhOiB7IHN0YXR1cyB9LFxuICAgIH0pO1xuXG4gICAgLy8gSWYgZGVhY3RpdmF0aW5nLCBhbHNvIGRlYWN0aXZhdGUgYWxsIHVzZXJzXG4gICAgaWYgKHN0YXR1cyA9PT0gJ2luYWN0aXZlJykge1xuICAgICAgYXdhaXQgcHJpc21hLnVzZXIudXBkYXRlTWFueSh7XG4gICAgICAgIHdoZXJlOiB7IG9yZ0lkOiByZXEucGFyYW1zLmlkLCBzdGF0dXM6ICdhY3RpdmUnIH0sXG4gICAgICAgIGRhdGE6IHsgc3RhdHVzOiAnaW5hY3RpdmUnIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAnZGV2ZWxvcG1lbnQnKSB7XG4gICAgICAgIGNvbnN0IHVzZXJzVG9EaXNhYmxlID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZE1hbnkoe1xuICAgICAgICAgIHdoZXJlOiB7IG9yZ0lkOiByZXEucGFyYW1zLmlkLCB1c2VybmFtZTogeyBub3Q6IG51bGwgfSB9LFxuICAgICAgICAgIHNlbGVjdDogeyB1c2VybmFtZTogdHJ1ZSB9LFxuICAgICAgICB9KTtcbiAgICAgICAgZm9yIChjb25zdCB1c2VyIG9mIHVzZXJzVG9EaXNhYmxlKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IGRpc2FibGVDb2duaXRvVXNlcih1c2VyLnVzZXJuYW1lISk7XG4gICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ0ZhaWxlZCB0byBkaXNhYmxlIENvZ25pdG8gdXNlcjonLCBlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGF3YWl0IGF1ZGl0TG9nKHtcbiAgICAgIG9yZ0lkOiBvcmcuaWQsXG4gICAgICBhY3RvclVzZXJJZDogcmVxLnVzZXIhLmlkLFxuICAgICAgYWN0aW9uOiAndXBkYXRlJyxcbiAgICAgIGVudGl0eVR5cGU6ICdvcmdhbml6YXRpb24nLFxuICAgICAgZW50aXR5SWQ6IG9yZy5pZCxcbiAgICAgIG1ldGFkYXRhOiB7IHN0YXR1c0JlZm9yZTogZXhpc3Rpbmcuc3RhdHVzLCBzdGF0dXNBZnRlcjogb3JnLnN0YXR1cyB9LFxuICAgICAgcmVxLFxuICAgIH0pO1xuXG4gICAgcmVzLmpzb24ob3JnKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBuZXh0KGVycm9yKTtcbiAgfVxufSk7XG5cbi8vIEFyY2hpdmUgb3JnYW5pemF0aW9uIChzb2Z0IGRlbGV0ZSAtIGNhbiBiZSByZXN0b3JlZClcbm9yZ2FuaXphdGlvbnNSb3V0ZXIucG9zdCgnLzppZC9hcmNoaXZlJywgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcmlzbWEub3JnYW5pemF0aW9uLmZpbmRVbmlxdWUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHJlcS5wYXJhbXMuaWQgfSxcbiAgICB9KTtcblxuICAgIGlmICghZXhpc3RpbmcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsICdOT1RfRk9VTkQnLCAnT3JnYW5pemF0aW9uIG5vdCBmb3VuZCcpO1xuICAgIH1cblxuICAgIGlmIChleGlzdGluZy5zbHVnID09PSAnc3lzdGVtJykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMywgJ0ZPUkJJRERFTicsICdDYW5ub3QgYXJjaGl2ZSBzeXN0ZW0gb3JnYW5pemF0aW9uJyk7XG4gICAgfVxuXG4gICAgaWYgKGV4aXN0aW5nLnN0YXR1cyA9PT0gJ2FyY2hpdmVkJykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgJ0FMUkVBRFlfQVJDSElWRUQnLCAnT3JnYW5pemF0aW9uIGlzIGFscmVhZHkgYXJjaGl2ZWQnKTtcbiAgICB9XG5cbiAgICAvLyBBcmNoaXZlIHRoZSBvcmdcbiAgICBjb25zdCBvcmcgPSBhd2FpdCBwcmlzbWEub3JnYW5pemF0aW9uLnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcmVxLnBhcmFtcy5pZCB9LFxuICAgICAgZGF0YToge1xuICAgICAgICBzdGF0dXM6ICdhcmNoaXZlZCcsXG4gICAgICAgIGFyY2hpdmVkQXQ6IG5ldyBEYXRlKCksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQXJjaGl2ZSBhbGwgdXNlcnMgaW4gdGhlIG9yZ1xuICAgIGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZU1hbnkoe1xuICAgICAgd2hlcmU6IHsgb3JnSWQ6IHJlcS5wYXJhbXMuaWQgfSxcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgc3RhdHVzOiAnYXJjaGl2ZWQnLFxuICAgICAgICBhcmNoaXZlZEF0OiBuZXcgRGF0ZSgpLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ2RldmVsb3BtZW50Jykge1xuICAgICAgY29uc3QgdXNlcnNUb0Rpc2FibGUgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kTWFueSh7XG4gICAgICAgIHdoZXJlOiB7IG9yZ0lkOiByZXEucGFyYW1zLmlkLCB1c2VybmFtZTogeyBub3Q6IG51bGwgfSB9LFxuICAgICAgICBzZWxlY3Q6IHsgdXNlcm5hbWU6IHRydWUgfSxcbiAgICAgIH0pO1xuICAgICAgZm9yIChjb25zdCB1c2VyIG9mIHVzZXJzVG9EaXNhYmxlKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYXdhaXQgZGlzYWJsZUNvZ25pdG9Vc2VyKHVzZXIudXNlcm5hbWUhKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKCdGYWlsZWQgdG8gZGlzYWJsZSBDb2duaXRvIHVzZXI6JywgZXJyKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEFyY2hpdmUgYWxsIHNpdGVzIGluIHRoZSBvcmdcbiAgICBhd2FpdCBwcmlzbWEuc2l0ZS51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IG9yZ0lkOiByZXEucGFyYW1zLmlkIH0sXG4gICAgICBkYXRhOiB7XG4gICAgICAgIHN0YXR1czogJ2FyY2hpdmVkJyxcbiAgICAgICAgYXJjaGl2ZWRBdDogbmV3IERhdGUoKSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBhd2FpdCBhdWRpdExvZyh7XG4gICAgICBvcmdJZDogb3JnLmlkLFxuICAgICAgYWN0b3JVc2VySWQ6IHJlcS51c2VyIS5pZCxcbiAgICAgIGFjdGlvbjogJ2FyY2hpdmUnLFxuICAgICAgZW50aXR5VHlwZTogJ29yZ2FuaXphdGlvbicsXG4gICAgICBlbnRpdHlJZDogb3JnLmlkLFxuICAgICAgbWV0YWRhdGE6IHsgc3RhdHVzQmVmb3JlOiBleGlzdGluZy5zdGF0dXMsIHN0YXR1c0FmdGVyOiAnYXJjaGl2ZWQnLCBhcmNoaXZlZEF0OiBvcmcuYXJjaGl2ZWRBdCB9LFxuICAgICAgcmVxLFxuICAgIH0pO1xuXG4gICAgcmVzLmpzb24ob3JnKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBuZXh0KGVycm9yKTtcbiAgfVxufSk7XG5cbi8vIFJlc3RvcmUgYXJjaGl2ZWQgb3JnYW5pemF0aW9uXG5vcmdhbml6YXRpb25zUm91dGVyLnBvc3QoJy86aWQvcmVzdG9yZScsIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLm9yZ2FuaXphdGlvbi5maW5kVW5pcXVlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiByZXEucGFyYW1zLmlkIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIWV4aXN0aW5nKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCAnTk9UX0ZPVU5EJywgJ09yZ2FuaXphdGlvbiBub3QgZm91bmQnKTtcbiAgICB9XG5cbiAgICBpZiAoZXhpc3Rpbmcuc3RhdHVzICE9PSAnYXJjaGl2ZWQnKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCAnTk9UX0FSQ0hJVkVEJywgJ09yZ2FuaXphdGlvbiBpcyBub3QgYXJjaGl2ZWQnKTtcbiAgICB9XG5cbiAgICAvLyBSZXN0b3JlIHRoZSBvcmdcbiAgICBjb25zdCBvcmcgPSBhd2FpdCBwcmlzbWEub3JnYW5pemF0aW9uLnVwZGF0ZSh7XG4gICAgICB3aGVyZTogeyBpZDogcmVxLnBhcmFtcy5pZCB9LFxuICAgICAgZGF0YToge1xuICAgICAgICBzdGF0dXM6ICdhY3RpdmUnLFxuICAgICAgICBhcmNoaXZlZEF0OiBudWxsLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFJlc3RvcmUgYWxsIHNpdGVzIChidXQgbm90IHVzZXJzIC0gdGhleSBuZWVkIHRvIGJlIGFjdGl2YXRlZCBpbmRpdmlkdWFsbHkpXG4gICAgYXdhaXQgcHJpc21hLnNpdGUudXBkYXRlTWFueSh7XG4gICAgICB3aGVyZTogeyBvcmdJZDogcmVxLnBhcmFtcy5pZCB9LFxuICAgICAgZGF0YToge1xuICAgICAgICBzdGF0dXM6ICdhY3RpdmUnLFxuICAgICAgICBhcmNoaXZlZEF0OiBudWxsLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFNldCB1c2VycyB0byBpbmFjdGl2ZSAobm90IGFjdGl2ZSkgLSBhZG1pbiBuZWVkcyB0byByZWFjdGl2YXRlIHRoZW1cbiAgICBhd2FpdCBwcmlzbWEudXNlci51cGRhdGVNYW55KHtcbiAgICAgIHdoZXJlOiB7IG9yZ0lkOiByZXEucGFyYW1zLmlkLCBzdGF0dXM6ICdhcmNoaXZlZCcgfSxcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgc3RhdHVzOiAnaW5hY3RpdmUnLFxuICAgICAgICBhcmNoaXZlZEF0OiBudWxsLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGF3YWl0IGF1ZGl0TG9nKHtcbiAgICAgIG9yZ0lkOiBvcmcuaWQsXG4gICAgICBhY3RvclVzZXJJZDogcmVxLnVzZXIhLmlkLFxuICAgICAgYWN0aW9uOiAncmVzdG9yZScsXG4gICAgICBlbnRpdHlUeXBlOiAnb3JnYW5pemF0aW9uJyxcbiAgICAgIGVudGl0eUlkOiBvcmcuaWQsXG4gICAgICBtZXRhZGF0YTogeyBzdGF0dXNCZWZvcmU6IGV4aXN0aW5nLnN0YXR1cywgc3RhdHVzQWZ0ZXI6ICdhY3RpdmUnLCBhcmNoaXZlZEF0OiBudWxsIH0sXG4gICAgICByZXEsXG4gICAgfSk7XG5cbiAgICByZXMuanNvbihvcmcpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIG5leHQoZXJyb3IpO1xuICB9XG59KTtcblxuLy8gUGVybWFuZW50bHkgZGVsZXRlIG9yZ2FuaXphdGlvblxuLy8gT25seSBhbGxvd2VkIGZvciBhcmNoaXZlZCBvcmdzIHdpdGggbm8gcmVjb3Jkcywgb3IgaWYgY29uZmlybWVkXG5vcmdhbml6YXRpb25zUm91dGVyLmRlbGV0ZSgnLzppZCcsIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgY29uZmlybSB9ID0gcmVxLnF1ZXJ5O1xuXG4gICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcmlzbWEub3JnYW5pemF0aW9uLmZpbmRVbmlxdWUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHJlcS5wYXJhbXMuaWQgfSxcbiAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgX2NvdW50OiB7IHNlbGVjdDogeyB1c2VyczogdHJ1ZSwgY291bnRSZWNvcmRzOiB0cnVlIH0gfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIWV4aXN0aW5nKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCAnTk9UX0ZPVU5EJywgJ09yZ2FuaXphdGlvbiBub3QgZm91bmQnKTtcbiAgICB9XG5cbiAgICBpZiAoZXhpc3Rpbmcuc2x1ZyA9PT0gJ3N5c3RlbScpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsICdGT1JCSURERU4nLCAnQ2Fubm90IGRlbGV0ZSBzeXN0ZW0gb3JnYW5pemF0aW9uJyk7XG4gICAgfVxuXG4gICAgLy8gSWYgb3JnIGhhcyByZWNvcmRzLCByZXF1aXJlIGV4cGxpY2l0IGNvbmZpcm1hdGlvblxuICAgIGlmIChleGlzdGluZy5fY291bnQuY291bnRSZWNvcmRzID4gMCAmJiBjb25maXJtICE9PSAndHJ1ZScpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsICdIQVNfUkVDT1JEUycsXG4gICAgICAgIGBPcmdhbml6YXRpb24gaGFzICR7ZXhpc3RpbmcuX2NvdW50LmNvdW50UmVjb3Jkc30gcmVjb3Jkcy4gQWRkID9jb25maXJtPXRydWUgdG8gcGVybWFuZW50bHkgZGVsZXRlLmApO1xuICAgIH1cblxuICAgIC8vIFdhcm4gaWYgbm90IGFyY2hpdmVkIGZpcnN0XG4gICAgaWYgKGV4aXN0aW5nLnN0YXR1cyAhPT0gJ2FyY2hpdmVkJyAmJiBjb25maXJtICE9PSAndHJ1ZScpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsICdOT1RfQVJDSElWRUQnLFxuICAgICAgICAnT3JnYW5pemF0aW9uIHNob3VsZCBiZSBhcmNoaXZlZCBiZWZvcmUgcGVybWFuZW50IGRlbGV0aW9uLiBBZGQgP2NvbmZpcm09dHJ1ZSB0byBkZWxldGUgYW55d2F5LicpO1xuICAgIH1cblxuICAgIC8vIExvZyBiZWZvcmUgZGVsZXRpb25cbiAgICBhd2FpdCBhdWRpdExvZyh7XG4gICAgICBvcmdJZDogZXhpc3RpbmcuaWQsXG4gICAgICBhY3RvclVzZXJJZDogcmVxLnVzZXIhLmlkLFxuICAgICAgYWN0aW9uOiAnZGVsZXRlJyxcbiAgICAgIGVudGl0eVR5cGU6ICdvcmdhbml6YXRpb24nLFxuICAgICAgZW50aXR5SWQ6IGV4aXN0aW5nLmlkLFxuICAgICAgbWV0YWRhdGE6IHsgcmVjb3JkOiBleGlzdGluZywgY291bnRzOiBleGlzdGluZy5fY291bnQgfSxcbiAgICAgIHJlcSxcbiAgICB9KTtcblxuICAgIC8vIENhc2NhZGUgZGVsZXRlIHdpbGwgaGFuZGxlIHVzZXJzLCBzaXRlcywgcmVjb3Jkc1xuICAgIGF3YWl0IHByaXNtYS5vcmdhbml6YXRpb24uZGVsZXRlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiByZXEucGFyYW1zLmlkIH0sXG4gICAgfSk7XG5cbiAgICByZXMuc3RhdHVzKDIwNCkuc2VuZCgpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIG5leHQoZXJyb3IpO1xuICB9XG59KTtcbiJdfQ==