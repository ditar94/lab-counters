"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../../lib/prisma");
const error_handler_1 = require("../../middleware/error-handler");
const audit_1 = require("../../services/audit");
const cognito_1 = require("../../services/cognito");
const shared_1 = require("@lab-counters/shared");
const passwords_1 = require("../../lib/passwords");
const usernames_1 = require("../../lib/usernames");
exports.usersRouter = (0, express_1.Router)({ mergeParams: true }); // To access :orgId from parent
// List users in an organization
exports.usersRouter.get('/', async (req, res, next) => {
    try {
        const { orgId } = req.params;
        // Verify org exists
        const org = await prisma_1.prisma.organization.findUnique({
            where: { id: orgId },
        });
        if (!org) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'Organization not found');
        }
        if (org.slug === 'system') {
            throw new error_handler_1.AppError(403, 'FORBIDDEN', 'Cannot access system organization users');
        }
        const users = await prisma_1.prisma.user.findMany({
            where: { orgId },
            include: {
                site: { select: { id: true, name: true } },
            },
            orderBy: { name: 'asc' },
        });
        res.json(users);
    }
    catch (error) {
        next(error);
    }
});
// Create org admin (initial admin for an organization)
exports.usersRouter.post('/', async (req, res, next) => {
    try {
        const { orgId } = req.params;
        const body = shared_1.CreateOrgAdminSchema.parse(req.body);
        // Verify org exists
        const org = await prisma_1.prisma.organization.findUnique({
            where: { id: orgId },
        });
        if (!org) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'Organization not found');
        }
        if (org.slug === 'system') {
            throw new error_handler_1.AppError(403, 'FORBIDDEN', 'Cannot add users to system organization');
        }
        const siteIdsToAssign = body.siteIds ?? [body.siteId];
        if (!siteIdsToAssign.includes(body.siteId)) {
            throw new error_handler_1.AppError(400, 'INVALID_SITE', 'Primary site must be in assigned sites');
        }
        // Verify all sites belong to org
        const sites = await prisma_1.prisma.site.findMany({
            where: {
                id: { in: siteIdsToAssign },
                orgId,
            },
            select: { id: true },
        });
        if (sites.length !== siteIdsToAssign.length) {
            throw new error_handler_1.AppError(400, 'INVALID_SITE', 'One or more sites not found in this organization');
        }
        // Check if email already exists in org
        const existingUser = await prisma_1.prisma.user.findFirst({
            where: { orgId, email: body.email },
        });
        if (existingUser) {
            throw new error_handler_1.AppError(400, 'EMAIL_EXISTS', 'A user with this email already exists in this organization');
        }
        const baseUsername = (0, usernames_1.buildUsernameBase)(body.name);
        let candidateUsername = body.username;
        if (!candidateUsername) {
            let suffix = 0;
            while (true) {
                const possible = (0, usernames_1.buildUsernameCandidate)(baseUsername, suffix);
                const existingUsername = await prisma_1.prisma.user.findFirst({
                    where: { username: possible },
                    select: { id: true },
                });
                if (!existingUsername) {
                    candidateUsername = possible;
                    break;
                }
                suffix += 1;
            }
        }
        else {
            const existingUsername = await prisma_1.prisma.user.findFirst({
                where: { username: candidateUsername },
            });
            if (existingUsername) {
                throw new error_handler_1.AppError(400, 'USERNAME_EXISTS', 'A user with this username already exists');
            }
        }
        const tempPassword = body.temporaryPassword || (body.generateTemporaryPassword ? (0, passwords_1.generateTemporaryPassword)() : undefined);
        const suppressEmail = !!tempPassword;
        // Create user in Cognito first
        let cognitoResult;
        if (!candidateUsername) {
            throw new error_handler_1.AppError(400, 'INVALID_USERNAME', 'Unable to generate username');
        }
        let suffix = 0;
        while (true) {
            if (!body.username) {
                const existingUsername = await prisma_1.prisma.user.findFirst({
                    where: { username: candidateUsername },
                    select: { id: true },
                });
                if (existingUsername) {
                    suffix += 1;
                    candidateUsername = (0, usernames_1.buildUsernameCandidate)(baseUsername, suffix);
                    continue;
                }
            }
            try {
                cognitoResult = await (0, cognito_1.createCognitoUser)({
                    username: candidateUsername,
                    email: body.email,
                    name: body.name,
                    temporaryPassword: tempPassword,
                    suppressEmail,
                });
                break;
            }
            catch (error) {
                if (!body.username && error instanceof cognito_1.CognitoError && error.code === 'USERNAME_EXISTS') {
                    suffix += 1;
                    candidateUsername = (0, usernames_1.buildUsernameCandidate)(baseUsername, suffix);
                    continue;
                }
                if (error instanceof cognito_1.CognitoError) {
                    throw new error_handler_1.AppError(400, error.code, error.message);
                }
                throw error;
            }
        }
        // Create user in database with Cognito ID
        const user = await prisma_1.prisma.user.create({
            data: {
                cognitoId: cognitoResult.cognitoId,
                username: candidateUsername,
                email: body.email,
                name: body.name,
                orgId,
                siteId: body.siteId,
                role: 'admin', // Superadmin creates org admins
                status: 'pending', // Will be activated when user sets password
                sites: {
                    create: siteIdsToAssign.map((siteId) => ({ siteId })),
                },
            },
            include: {
                site: { select: { id: true, name: true } },
                organization: { select: { id: true, name: true } },
            },
        });
        await (0, audit_1.auditLog)({
            orgId,
            actorUserId: req.user.id,
            action: 'create',
            entityType: 'user',
            entityId: user.id,
            metadata: { record: user },
            req,
        });
        res.status(201).json({
            ...user,
            ...(tempPassword ? { temporaryPassword: tempPassword } : {}),
        });
    }
    catch (error) {
        next(error);
    }
});
// Get single user
exports.usersRouter.get('/:userId', async (req, res, next) => {
    try {
        const { orgId, userId } = req.params;
        const user = await prisma_1.prisma.user.findFirst({
            where: { id: userId, orgId },
            include: {
                site: { select: { id: true, name: true } },
                sites: {
                    include: { site: { select: { id: true, name: true } } },
                },
                _count: { select: { performedRecords: true, verifiedRecords: true } },
            },
        });
        if (!user) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'User not found');
        }
        res.json(user);
    }
    catch (error) {
        next(error);
    }
});
// Update user status (activate/deactivate)
exports.usersRouter.patch('/:userId/status', async (req, res, next) => {
    try {
        const { orgId, userId } = req.params;
        const { status } = req.body;
        if (!status || !['active', 'inactive'].includes(status)) {
            throw new error_handler_1.AppError(400, 'INVALID_STATUS', 'Status must be active or inactive');
        }
        const existing = await prisma_1.prisma.user.findFirst({
            where: { id: userId, orgId },
        });
        if (!existing) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'User not found');
        }
        // Don't allow status change on superadmins
        if (existing.role === 'superadmin') {
            throw new error_handler_1.AppError(403, 'FORBIDDEN', 'Cannot change status of superadmin users');
        }
        if (existing.status === 'archived') {
            throw new error_handler_1.AppError(400, 'ARCHIVED', 'Cannot change status of archived user. Restore it first.');
        }
        const user = await prisma_1.prisma.user.update({
            where: { id: userId },
            data: { status },
            include: {
                site: { select: { id: true, name: true } },
            },
        });
        if (existing.username && process.env.NODE_ENV !== 'development') {
            try {
                if (status === 'inactive') {
                    await (0, cognito_1.disableCognitoUser)(existing.username);
                }
                else if (status === 'active') {
                    await (0, cognito_1.enableCognitoUser)(existing.username);
                }
            }
            catch (err) {
                console.warn('Failed to update Cognito user status:', err);
            }
        }
        await (0, audit_1.auditLog)({
            orgId,
            actorUserId: req.user.id,
            action: 'update',
            entityType: 'user',
            entityId: user.id,
            metadata: { statusBefore: existing.status, statusAfter: user.status },
            req,
        });
        res.json(user);
    }
    catch (error) {
        next(error);
    }
});
// Archive user
exports.usersRouter.post('/:userId/archive', async (req, res, next) => {
    try {
        const { orgId, userId } = req.params;
        const existing = await prisma_1.prisma.user.findFirst({
            where: { id: userId, orgId },
        });
        if (!existing) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'User not found');
        }
        if (existing.role === 'superadmin') {
            throw new error_handler_1.AppError(403, 'FORBIDDEN', 'Cannot archive superadmin users');
        }
        if (existing.status === 'archived') {
            throw new error_handler_1.AppError(400, 'ALREADY_ARCHIVED', 'User is already archived');
        }
        const user = await prisma_1.prisma.user.update({
            where: { id: userId },
            data: {
                status: 'archived',
                archivedAt: new Date(),
            },
            include: {
                site: { select: { id: true, name: true } },
            },
        });
        if (existing.username && process.env.NODE_ENV !== 'development') {
            try {
                await (0, cognito_1.disableCognitoUser)(existing.username);
            }
            catch (err) {
                console.warn('Failed to disable Cognito user:', err);
            }
        }
        await (0, audit_1.auditLog)({
            orgId,
            actorUserId: req.user.id,
            action: 'update',
            entityType: 'user',
            entityId: user.id,
            metadata: { statusBefore: existing.status, statusAfter: 'archived', archivedAt: user.archivedAt },
            req,
        });
        res.json(user);
    }
    catch (error) {
        next(error);
    }
});
// Restore archived user
exports.usersRouter.post('/:userId/restore', async (req, res, next) => {
    try {
        const { orgId, userId } = req.params;
        const existing = await prisma_1.prisma.user.findFirst({
            where: { id: userId, orgId },
        });
        if (!existing) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'User not found');
        }
        if (existing.status !== 'archived') {
            throw new error_handler_1.AppError(400, 'NOT_ARCHIVED', 'User is not archived');
        }
        // Set to inactive - admin needs to explicitly activate
        const user = await prisma_1.prisma.user.update({
            where: { id: userId },
            data: {
                status: 'inactive',
                archivedAt: null,
            },
            include: {
                site: { select: { id: true, name: true } },
            },
        });
        await (0, audit_1.auditLog)({
            orgId,
            actorUserId: req.user.id,
            action: 'update',
            entityType: 'user',
            entityId: user.id,
            metadata: { statusBefore: existing.status, statusAfter: 'inactive', archivedAt: null },
            req,
        });
        res.json(user);
    }
    catch (error) {
        next(error);
    }
});
// Reset user password
exports.usersRouter.post('/:userId/reset-password', async (req, res, next) => {
    try {
        const { orgId, userId } = req.params;
        const body = shared_1.ResetPasswordRequestSchema.parse(req.body ?? {});
        const existing = await prisma_1.prisma.user.findFirst({
            where: { id: userId, orgId },
        });
        if (!existing) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'User not found');
        }
        if (existing.status === 'archived') {
            throw new error_handler_1.AppError(400, 'ARCHIVED', 'Cannot reset password for archived user');
        }
        const tempPassword = body.temporaryPassword || (body.generateTemporaryPassword ? (0, passwords_1.generateTemporaryPassword)() : undefined);
        if (existing.username && process.env.NODE_ENV !== 'development') {
            await (0, cognito_1.resetCognitoUserPassword)(existing.username, tempPassword);
        }
        await (0, audit_1.auditLog)({
            orgId,
            actorUserId: req.user.id,
            action: 'reset_password',
            entityType: 'user',
            entityId: existing.id,
            metadata: { targetUserId: existing.id },
            req,
        });
        res.json({
            status: 'ok',
            ...(tempPassword ? { temporaryPassword: tempPassword } : {}),
        });
    }
    catch (error) {
        next(error);
    }
});
// Permanently delete user
exports.usersRouter.delete('/:userId', async (req, res, next) => {
    try {
        const { orgId, userId } = req.params;
        const { confirm } = req.query;
        const existing = await prisma_1.prisma.user.findFirst({
            where: { id: userId, orgId },
            include: {
                _count: { select: { performedRecords: true, verifiedRecords: true } },
            },
        });
        if (!existing) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'User not found');
        }
        if (existing.role === 'superadmin') {
            throw new error_handler_1.AppError(403, 'FORBIDDEN', 'Cannot delete superadmin users');
        }
        // Prevent self-deletion
        if (existing.id === req.user.id) {
            throw new error_handler_1.AppError(400, 'CANNOT_DELETE_SELF', 'Cannot delete your own account');
        }
        // Prevent deletion if user has records
        const totalRecords = existing._count.performedRecords + existing._count.verifiedRecords;
        if (totalRecords > 0) {
            throw new error_handler_1.AppError(400, 'USER_HAS_RECORDS', `User has ${existing._count.performedRecords} performed and ${existing._count.verifiedRecords} verified records and cannot be deleted.`);
        }
        // Warn if not archived first
        if (existing.status !== 'archived' && confirm !== 'true') {
            throw new error_handler_1.AppError(400, 'NOT_ARCHIVED', 'User should be archived before permanent deletion. Add ?confirm=true to delete anyway.');
        }
        await (0, audit_1.auditLog)({
            orgId,
            actorUserId: req.user.id,
            action: 'delete',
            entityType: 'user',
            entityId: userId,
            metadata: { record: existing, counts: existing._count },
            req,
        });
        if (existing.username && process.env.NODE_ENV !== 'development') {
            try {
                await (0, cognito_1.deleteCognitoUser)(existing.username);
            }
            catch (err) {
                console.warn('Failed to delete Cognito user:', err);
            }
        }
        await prisma_1.prisma.user.delete({
            where: { id: userId },
        });
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcm91dGVzL3N1cGVyYWRtaW4vdXNlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUNBQWtFO0FBQ2xFLDZDQUEwQztBQUMxQyxrRUFBMEQ7QUFDMUQsZ0RBQWdEO0FBQ2hELG9EQUE2SjtBQUM3SixpREFBd0Y7QUFDeEYsbURBQWdFO0FBQ2hFLG1EQUFnRjtBQUVuRSxRQUFBLFdBQVcsR0FBRyxJQUFBLGdCQUFNLEVBQUMsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLCtCQUErQjtBQUV6RixnQ0FBZ0M7QUFDaEMsbUJBQVcsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxHQUFZLEVBQUUsR0FBYSxFQUFFLElBQWtCLEVBQUUsRUFBRTtJQUM3RSxJQUFJLENBQUM7UUFDSCxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQztRQUU3QixvQkFBb0I7UUFDcEIsTUFBTSxHQUFHLEdBQUcsTUFBTSxlQUFNLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQztZQUMvQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFO1NBQ3JCLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNULE1BQU0sSUFBSSx3QkFBUSxDQUFDLEdBQUcsRUFBRSxXQUFXLEVBQUUsd0JBQXdCLENBQUMsQ0FBQztRQUNqRSxDQUFDO1FBRUQsSUFBSSxHQUFHLENBQUMsSUFBSSxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzFCLE1BQU0sSUFBSSx3QkFBUSxDQUFDLEdBQUcsRUFBRSxXQUFXLEVBQUUseUNBQXlDLENBQUMsQ0FBQztRQUNsRixDQUFDO1FBRUQsTUFBTSxLQUFLLEdBQUcsTUFBTSxlQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQztZQUN2QyxLQUFLLEVBQUUsRUFB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SSxDQUFDLGdDQUFnQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQ3RELENBQUM7UUFDSCxDQUFDO1FBRUQsTUFBTSxlQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztZQUN2QixLQUFLLEVBQUUsRUFBRSxFQUFFLEVBQUUsTUFBTSxFQUFFO1NBQ3RCLENBQUMsQ0FBQztRQUVILEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDekIsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDZCxDQUFDO0FBQ0gsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBSb3V0ZXIsIFJlcXVlc3QsIFJlc3BvbnNlLCBOZXh0RnVuY3Rpb24gfSBmcm9tICdleHByZXNzJztcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gJy4uLy4uL2xpYi9wcmlzbWEnO1xuaW1wb3J0IHsgQXBwRXJyb3IgfSBmcm9tICcuLi8uLi9taWRkbGV3YXJlL2Vycm9yLWhhbmRsZXInO1xuaW1wb3J0IHsgYXVkaXRMb2cgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9hdWRpdCc7XG5pbXBvcnQgeyBjcmVhdGVDb2duaXRvVXNlciwgQ29nbml0b0Vycm9yLCBkZWxldGVDb2duaXRvVXNlciwgZGlzYWJsZUNvZ25pdG9Vc2VyLCBlbmFibGVDb2duaXRvVXNlciwgcmVzZXRDb2duaXRvVXNlclBhc3N3b3JkIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvY29nbml0byc7XG5pbXBvcnQgeyBDcmVhdGVPcmdBZG1pblNjaGVtYSwgUmVzZXRQYXNzd29yZFJlcXVlc3RTY2hlbWEgfSBmcm9tICdAbGFiLWNvdW50ZXJzL3NoYXJlZCc7XG5pbXBvcnQgeyBnZW5lcmF0ZVRlbXBvcmFyeVBhc3N3b3JkIH0gZnJvbSAnLi4vLi4vbGliL3Bhc3N3b3Jkcyc7XG5pbXBvcnQgeyBidWlsZFVzZXJuYW1lQmFzZSwgYnVpbGRVc2VybmFtZUNhbmRpZGF0ZSB9IGZyb20gJy4uLy4uL2xpYi91c2VybmFtZXMnO1xuXG5leHBvcnQgY29uc3QgdXNlcnNSb3V0ZXIgPSBSb3V0ZXIoeyBtZXJnZVBhcmFtczogdHJ1ZSB9KTsgLy8gVG8gYWNjZXNzIDpvcmdJZCBmcm9tIHBhcmVudFxuXG4vLyBMaXN0IHVzZXJzIGluIGFuIG9yZ2FuaXphdGlvblxudXNlcnNSb3V0ZXIuZ2V0KCcvJywgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBvcmdJZCB9ID0gcmVxLnBhcmFtcztcblxuICAgIC8vIFZlcmlmeSBvcmcgZXhpc3RzXG4gICAgY29uc3Qgb3JnID0gYXdhaXQgcHJpc21hLm9yZ2FuaXphdGlvbi5maW5kVW5pcXVlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiBvcmdJZCB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFvcmcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsICdOT1RfRk9VTkQnLCAnT3JnYW5pemF0aW9uIG5vdCBmb3VuZCcpO1xuICAgIH1cblxuICAgIGlmIChvcmcuc2x1ZyA9PT0gJ3N5c3RlbScpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsICdGT1JCSURERU4nLCAnQ2Fubm90IGFjY2VzcyBzeXN0ZW0gb3JnYW5pemF0aW9uIHVzZXJzJyk7XG4gICAgfVxuXG4gICAgY29uc3QgdXNlcnMgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kTWFueSh7XG4gICAgICB3aGVyZTogeyBvcmdJZCB9LFxuICAgICAgaW5jbHVkZToge1xuICAgICAgICBzaXRlOiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSB9IH0sXG4gICAgICB9LFxuICAgICAgb3JkZXJCeTogeyBuYW1lOiAnYXNjJyB9LFxuICAgIH0pO1xuXG4gICAgcmVzLmpzb24odXNlcnMpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIG5leHQoZXJyb3IpO1xuICB9XG59KTtcblxuLy8gQ3JlYXRlIG9yZyBhZG1pbiAoaW5pdGlhbCBhZG1pbiBmb3IgYW4gb3JnYW5pemF0aW9uKVxudXNlcnNSb3V0ZXIucG9zdCgnLycsIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgb3JnSWQgfSA9IHJlcS5wYXJhbXM7XG4gICAgY29uc3QgYm9keSA9IENyZWF0ZU9yZ0FkbWluU2NoZW1hLnBhcnNlKHJlcS5ib2R5KTtcblxuICAgIC8vIFZlcmlmeSBvcmcgZXhpc3RzXG4gICAgY29uc3Qgb3JnID0gYXdhaXQgcHJpc21hLm9yZ2FuaXphdGlvbi5maW5kVW5pcXVlKHtcbiAgICAgIHdoZXJlOiB7IGlkOiBvcmdJZCB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFvcmcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsICdOT1RfRk9VTkQnLCAnT3JnYW5pemF0aW9uIG5vdCBmb3VuZCcpO1xuICAgIH1cblxuICAgIGlmIChvcmcuc2x1ZyA9PT0gJ3N5c3RlbScpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsICdGT1JCSURERU4nLCAnQ2Fubm90IGFkZCB1c2VycyB0byBzeXN0ZW0gb3JnYW5pemF0aW9uJyk7XG4gICAgfVxuXG4gICAgY29uc3Qgc2l0ZUlkc1RvQXNzaWduID0gYm9keS5zaXRlSWRzID8/IFtib2R5LnNpdGVJZF07XG5cbiAgICBpZiAoIXNpdGVJZHNUb0Fzc2lnbi5pbmNsdWRlcyhib2R5LnNpdGVJZCkpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsICdJTlZBTElEX1NJVEUnLCAnUHJpbWFyeSBzaXRlIG11c3QgYmUgaW4gYXNzaWduZWQgc2l0ZXMnKTtcbiAgICB9XG5cbiAgICAvLyBWZXJpZnkgYWxsIHNpdGVzIGJlbG9uZyB0byBvcmdcbiAgICBjb25zdCBzaXRlcyA9IGF3YWl0IHByaXNtYS5zaXRlLmZpbmRNYW55KHtcbiAgICAgIHdoZXJlOiB7XG4gICAgICAgIGlkOiB7IGluOiBzaXRlSWRzVG9Bc3NpZ24gfSxcbiAgICAgICAgb3JnSWQsXG4gICAgICB9LFxuICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoc2l0ZXMubGVuZ3RoICE9PSBzaXRlSWRzVG9Bc3NpZ24ubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCAnSU5WQUxJRF9TSVRFJywgJ09uZSBvciBtb3JlIHNpdGVzIG5vdCBmb3VuZCBpbiB0aGlzIG9yZ2FuaXphdGlvbicpO1xuICAgIH1cblxuICAgIC8vIENoZWNrIGlmIGVtYWlsIGFscmVhZHkgZXhpc3RzIGluIG9yZ1xuICAgIGNvbnN0IGV4aXN0aW5nVXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZTogeyBvcmdJZCwgZW1haWw6IGJvZHkuZW1haWwgfSxcbiAgICB9KTtcblxuICAgIGlmIChleGlzdGluZ1VzZXIpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsICdFTUFJTF9FWElTVFMnLCAnQSB1c2VyIHdpdGggdGhpcyBlbWFpbCBhbHJlYWR5IGV4aXN0cyBpbiB0aGlzIG9yZ2FuaXphdGlvbicpO1xuICAgIH1cblxuICAgIGNvbnN0IGJhc2VVc2VybmFtZSA9IGJ1aWxkVXNlcm5hbWVCYXNlKGJvZHkubmFtZSk7XG4gICAgbGV0IGNhbmRpZGF0ZVVzZXJuYW1lID0gYm9keS51c2VybmFtZTtcblxuICAgIGlmICghY2FuZGlkYXRlVXNlcm5hbWUpIHtcbiAgICAgIGxldCBzdWZmaXggPSAwO1xuICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgY29uc3QgcG9zc2libGUgPSBidWlsZFVzZXJuYW1lQ2FuZGlkYXRlKGJhc2VVc2VybmFtZSwgc3VmZml4KTtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdVc2VybmFtZSA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRGaXJzdCh7XG4gICAgICAgICAgd2hlcmU6IHsgdXNlcm5hbWU6IHBvc3NpYmxlIH0sXG4gICAgICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoIWV4aXN0aW5nVXNlcm5hbWUpIHtcbiAgICAgICAgICBjYW5kaWRhdGVVc2VybmFtZSA9IHBvc3NpYmxlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIHN1ZmZpeCArPSAxO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBleGlzdGluZ1VzZXJuYW1lID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZEZpcnN0KHtcbiAgICAgICAgd2hlcmU6IHsgdXNlcm5hbWU6IGNhbmRpZGF0ZVVzZXJuYW1lIH0sXG4gICAgICB9KTtcbiAgICAgIGlmIChleGlzdGluZ1VzZXJuYW1lKSB7XG4gICAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsICdVU0VSTkFNRV9FWElTVFMnLCAnQSB1c2VyIHdpdGggdGhpcyB1c2VybmFtZSBhbHJlYWR5IGV4aXN0cycpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHRlbXBQYXNzd29yZCA9IGJvZHkudGVtcG9yYXJ5UGFzc3dvcmQgfHwgKGJvZHkuZ2VuZXJhdGVUZW1wb3JhcnlQYXNzd29yZCA/IGdlbmVyYXRlVGVtcG9yYXJ5UGFzc3dvcmQoKSA6IHVuZGVmaW5lZCk7XG4gICAgY29uc3Qgc3VwcHJlc3NFbWFpbCA9ICEhdGVtcFBhc3N3b3JkO1xuXG4gICAgLy8gQ3JlYXRlIHVzZXIgaW4gQ29nbml0byBmaXJzdFxuICAgIGxldCBjb2duaXRvUmVzdWx0O1xuICAgIGlmICghY2FuZGlkYXRlVXNlcm5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsICdJTlZBTElEX1VTRVJOQU1FJywgJ1VuYWJsZSB0byBnZW5lcmF0ZSB1c2VybmFtZScpO1xuICAgIH1cblxuICAgIGxldCBzdWZmaXggPSAwO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAoIWJvZHkudXNlcm5hbWUpIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdVc2VybmFtZSA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRGaXJzdCh7XG4gICAgICAgICAgd2hlcmU6IHsgdXNlcm5hbWU6IGNhbmRpZGF0ZVVzZXJuYW1lIH0sXG4gICAgICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoZXhpc3RpbmdVc2VybmFtZSkge1xuICAgICAgICAgIHN1ZmZpeCArPSAxO1xuICAgICAgICAgIGNhbmRpZGF0ZVVzZXJuYW1lID0gYnVpbGRVc2VybmFtZUNhbmRpZGF0ZShiYXNlVXNlcm5hbWUsIHN1ZmZpeCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgY29nbml0b1Jlc3VsdCA9IGF3YWl0IGNyZWF0ZUNvZ25pdG9Vc2VyKHtcbiAgICAgICAgICB1c2VybmFtZTogY2FuZGlkYXRlVXNlcm5hbWUsXG4gICAgICAgICAgZW1haWw6IGJvZHkuZW1haWwsXG4gICAgICAgICAgbmFtZTogYm9keS5uYW1lLFxuICAgICAgICAgIHRlbXBvcmFyeVBhc3N3b3JkOiB0ZW1wUGFzc3dvcmQsXG4gICAgICAgICAgc3VwcHJlc3NFbWFpbCxcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgaWYgKCFib2R5LnVzZXJuYW1lICYmIGVycm9yIGluc3RhbmNlb2YgQ29nbml0b0Vycm9yICYmIGVycm9yLmNvZGUgPT09ICdVU0VSTkFNRV9FWElTVFMnKSB7XG4gICAgICAgICAgc3VmZml4ICs9IDE7XG4gICAgICAgICAgY2FuZGlkYXRlVXNlcm5hbWUgPSBidWlsZFVzZXJuYW1lQ2FuZGlkYXRlKGJhc2VVc2VybmFtZSwgc3VmZml4KTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBDb2duaXRvRXJyb3IpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBlcnJvci5jb2RlLCBlcnJvci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgdXNlciBpbiBkYXRhYmFzZSB3aXRoIENvZ25pdG8gSURcbiAgICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuY3JlYXRlKHtcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgY29nbml0b0lkOiBjb2duaXRvUmVzdWx0LmNvZ25pdG9JZCxcbiAgICAgICAgdXNlcm5hbWU6IGNhbmRpZGF0ZVVzZXJuYW1lLFxuICAgICAgICBlbWFpbDogYm9keS5lbWFpbCxcbiAgICAgICAgbmFtZTogYm9keS5uYW1lLFxuICAgICAgICBvcmdJZCxcbiAgICAgICAgc2l0ZUlkOiBib2R5LnNpdGVJZCxcbiAgICAgICAgcm9sZTogJ2FkbWluJywgLy8gU3VwZXJhZG1pbiBjcmVhdGVzIG9yZyBhZG1pbnNcbiAgICAgICAgc3RhdHVzOiAncGVuZGluZycsIC8vIFdpbGwgYmUgYWN0aXZhdGVkIHdoZW4gdXNlciBzZXRzIHBhc3N3b3JkXG4gICAgICAgIHNpdGVzOiB7XG4gICAgICAgICAgY3JlYXRlOiBzaXRlSWRzVG9Bc3NpZ24ubWFwKChzaXRlSWQpID0+ICh7IHNpdGVJZCB9KSksXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgaW5jbHVkZToge1xuICAgICAgICBzaXRlOiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSB9IH0sXG4gICAgICAgIG9yZ2FuaXphdGlvbjogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUgfSB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGF3YWl0IGF1ZGl0TG9nKHtcbiAgICAgIG9yZ0lkLFxuICAgICAgYWN0b3JVc2VySWQ6IHJlcS51c2VyIS5pZCxcbiAgICAgIGFjdGlvbjogJ2NyZWF0ZScsXG4gICAgICBlbnRpdHlUeXBlOiAndXNlcicsXG4gICAgICBlbnRpdHlJZDogdXNlci5pZCxcbiAgICAgIG1ldGFkYXRhOiB7IHJlY29yZDogdXNlciB9LFxuICAgICAgcmVxLFxuICAgIH0pO1xuXG4gICAgcmVzLnN0YXR1cygyMDEpLmpzb24oe1xuICAgICAgLi4udXNlcixcbiAgICAgIC4uLih0ZW1wUGFzc3dvcmQgPyB7IHRlbXBvcmFyeVBhc3N3b3JkOiB0ZW1wUGFzc3dvcmQgfSA6IHt9KSxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBuZXh0KGVycm9yKTtcbiAgfVxufSk7XG5cbi8vIEdldCBzaW5nbGUgdXNlclxudXNlcnNSb3V0ZXIuZ2V0KCcvOnVzZXJJZCcsIGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgb3JnSWQsIHVzZXJJZCB9ID0gcmVxLnBhcmFtcztcblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCwgb3JnSWQgfSxcbiAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgc2l0ZTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUgfSB9LFxuICAgICAgICBzaXRlczoge1xuICAgICAgICAgIGluY2x1ZGU6IHsgc2l0ZTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUgfSB9IH0sXG4gICAgICAgIH0sXG4gICAgICAgIF9jb3VudDogeyBzZWxlY3Q6IHsgcGVyZm9ybWVkUmVjb3JkczogdHJ1ZSwgdmVyaWZpZWRSZWNvcmRzOiB0cnVlIH0gfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIXVzZXIpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsICdOT1RfRk9VTkQnLCAnVXNlciBub3QgZm91bmQnKTtcbiAgICB9XG5cbiAgICByZXMuanNvbih1c2VyKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBuZXh0KGVycm9yKTtcbiAgfVxufSk7XG5cbi8vIFVwZGF0ZSB1c2VyIHN0YXR1cyAoYWN0aXZhdGUvZGVhY3RpdmF0ZSlcbnVzZXJzUm91dGVyLnBhdGNoKCcvOnVzZXJJZC9zdGF0dXMnLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IG9yZ0lkLCB1c2VySWQgfSA9IHJlcS5wYXJhbXM7XG4gICAgY29uc3QgeyBzdGF0dXMgfSA9IHJlcS5ib2R5O1xuXG4gICAgaWYgKCFzdGF0dXMgfHwgIVsnYWN0aXZlJywgJ2luYWN0aXZlJ10uaW5jbHVkZXMoc3RhdHVzKSkge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgJ0lOVkFMSURfU1RBVFVTJywgJ1N0YXR1cyBtdXN0IGJlIGFjdGl2ZSBvciBpbmFjdGl2ZScpO1xuICAgIH1cblxuICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZEZpcnN0KHtcbiAgICAgIHdoZXJlOiB7IGlkOiB1c2VySWQsIG9yZ0lkIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIWV4aXN0aW5nKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCAnTk9UX0ZPVU5EJywgJ1VzZXIgbm90IGZvdW5kJyk7XG4gICAgfVxuXG4gICAgLy8gRG9uJ3QgYWxsb3cgc3RhdHVzIGNoYW5nZSBvbiBzdXBlcmFkbWluc1xuICAgIGlmIChleGlzdGluZy5yb2xlID09PSAnc3VwZXJhZG1pbicpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsICdGT1JCSURERU4nLCAnQ2Fubm90IGNoYW5nZSBzdGF0dXMgb2Ygc3VwZXJhZG1pbiB1c2VycycpO1xuICAgIH1cblxuICAgIGlmIChleGlzdGluZy5zdGF0dXMgPT09ICdhcmNoaXZlZCcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsICdBUkNISVZFRCcsICdDYW5ub3QgY2hhbmdlIHN0YXR1cyBvZiBhcmNoaXZlZCB1c2VyLiBSZXN0b3JlIGl0IGZpcnN0LicpO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgICAgZGF0YTogeyBzdGF0dXMgfSxcbiAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgc2l0ZTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUgfSB9LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGlmIChleGlzdGluZy51c2VybmFtZSAmJiBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ2RldmVsb3BtZW50Jykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgaWYgKHN0YXR1cyA9PT0gJ2luYWN0aXZlJykge1xuICAgICAgICAgIGF3YWl0IGRpc2FibGVDb2duaXRvVXNlcihleGlzdGluZy51c2VybmFtZSk7XG4gICAgICAgIH0gZWxzZSBpZiAoc3RhdHVzID09PSAnYWN0aXZlJykge1xuICAgICAgICAgIGF3YWl0IGVuYWJsZUNvZ25pdG9Vc2VyKGV4aXN0aW5nLnVzZXJuYW1lKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignRmFpbGVkIHRvIHVwZGF0ZSBDb2duaXRvIHVzZXIgc3RhdHVzOicsIGVycik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgYXdhaXQgYXVkaXRMb2coe1xuICAgICAgb3JnSWQsXG4gICAgICBhY3RvclVzZXJJZDogcmVxLnVzZXIhLmlkLFxuICAgICAgYWN0aW9uOiAndXBkYXRlJyxcbiAgICAgIGVudGl0eVR5cGU6ICd1c2VyJyxcbiAgICAgIGVudGl0eUlkOiB1c2VyLmlkLFxuICAgICAgbWV0YWRhdGE6IHsgc3RhdHVzQmVmb3JlOiBleGlzdGluZy5zdGF0dXMsIHN0YXR1c0FmdGVyOiB1c2VyLnN0YXR1cyB9LFxuICAgICAgcmVxLFxuICAgIH0pO1xuXG4gICAgcmVzLmpzb24odXNlcik7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbmV4dChlcnJvcik7XG4gIH1cbn0pO1xuXG4vLyBBcmNoaXZlIHVzZXJcbnVzZXJzUm91dGVyLnBvc3QoJy86dXNlcklkL2FyY2hpdmUnLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IG9yZ0lkLCB1c2VySWQgfSA9IHJlcS5wYXJhbXM7XG5cbiAgICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZTogeyBpZDogdXNlcklkLCBvcmdJZCB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFleGlzdGluZykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgJ05PVF9GT1VORCcsICdVc2VyIG5vdCBmb3VuZCcpO1xuICAgIH1cblxuICAgIGlmIChleGlzdGluZy5yb2xlID09PSAnc3VwZXJhZG1pbicpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsICdGT1JCSURERU4nLCAnQ2Fubm90IGFyY2hpdmUgc3VwZXJhZG1pbiB1c2VycycpO1xuICAgIH1cblxuICAgIGlmIChleGlzdGluZy5zdGF0dXMgPT09ICdhcmNoaXZlZCcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsICdBTFJFQURZX0FSQ0hJVkVEJywgJ1VzZXIgaXMgYWxyZWFkeSBhcmNoaXZlZCcpO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgICAgZGF0YToge1xuICAgICAgICBzdGF0dXM6ICdhcmNoaXZlZCcsXG4gICAgICAgIGFyY2hpdmVkQXQ6IG5ldyBEYXRlKCksXG4gICAgICB9LFxuICAgICAgaW5jbHVkZToge1xuICAgICAgICBzaXRlOiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSB9IH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKGV4aXN0aW5nLnVzZXJuYW1lICYmIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAnZGV2ZWxvcG1lbnQnKSB7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBkaXNhYmxlQ29nbml0b1VzZXIoZXhpc3RpbmcudXNlcm5hbWUpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignRmFpbGVkIHRvIGRpc2FibGUgQ29nbml0byB1c2VyOicsIGVycik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgYXdhaXQgYXVkaXRMb2coe1xuICAgICAgb3JnSWQsXG4gICAgICBhY3RvclVzZXJJZDogcmVxLnVzZXIhLmlkLFxuICAgICAgYWN0aW9uOiAndXBkYXRlJyxcbiAgICAgIGVudGl0eVR5cGU6ICd1c2VyJyxcbiAgICAgIGVudGl0eUlkOiB1c2VyLmlkLFxuICAgICAgbWV0YWRhdGE6IHsgc3RhdHVzQmVmb3JlOiBleGlzdGluZy5zdGF0dXMsIHN0YXR1c0FmdGVyOiAnYXJjaGl2ZWQnLCBhcmNoaXZlZEF0OiB1c2VyLmFyY2hpdmVkQXQgfSxcbiAgICAgIHJlcSxcbiAgICB9KTtcblxuICAgIHJlcy5qc29uKHVzZXIpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIG5leHQoZXJyb3IpO1xuICB9XG59KTtcblxuLy8gUmVzdG9yZSBhcmNoaXZlZCB1c2VyXG51c2Vyc1JvdXRlci5wb3N0KCcvOnVzZXJJZC9yZXN0b3JlJywgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBvcmdJZCwgdXNlcklkIH0gPSByZXEucGFyYW1zO1xuXG4gICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCwgb3JnSWQgfSxcbiAgICB9KTtcblxuICAgIGlmICghZXhpc3RpbmcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDQsICdOT1RfRk9VTkQnLCAnVXNlciBub3QgZm91bmQnKTtcbiAgICB9XG5cbiAgICBpZiAoZXhpc3Rpbmcuc3RhdHVzICE9PSAnYXJjaGl2ZWQnKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCAnTk9UX0FSQ0hJVkVEJywgJ1VzZXIgaXMgbm90IGFyY2hpdmVkJyk7XG4gICAgfVxuXG4gICAgLy8gU2V0IHRvIGluYWN0aXZlIC0gYWRtaW4gbmVlZHMgdG8gZXhwbGljaXRseSBhY3RpdmF0ZVxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgICAgZGF0YToge1xuICAgICAgICBzdGF0dXM6ICdpbmFjdGl2ZScsXG4gICAgICAgIGFyY2hpdmVkQXQ6IG51bGwsXG4gICAgICB9LFxuICAgICAgaW5jbHVkZToge1xuICAgICAgICBzaXRlOiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSB9IH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgYXdhaXQgYXVkaXRMb2coe1xuICAgICAgb3JnSWQsXG4gICAgICBhY3RvclVzZXJJZDogcmVxLnVzZXIhLmlkLFxuICAgICAgYWN0aW9uOiAndXBkYXRlJyxcbiAgICAgIGVudGl0eVR5cGU6ICd1c2VyJyxcbiAgICAgIGVudGl0eUlkOiB1c2VyLmlkLFxuICAgICAgbWV0YWRhdGE6IHsgc3RhdHVzQmVmb3JlOiBleGlzdGluZy5zdGF0dXMsIHN0YXR1c0FmdGVyOiAnaW5hY3RpdmUnLCBhcmNoaXZlZEF0OiBudWxsIH0sXG4gICAgICByZXEsXG4gICAgfSk7XG5cbiAgICByZXMuanNvbih1c2VyKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBuZXh0KGVycm9yKTtcbiAgfVxufSk7XG5cbi8vIFJlc2V0IHVzZXIgcGFzc3dvcmRcbnVzZXJzUm91dGVyLnBvc3QoJy86dXNlcklkL3Jlc2V0LXBhc3N3b3JkJywgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBvcmdJZCwgdXNlcklkIH0gPSByZXEucGFyYW1zO1xuICAgIGNvbnN0IGJvZHkgPSBSZXNldFBhc3N3b3JkUmVxdWVzdFNjaGVtYS5wYXJzZShyZXEuYm9keSA/PyB7fSk7XG5cbiAgICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZTogeyBpZDogdXNlcklkLCBvcmdJZCB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFleGlzdGluZykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgJ05PVF9GT1VORCcsICdVc2VyIG5vdCBmb3VuZCcpO1xuICAgIH1cblxuICAgIGlmIChleGlzdGluZy5zdGF0dXMgPT09ICdhcmNoaXZlZCcpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsICdBUkNISVZFRCcsICdDYW5ub3QgcmVzZXQgcGFzc3dvcmQgZm9yIGFyY2hpdmVkIHVzZXInKTtcbiAgICB9XG5cbiAgICBjb25zdCB0ZW1wUGFzc3dvcmQgPSBib2R5LnRlbXBvcmFyeVBhc3N3b3JkIHx8IChib2R5LmdlbmVyYXRlVGVtcG9yYXJ5UGFzc3dvcmQgPyBnZW5lcmF0ZVRlbXBvcmFyeVBhc3N3b3JkKCkgOiB1bmRlZmluZWQpO1xuXG4gICAgaWYgKGV4aXN0aW5nLnVzZXJuYW1lICYmIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAnZGV2ZWxvcG1lbnQnKSB7XG4gICAgICBhd2FpdCByZXNldENvZ25pdG9Vc2VyUGFzc3dvcmQoZXhpc3RpbmcudXNlcm5hbWUsIHRlbXBQYXNzd29yZCk7XG4gICAgfVxuXG4gICAgYXdhaXQgYXVkaXRMb2coe1xuICAgICAgb3JnSWQsXG4gICAgICBhY3RvclVzZXJJZDogcmVxLnVzZXIhLmlkLFxuICAgICAgYWN0aW9uOiAncmVzZXRfcGFzc3dvcmQnLFxuICAgICAgZW50aXR5VHlwZTogJ3VzZXInLFxuICAgICAgZW50aXR5SWQ6IGV4aXN0aW5nLmlkLFxuICAgICAgbWV0YWRhdGE6IHsgdGFyZ2V0VXNlcklkOiBleGlzdGluZy5pZCB9LFxuICAgICAgcmVxLFxuICAgIH0pO1xuXG4gICAgcmVzLmpzb24oe1xuICAgICAgc3RhdHVzOiAnb2snLFxuICAgICAgLi4uKHRlbXBQYXNzd29yZCA/IHsgdGVtcG9yYXJ5UGFzc3dvcmQ6IHRlbXBQYXNzd29yZCB9IDoge30pLFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIG5leHQoZXJyb3IpO1xuICB9XG59KTtcblxuLy8gUGVybWFuZW50bHkgZGVsZXRlIHVzZXJcbnVzZXJzUm91dGVyLmRlbGV0ZSgnLzp1c2VySWQnLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IG9yZ0lkLCB1c2VySWQgfSA9IHJlcS5wYXJhbXM7XG4gICAgY29uc3QgeyBjb25maXJtIH0gPSByZXEucXVlcnk7XG5cbiAgICBjb25zdCBleGlzdGluZyA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZTogeyBpZDogdXNlcklkLCBvcmdJZCB9LFxuICAgICAgaW5jbHVkZToge1xuICAgICAgICBfY291bnQ6IHsgc2VsZWN0OiB7IHBlcmZvcm1lZFJlY29yZHM6IHRydWUsIHZlcmlmaWVkUmVjb3JkczogdHJ1ZSB9IH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCFleGlzdGluZykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgJ05PVF9GT1VORCcsICdVc2VyIG5vdCBmb3VuZCcpO1xuICAgIH1cblxuICAgIGlmIChleGlzdGluZy5yb2xlID09PSAnc3VwZXJhZG1pbicpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsICdGT1JCSURERU4nLCAnQ2Fubm90IGRlbGV0ZSBzdXBlcmFkbWluIHVzZXJzJyk7XG4gICAgfVxuXG4gICAgLy8gUHJldmVudCBzZWxmLWRlbGV0aW9uXG4gICAgaWYgKGV4aXN0aW5nLmlkID09PSByZXEudXNlciEuaWQpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsICdDQU5OT1RfREVMRVRFX1NFTEYnLCAnQ2Fubm90IGRlbGV0ZSB5b3VyIG93biBhY2NvdW50Jyk7XG4gICAgfVxuXG4gICAgLy8gUHJldmVudCBkZWxldGlvbiBpZiB1c2VyIGhhcyByZWNvcmRzXG4gICAgY29uc3QgdG90YWxSZWNvcmRzID0gZXhpc3RpbmcuX2NvdW50LnBlcmZvcm1lZFJlY29yZHMgKyBleGlzdGluZy5fY291bnQudmVyaWZpZWRSZWNvcmRzO1xuICAgIGlmICh0b3RhbFJlY29yZHMgPiAwKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCAnVVNFUl9IQVNfUkVDT1JEUycsXG4gICAgICAgIGBVc2VyIGhhcyAke2V4aXN0aW5nLl9jb3VudC5wZXJmb3JtZWRSZWNvcmRzfSBwZXJmb3JtZWQgYW5kICR7ZXhpc3RpbmcuX2NvdW50LnZlcmlmaWVkUmVjb3Jkc30gdmVyaWZpZWQgcmVjb3JkcyBhbmQgY2Fubm90IGJlIGRlbGV0ZWQuYCk7XG4gICAgfVxuXG4gICAgLy8gV2FybiBpZiBub3QgYXJjaGl2ZWQgZmlyc3RcbiAgICBpZiAoZXhpc3Rpbmcuc3RhdHVzICE9PSAnYXJjaGl2ZWQnICYmIGNvbmZpcm0gIT09ICd0cnVlJykge1xuICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgJ05PVF9BUkNISVZFRCcsXG4gICAgICAgICdVc2VyIHNob3VsZCBiZSBhcmNoaXZlZCBiZWZvcmUgcGVybWFuZW50IGRlbGV0aW9uLiBBZGQgP2NvbmZpcm09dHJ1ZSB0byBkZWxldGUgYW55d2F5LicpO1xuICAgIH1cblxuICAgIGF3YWl0IGF1ZGl0TG9nKHtcbiAgICAgIG9yZ0lkLFxuICAgICAgYWN0b3JVc2VySWQ6IHJlcS51c2VyIS5pZCxcbiAgICAgIGFjdGlvbjogJ2RlbGV0ZScsXG4gICAgICBlbnRpdHlUeXBlOiAndXNlcicsXG4gICAgICBlbnRpdHlJZDogdXNlcklkLFxuICAgICAgbWV0YWRhdGE6IHsgcmVjb3JkOiBleGlzdGluZywgY291bnRzOiBleGlzdGluZy5fY291bnQgfSxcbiAgICAgIHJlcSxcbiAgICB9KTtcblxuICAgIGlmIChleGlzdGluZy51c2VybmFtZSAmJiBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ2RldmVsb3BtZW50Jykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgZGVsZXRlQ29nbml0b1VzZXIoZXhpc3RpbmcudXNlcm5hbWUpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignRmFpbGVkIHRvIGRlbGV0ZSBDb2duaXRvIHVzZXI6JywgZXJyKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBhd2FpdCBwcmlzbWEudXNlci5kZWxldGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHVzZXJJZCB9LFxuICAgIH0pO1xuXG4gICAgcmVzLnN0YXR1cygyMDQpLnNlbmQoKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBuZXh0KGVycm9yKTtcbiAgfVxufSk7XG4iXX0=