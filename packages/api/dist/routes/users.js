"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const error_handler_1 = require("../middleware/error-handler");
const cognito_1 = require("../services/cognito");
const shared_1 = require("@lab-counters/shared");
const audit_1 = require("../services/audit");
const passwords_1 = require("../lib/passwords");
const usernames_1 = require("../lib/usernames");
exports.usersRouter = (0, express_1.Router)();
// All routes require authentication
exports.usersRouter.use(auth_1.authenticate);
exports.usersRouter.use(auth_1.enforceOrgScope);
// List users in organization (admin only)
exports.usersRouter.get('/', (0, auth_1.authorize)('admin'), async (req, res, next) => {
    try {
        const users = await prisma_1.prisma.user.findMany({
            where: { orgId: req.user.orgId },
            include: {
                site: { select: { id: true, name: true } },
                sites: {
                    include: { site: { select: { id: true, name: true } } },
                    orderBy: { site: { name: 'asc' } },
                },
            },
            orderBy: { name: 'asc' },
        });
        res.json(users);
    }
    catch (error) {
        next(error);
    }
});
// List sites in organization (for user creation forms)
exports.usersRouter.get('/sites', (0, auth_1.authorize)('admin'), async (req, res, next) => {
    try {
        const sites = await prisma_1.prisma.site.findMany({
            where: { orgId: req.user.orgId },
            select: { id: true, name: true, location: true },
            orderBy: { name: 'asc' },
        });
        res.json(sites);
    }
    catch (error) {
        next(error);
    }
});
// Get single user
exports.usersRouter.get('/:id', async (req, res, next) => {
    try {
        const user = await prisma_1.prisma.user.findFirst({
            where: {
                id: req.params.id,
                orgId: req.user.orgId,
            },
            include: {
                site: { select: { id: true, name: true } },
                sites: {
                    include: { site: { select: { id: true, name: true } } },
                    orderBy: { site: { name: 'asc' } },
                },
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
// Create user (admin only)
exports.usersRouter.post('/', (0, auth_1.authorize)('admin'), async (req, res, next) => {
    try {
        const body = shared_1.CreateUserRequestSchema.parse(req.body);
        // Determine all sites to assign (default to just the primary site)
        const siteIdsToAssign = body.siteIds || [body.siteId];
        // Verify all sites belong to org
        const sites = await prisma_1.prisma.site.findMany({
            where: {
                id: { in: siteIdsToAssign },
                orgId: req.user.orgId,
            },
        });
        if (sites.length !== siteIdsToAssign.length) {
            throw new error_handler_1.AppError(400, 'INVALID_SITE', 'One or more sites not found in organization');
        }
        // Verify primary site is in the assigned sites
        if (!siteIdsToAssign.includes(body.siteId)) {
            throw new error_handler_1.AppError(400, 'INVALID_SITE', 'Primary site must be in assigned sites');
        }
        // Check if email already exists in org
        const existingEmail = await prisma_1.prisma.user.findFirst({
            where: { orgId: req.user.orgId, email: body.email },
        });
        if (existingEmail) {
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
        // Create user in database with Cognito ID and site assignments
        const user = await prisma_1.prisma.user.create({
            data: {
                cognitoId: cognitoResult.cognitoId,
                username: candidateUsername,
                email: body.email,
                name: body.name,
                orgId: req.user.orgId,
                siteId: body.siteId,
                role: body.role,
                status: 'pending', // Will be activated when user sets password
                sites: {
                    create: siteIdsToAssign.map((siteId) => ({ siteId })),
                },
            },
            include: {
                site: { select: { id: true, name: true } },
                sites: {
                    include: { site: { select: { id: true, name: true } } },
                    orderBy: { site: { name: 'asc' } },
                },
            },
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
// Update user (admin only, or self for limited fields)
exports.usersRouter.patch('/:id', async (req, res, next) => {
    try {
        const body = shared_1.UpdateUserRequestSchema.parse(req.body);
        const existing = await prisma_1.prisma.user.findFirst({
            where: {
                id: req.params.id,
                orgId: req.user.orgId,
            },
            include: {
                sites: true,
            },
        });
        if (!existing) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'User not found');
        }
        // Non-admins can only update their own name
        const isAdmin = req.user.role === 'admin';
        const isSelf = req.user.id === req.params.id;
        if (!isAdmin && !isSelf) {
            throw new error_handler_1.AppError(403, 'FORBIDDEN', 'Cannot update other users');
        }
        const updateData = {};
        const statusChange = isAdmin && body.status && body.status !== existing.status;
        if (body.name) {
            updateData.name = body.name;
        }
        // Only admins can update role, status, sites
        if (isAdmin) {
            if (body.role)
                updateData.role = body.role;
            if (body.status)
                updateData.status = body.status;
            // Handle site assignments update
            if (body.siteIds) {
                // Verify all sites belong to org
                const sites = await prisma_1.prisma.site.findMany({
                    where: {
                        id: { in: body.siteIds },
                        orgId: req.user.orgId,
                    },
                });
                if (sites.length !== body.siteIds.length) {
                    throw new error_handler_1.AppError(400, 'INVALID_SITE', 'One or more sites not found in organization');
                }
                // If changing siteId too, verify it's in the new siteIds list
                if (body.siteId && !body.siteIds.includes(body.siteId)) {
                    throw new error_handler_1.AppError(400, 'INVALID_SITE', 'Current site must be in assigned sites');
                }
                // If not changing current siteId, ensure it's still in the list
                if (!body.siteId && existing.siteId && !body.siteIds.includes(existing.siteId)) {
                    throw new error_handler_1.AppError(400, 'INVALID_SITE', 'Current site must remain in assigned sites');
                }
                // Delete existing site assignments and create new ones
                await prisma_1.prisma.userSite.deleteMany({
                    where: { userId: req.params.id },
                });
                await prisma_1.prisma.userSite.createMany({
                    data: body.siteIds.map((siteId) => ({
                        userId: req.params.id,
                        siteId,
                    })),
                });
            }
            if (body.siteId) {
                // Verify the new current site is in user's assigned sites
                const assignedSiteIds = body.siteIds || existing.sites.map((s) => s.siteId);
                if (!assignedSiteIds.includes(body.siteId)) {
                    throw new error_handler_1.AppError(400, 'INVALID_SITE', 'Current site must be in assigned sites');
                }
                // Verify site belongs to org
                const site = await prisma_1.prisma.site.findFirst({
                    where: {
                        id: body.siteId,
                        orgId: req.user.orgId,
                    },
                });
                if (!site) {
                    throw new error_handler_1.AppError(400, 'INVALID_SITE', 'Site not found in organization');
                }
                updateData.siteId = body.siteId;
            }
        }
        const user = await prisma_1.prisma.user.update({
            where: { id: req.params.id },
            data: updateData,
            include: {
                site: { select: { id: true, name: true } },
                sites: {
                    include: { site: { select: { id: true, name: true } } },
                    orderBy: { site: { name: 'asc' } },
                },
            },
        });
        if (statusChange && existing.username && process.env.NODE_ENV !== 'development') {
            try {
                if (body.status === 'inactive') {
                    await (0, cognito_1.disableCognitoUser)(existing.username);
                }
                else if (body.status === 'active') {
                    await (0, cognito_1.enableCognitoUser)(existing.username);
                }
            }
            catch (err) {
                console.warn('Failed to update Cognito user status:', err);
            }
        }
        res.json(user);
    }
    catch (error) {
        next(error);
    }
});
// Deactivate user (admin only)
exports.usersRouter.delete('/:id', (0, auth_1.authorize)('admin'), async (req, res, next) => {
    try {
        const existing = await prisma_1.prisma.user.findFirst({
            where: {
                id: req.params.id,
                orgId: req.user.orgId,
            },
        });
        if (!existing) {
            throw new error_handler_1.AppError(404, 'NOT_FOUND', 'User not found');
        }
        // Don't allow deleting yourself
        if (existing.id === req.user.id) {
            throw new error_handler_1.AppError(400, 'INVALID_OPERATION', 'Cannot deactivate yourself');
        }
        // Soft delete - just set to inactive
        await prisma_1.prisma.user.update({
            where: { id: req.params.id },
            data: { status: 'inactive' },
        });
        if (existing.username && process.env.NODE_ENV !== 'development') {
            try {
                await (0, cognito_1.disableCognitoUser)(existing.username);
            }
            catch (err) {
                console.warn('Failed to disable Cognito user:', err);
            }
        }
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
// Reset user password (admin only)
exports.usersRouter.post('/:id/reset-password', (0, auth_1.authorize)('admin'), async (req, res, next) => {
    try {
        const body = shared_1.ResetPasswordRequestSchema.parse(req.body ?? {});
        const existing = await prisma_1.prisma.user.findFirst({
            where: {
                id: req.params.id,
                orgId: req.user.orgId,
            },
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
            orgId: req.user.orgId,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvcm91dGVzL3VzZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFDQUFrRTtBQUNsRSwwQ0FBdUM7QUFDdkMsNkNBQThFO0FBQzlFLCtEQUF1RDtBQUN2RCxpREFBdUk7QUFDdkksaURBQW9IO0FBQ3BILDZDQUE2QztBQUM3QyxnREFBNkQ7QUFDN0QsZ0RBQTZFO0FBRWhFLFFBQUEsV0FBVyxHQUFHLElBQUEsZ0JBQU0sR0FBRSxDQUFDO0FBRXBDLG9DQUFvQztBQUNwQyxtQkFBVyxDQUFDLEdBQUcsQ0FBQyxtQkFBWSxDQUFDLENBQUM7QUFDOUIsbUJBQVcsQ0FBQyxHQUFHLENBQUMsc0JBQWUsQ0FBQyxDQUFDO0FBRWpDLDBDQUEwQztBQUMxQyxtQkFBVyxDQUFDLEdBQUcsQ0FDYixHQUFHLEVBQ0gsSUFBQSxnQkFBUyxFQUFDLE9BQU8sQ0FBQyxFQUNsQixLQUFLLEVBQUUsR0FBWSxFQUFFLEdBQWEsRUFBRSxJQUFrQixFQUFFLEVBQUU7SUFDeEQsSUFBSSxDQUFDO1FBQ0gsTUFBTSxLQUFLLEdBQUcsTUFBTSxlQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQztZQUN2QyxLQUFLLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLElBQUssQ0FBQyxLQUFLLEVBQUU7WUFDakMsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxFQUFFO2dCQUMxQyxLQUFLLEVBQUU7b0JBQ0wsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRTtvQkFDdkQsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFB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LEtBQUssYUFBYSxFQUFFLENBQUM7WUFDaEUsTUFBTSxJQUFBLGtDQUF3QixFQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDbEUsQ0FBQztRQUVELE1BQU0sSUFBQSxnQkFBUSxFQUFDO1lBQ2IsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFLLENBQUMsS0FBSztZQUN0QixXQUFXLEVBQUUsR0FBRyxDQUFDLElBQUssQ0FBQyxFQUFFO1lBQ3pCLE1BQU0sRUFBRSxnQkFBZ0I7WUFDeEIsVUFBVSxFQUFFLE1BQU07WUFDbEIsUUFBUSxFQUFFLFFBQVEsQ0FBQyxFQUFFO1lBQ3JCLFFBQVEsRUFBRSxFQUFFLFlBQVksRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFO1lBQ3ZDLEdBQUc7U0FDSixDQUFDLENBQUM7UUFFSCxHQUFHLENBQUMsSUFBSSxDQUFDO1lBQ1AsTUFBTSxFQUFFLElBQUk7WUFDWixHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxFQUFFLGlCQUFpQixFQUFFLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7U0FDN0QsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDZCxDQUFDO0FBQ0gsQ0FBQyxDQUNGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBSb3V0ZXIsIFJlcXVlc3QsIFJlc3BvbnNlLCBOZXh0RnVuY3Rpb24gfSBmcm9tICdleHByZXNzJztcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gJy4uL2xpYi9wcmlzbWEnO1xuaW1wb3J0IHsgYXV0aGVudGljYXRlLCBhdXRob3JpemUsIGVuZm9yY2VPcmdTY29wZSB9IGZyb20gJy4uL21pZGRsZXdhcmUvYXV0aCc7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gJy4uL21pZGRsZXdhcmUvZXJyb3ItaGFuZGxlcic7XG5pbXBvcnQgeyBjcmVhdGVDb2duaXRvVXNlciwgQ29nbml0b0Vycm9yLCBkaXNhYmxlQ29nbml0b1VzZXIsIGVuYWJsZUNvZ25pdG9Vc2VyLCByZXNldENvZ25pdG9Vc2VyUGFzc3dvcmQgfSBmcm9tICcuLi9zZXJ2aWNlcy9jb2duaXRvJztcbmltcG9ydCB7IENyZWF0ZVVzZXJSZXF1ZXN0U2NoZW1hLCBVcGRhdGVVc2VyUmVxdWVzdFNjaGVtYSwgUmVzZXRQYXNzd29yZFJlcXVlc3RTY2hlbWEgfSBmcm9tICdAbGFiLWNvdW50ZXJzL3NoYXJlZCc7XG5pbXBvcnQgeyBhdWRpdExvZyB9IGZyb20gJy4uL3NlcnZpY2VzL2F1ZGl0JztcbmltcG9ydCB7IGdlbmVyYXRlVGVtcG9yYXJ5UGFzc3dvcmQgfSBmcm9tICcuLi9saWIvcGFzc3dvcmRzJztcbmltcG9ydCB7IGJ1aWxkVXNlcm5hbWVCYXNlLCBidWlsZFVzZXJuYW1lQ2FuZGlkYXRlIH0gZnJvbSAnLi4vbGliL3VzZXJuYW1lcyc7XG5cbmV4cG9ydCBjb25zdCB1c2Vyc1JvdXRlciA9IFJvdXRlcigpO1xuXG4vLyBBbGwgcm91dGVzIHJlcXVpcmUgYXV0aGVudGljYXRpb25cbnVzZXJzUm91dGVyLnVzZShhdXRoZW50aWNhdGUpO1xudXNlcnNSb3V0ZXIudXNlKGVuZm9yY2VPcmdTY29wZSk7XG5cbi8vIExpc3QgdXNlcnMgaW4gb3JnYW5pemF0aW9uIChhZG1pbiBvbmx5KVxudXNlcnNSb3V0ZXIuZ2V0KFxuICAnLycsXG4gIGF1dGhvcml6ZSgnYWRtaW4nKSxcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHVzZXJzID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZE1hbnkoe1xuICAgICAgICB3aGVyZTogeyBvcmdJZDogcmVxLnVzZXIhLm9yZ0lkIH0sXG4gICAgICAgIGluY2x1ZGU6IHtcbiAgICAgICAgICBzaXRlOiB7IHNlbGVjdDogeyBpZDogdHJ1ZSwgbmFtZTogdHJ1ZSB9IH0sXG4gICAgICAgICAgc2l0ZXM6IHtcbiAgICAgICAgICAgIGluY2x1ZGU6IHsgc2l0ZTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUgfSB9IH0sXG4gICAgICAgICAgICBvcmRlckJ5OiB7IHNpdGU6IHsgbmFtZTogJ2FzYycgfSB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIG9yZGVyQnk6IHsgbmFtZTogJ2FzYycgfSxcbiAgICAgIH0pO1xuXG4gICAgICByZXMuanNvbih1c2Vycyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIG5leHQoZXJyb3IpO1xuICAgIH1cbiAgfVxuKTtcblxuLy8gTGlzdCBzaXRlcyBpbiBvcmdhbml6YXRpb24gKGZvciB1c2VyIGNyZWF0aW9uIGZvcm1zKVxudXNlcnNSb3V0ZXIuZ2V0KFxuICAnL3NpdGVzJyxcbiAgYXV0aG9yaXplKCdhZG1pbicpLFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc2l0ZXMgPSBhd2FpdCBwcmlzbWEuc2l0ZS5maW5kTWFueSh7XG4gICAgICAgIHdoZXJlOiB7IG9yZ0lkOiByZXEudXNlciEub3JnSWQgfSxcbiAgICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBsb2NhdGlvbjogdHJ1ZSB9LFxuICAgICAgICBvcmRlckJ5OiB7IG5hbWU6ICdhc2MnIH0sXG4gICAgICB9KTtcblxuICAgICAgcmVzLmpzb24oc2l0ZXMpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBuZXh0KGVycm9yKTtcbiAgICB9XG4gIH1cbik7XG5cbi8vIEdldCBzaW5nbGUgdXNlclxudXNlcnNSb3V0ZXIuZ2V0KCcvOmlkJywgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRGaXJzdCh7XG4gICAgICB3aGVyZToge1xuICAgICAgICBpZDogcmVxLnBhcmFtcy5pZCxcbiAgICAgICAgb3JnSWQ6IHJlcS51c2VyIS5vcmdJZCxcbiAgICAgIH0sXG4gICAgICBpbmNsdWRlOiB7XG4gICAgICAgIHNpdGU6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlIH0gfSxcbiAgICAgICAgc2l0ZXM6IHtcbiAgICAgICAgICBpbmNsdWRlOiB7IHNpdGU6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlIH0gfSB9LFxuICAgICAgICAgIG9yZGVyQnk6IHsgc2l0ZTogeyBuYW1lOiAnYXNjJyB9IH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKCF1c2VyKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCAnTk9UX0ZPVU5EJywgJ1VzZXIgbm90IGZvdW5kJyk7XG4gICAgfVxuXG4gICAgcmVzLmpzb24odXNlcik7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbmV4dChlcnJvcik7XG4gIH1cbn0pO1xuXG4vLyBDcmVhdGUgdXNlciAoYWRtaW4gb25seSlcbnVzZXJzUm91dGVyLnBvc3QoXG4gICcvJyxcbiAgYXV0aG9yaXplKCdhZG1pbicpLFxuICBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgYm9keSA9IENyZWF0ZVVzZXJSZXF1ZXN0U2NoZW1hLnBhcnNlKHJlcS5ib2R5KTtcblxuICAgICAgLy8gRGV0ZXJtaW5lIGFsbCBzaXRlcyB0byBhc3NpZ24gKGRlZmF1bHQgdG8ganVzdCB0aGUgcHJpbWFyeSBzaXRlKVxuICAgICAgY29uc3Qgc2l0ZUlkc1RvQXNzaWduID0gYm9keS5zaXRlSWRzIHx8IFtib2R5LnNpdGVJZF07XG5cbiAgICAgIC8vIFZlcmlmeSBhbGwgc2l0ZXMgYmVsb25nIHRvIG9yZ1xuICAgICAgY29uc3Qgc2l0ZXMgPSBhd2FpdCBwcmlzbWEuc2l0ZS5maW5kTWFueSh7XG4gICAgICAgIHdoZXJlOiB7XG4gICAgICAgICAgaWQ6IHsgaW46IHNpdGVJZHNUb0Fzc2lnbiB9LFxuICAgICAgICAgIG9yZ0lkOiByZXEudXNlciEub3JnSWQsXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKHNpdGVzLmxlbmd0aCAhPT0gc2l0ZUlkc1RvQXNzaWduLmxlbmd0aCkge1xuICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCAnSU5WQUxJRF9TSVRFJywgJ09uZSBvciBtb3JlIHNpdGVzIG5vdCBmb3VuZCBpbiBvcmdhbml6YXRpb24nKTtcbiAgICAgIH1cblxuICAgICAgLy8gVmVyaWZ5IHByaW1hcnkgc2l0ZSBpcyBpbiB0aGUgYXNzaWduZWQgc2l0ZXNcbiAgICAgIGlmICghc2l0ZUlkc1RvQXNzaWduLmluY2x1ZGVzKGJvZHkuc2l0ZUlkKSkge1xuICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCAnSU5WQUxJRF9TSVRFJywgJ1ByaW1hcnkgc2l0ZSBtdXN0IGJlIGluIGFzc2lnbmVkIHNpdGVzJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIENoZWNrIGlmIGVtYWlsIGFscmVhZHkgZXhpc3RzIGluIG9yZ1xuICAgICAgY29uc3QgZXhpc3RpbmdFbWFpbCA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRGaXJzdCh7XG4gICAgICAgIHdoZXJlOiB7IG9yZ0lkOiByZXEudXNlciEub3JnSWQsIGVtYWlsOiBib2R5LmVtYWlsIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKGV4aXN0aW5nRW1haWwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgJ0VNQUlMX0VYSVNUUycsICdBIHVzZXIgd2l0aCB0aGlzIGVtYWlsIGFscmVhZHkgZXhpc3RzIGluIHRoaXMgb3JnYW5pemF0aW9uJyk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGJhc2VVc2VybmFtZSA9IGJ1aWxkVXNlcm5hbWVCYXNlKGJvZHkubmFtZSk7XG4gICAgICBsZXQgY2FuZGlkYXRlVXNlcm5hbWUgPSBib2R5LnVzZXJuYW1lO1xuXG4gICAgICBpZiAoIWNhbmRpZGF0ZVVzZXJuYW1lKSB7XG4gICAgICAgIGxldCBzdWZmaXggPSAwO1xuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgIGNvbnN0IHBvc3NpYmxlID0gYnVpbGRVc2VybmFtZUNhbmRpZGF0ZShiYXNlVXNlcm5hbWUsIHN1ZmZpeCk7XG4gICAgICAgICAgY29uc3QgZXhpc3RpbmdVc2VybmFtZSA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRGaXJzdCh7XG4gICAgICAgICAgICB3aGVyZTogeyB1c2VybmFtZTogcG9zc2libGUgfSxcbiAgICAgICAgICAgIHNlbGVjdDogeyBpZDogdHJ1ZSB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmICghZXhpc3RpbmdVc2VybmFtZSkge1xuICAgICAgICAgICAgY2FuZGlkYXRlVXNlcm5hbWUgPSBwb3NzaWJsZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzdWZmaXggKz0gMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdVc2VybmFtZSA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRGaXJzdCh7XG4gICAgICAgICAgd2hlcmU6IHsgdXNlcm5hbWU6IGNhbmRpZGF0ZVVzZXJuYW1lIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoZXhpc3RpbmdVc2VybmFtZSkge1xuICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsICdVU0VSTkFNRV9FWElTVFMnLCAnQSB1c2VyIHdpdGggdGhpcyB1c2VybmFtZSBhbHJlYWR5IGV4aXN0cycpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHRlbXBQYXNzd29yZCA9IGJvZHkudGVtcG9yYXJ5UGFzc3dvcmQgfHwgKGJvZHkuZ2VuZXJhdGVUZW1wb3JhcnlQYXNzd29yZCA/IGdlbmVyYXRlVGVtcG9yYXJ5UGFzc3dvcmQoKSA6IHVuZGVmaW5lZCk7XG4gICAgICBjb25zdCBzdXBwcmVzc0VtYWlsID0gISF0ZW1wUGFzc3dvcmQ7XG5cbiAgICAgIC8vIENyZWF0ZSB1c2VyIGluIENvZ25pdG8gZmlyc3RcbiAgICAgIGxldCBjb2duaXRvUmVzdWx0O1xuICAgICAgaWYgKCFjYW5kaWRhdGVVc2VybmFtZSkge1xuICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCAnSU5WQUxJRF9VU0VSTkFNRScsICdVbmFibGUgdG8gZ2VuZXJhdGUgdXNlcm5hbWUnKTtcbiAgICAgIH1cblxuICAgICAgbGV0IHN1ZmZpeCA9IDA7XG4gICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICBpZiAoIWJvZHkudXNlcm5hbWUpIHtcbiAgICAgICAgICBjb25zdCBleGlzdGluZ1VzZXJuYW1lID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZEZpcnN0KHtcbiAgICAgICAgICAgIHdoZXJlOiB7IHVzZXJuYW1lOiBjYW5kaWRhdGVVc2VybmFtZSB9LFxuICAgICAgICAgICAgc2VsZWN0OiB7IGlkOiB0cnVlIH0sXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKGV4aXN0aW5nVXNlcm5hbWUpIHtcbiAgICAgICAgICAgIHN1ZmZpeCArPSAxO1xuICAgICAgICAgICAgY2FuZGlkYXRlVXNlcm5hbWUgPSBidWlsZFVzZXJuYW1lQ2FuZGlkYXRlKGJhc2VVc2VybmFtZSwgc3VmZml4KTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29nbml0b1Jlc3VsdCA9IGF3YWl0IGNyZWF0ZUNvZ25pdG9Vc2VyKHtcbiAgICAgICAgICAgIHVzZXJuYW1lOiBjYW5kaWRhdGVVc2VybmFtZSxcbiAgICAgICAgICAgIGVtYWlsOiBib2R5LmVtYWlsLFxuICAgICAgICAgICAgbmFtZTogYm9keS5uYW1lLFxuICAgICAgICAgICAgdGVtcG9yYXJ5UGFzc3dvcmQ6IHRlbXBQYXNzd29yZCxcbiAgICAgICAgICAgIHN1cHByZXNzRW1haWwsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgaWYgKCFib2R5LnVzZXJuYW1lICYmIGVycm9yIGluc3RhbmNlb2YgQ29nbml0b0Vycm9yICYmIGVycm9yLmNvZGUgPT09ICdVU0VSTkFNRV9FWElTVFMnKSB7XG4gICAgICAgICAgICBzdWZmaXggKz0gMTtcbiAgICAgICAgICAgIGNhbmRpZGF0ZVVzZXJuYW1lID0gYnVpbGRVc2VybmFtZUNhbmRpZGF0ZShiYXNlVXNlcm5hbWUsIHN1ZmZpeCk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgQ29nbml0b0Vycm9yKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCBlcnJvci5jb2RlLCBlcnJvci5tZXNzYWdlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gQ3JlYXRlIHVzZXIgaW4gZGF0YWJhc2Ugd2l0aCBDb2duaXRvIElEIGFuZCBzaXRlIGFzc2lnbm1lbnRzXG4gICAgICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuY3JlYXRlKHtcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIGNvZ25pdG9JZDogY29nbml0b1Jlc3VsdC5jb2duaXRvSWQsXG4gICAgICAgICAgdXNlcm5hbWU6IGNhbmRpZGF0ZVVzZXJuYW1lLFxuICAgICAgICAgIGVtYWlsOiBib2R5LmVtYWlsLFxuICAgICAgICAgIG5hbWU6IGJvZHkubmFtZSxcbiAgICAgICAgICBvcmdJZDogcmVxLnVzZXIhLm9yZ0lkLFxuICAgICAgICAgIHNpdGVJZDogYm9keS5zaXRlSWQsXG4gICAgICAgICAgcm9sZTogYm9keS5yb2xlLFxuICAgICAgICAgIHN0YXR1czogJ3BlbmRpbmcnLCAvLyBXaWxsIGJlIGFjdGl2YXRlZCB3aGVuIHVzZXIgc2V0cyBwYXNzd29yZFxuICAgICAgICAgIHNpdGVzOiB7XG4gICAgICAgICAgICBjcmVhdGU6IHNpdGVJZHNUb0Fzc2lnbi5tYXAoKHNpdGVJZCkgPT4gKHsgc2l0ZUlkIH0pKSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBpbmNsdWRlOiB7XG4gICAgICAgICAgc2l0ZTogeyBzZWxlY3Q6IHsgaWQ6IHRydWUsIG5hbWU6IHRydWUgfSB9LFxuICAgICAgICAgIHNpdGVzOiB7XG4gICAgICAgICAgICBpbmNsdWRlOiB7IHNpdGU6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlIH0gfSB9LFxuICAgICAgICAgICAgb3JkZXJCeTogeyBzaXRlOiB7IG5hbWU6ICdhc2MnIH0gfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIHJlcy5zdGF0dXMoMjAxKS5qc29uKHtcbiAgICAgICAgLi4udXNlcixcbiAgICAgICAgLi4uKHRlbXBQYXNzd29yZCA/IHsgdGVtcG9yYXJ5UGFzc3dvcmQ6IHRlbXBQYXNzd29yZCB9IDoge30pLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIG5leHQoZXJyb3IpO1xuICAgIH1cbiAgfVxuKTtcblxuLy8gVXBkYXRlIHVzZXIgKGFkbWluIG9ubHksIG9yIHNlbGYgZm9yIGxpbWl0ZWQgZmllbGRzKVxudXNlcnNSb3V0ZXIucGF0Y2goJy86aWQnLCBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBib2R5ID0gVXBkYXRlVXNlclJlcXVlc3RTY2hlbWEucGFyc2UocmVxLmJvZHkpO1xuXG4gICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kRmlyc3Qoe1xuICAgICAgd2hlcmU6IHtcbiAgICAgICAgaWQ6IHJlcS5wYXJhbXMuaWQsXG4gICAgICAgIG9yZ0lkOiByZXEudXNlciEub3JnSWQsXG4gICAgICB9LFxuICAgICAgaW5jbHVkZToge1xuICAgICAgICBzaXRlczogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIWV4aXN0aW5nKSB7XG4gICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDA0LCAnTk9UX0ZPVU5EJywgJ1VzZXIgbm90IGZvdW5kJyk7XG4gICAgfVxuXG4gICAgLy8gTm9uLWFkbWlucyBjYW4gb25seSB1cGRhdGUgdGhlaXIgb3duIG5hbWVcbiAgICBjb25zdCBpc0FkbWluID0gcmVxLnVzZXIhLnJvbGUgPT09ICdhZG1pbic7XG4gICAgY29uc3QgaXNTZWxmID0gcmVxLnVzZXIhLmlkID09PSByZXEucGFyYW1zLmlkO1xuXG4gICAgaWYgKCFpc0FkbWluICYmICFpc1NlbGYpIHtcbiAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDMsICdGT1JCSURERU4nLCAnQ2Fubm90IHVwZGF0ZSBvdGhlciB1c2VycycpO1xuICAgIH1cblxuICAgIGNvbnN0IHVwZGF0ZURhdGE6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XG4gICAgY29uc3Qgc3RhdHVzQ2hhbmdlID0gaXNBZG1pbiAmJiBib2R5LnN0YXR1cyAmJiBib2R5LnN0YXR1cyAhPT0gZXhpc3Rpbmcuc3RhdHVzO1xuXG4gICAgaWYgKGJvZHkubmFtZSkge1xuICAgICAgdXBkYXRlRGF0YS5uYW1lID0gYm9keS5uYW1lO1xuICAgIH1cblxuICAgIC8vIE9ubHkgYWRtaW5zIGNhbiB1cGRhdGUgcm9sZSwgc3RhdHVzLCBzaXRlc1xuICAgIGlmIChpc0FkbWluKSB7XG4gICAgICBpZiAoYm9keS5yb2xlKSB1cGRhdGVEYXRhLnJvbGUgPSBib2R5LnJvbGU7XG4gICAgICBpZiAoYm9keS5zdGF0dXMpIHVwZGF0ZURhdGEuc3RhdHVzID0gYm9keS5zdGF0dXM7XG5cbiAgICAgIC8vIEhhbmRsZSBzaXRlIGFzc2lnbm1lbnRzIHVwZGF0ZVxuICAgICAgaWYgKGJvZHkuc2l0ZUlkcykge1xuICAgICAgICAvLyBWZXJpZnkgYWxsIHNpdGVzIGJlbG9uZyB0byBvcmdcbiAgICAgICAgY29uc3Qgc2l0ZXMgPSBhd2FpdCBwcmlzbWEuc2l0ZS5maW5kTWFueSh7XG4gICAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICAgIGlkOiB7IGluOiBib2R5LnNpdGVJZHMgfSxcbiAgICAgICAgICAgIG9yZ0lkOiByZXEudXNlciEub3JnSWQsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHNpdGVzLmxlbmd0aCAhPT0gYm9keS5zaXRlSWRzLmxlbmd0aCkge1xuICAgICAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsICdJTlZBTElEX1NJVEUnLCAnT25lIG9yIG1vcmUgc2l0ZXMgbm90IGZvdW5kIGluIG9yZ2FuaXphdGlvbicpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgY2hhbmdpbmcgc2l0ZUlkIHRvbywgdmVyaWZ5IGl0J3MgaW4gdGhlIG5ldyBzaXRlSWRzIGxpc3RcbiAgICAgICAgaWYgKGJvZHkuc2l0ZUlkICYmICFib2R5LnNpdGVJZHMuaW5jbHVkZXMoYm9keS5zaXRlSWQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgJ0lOVkFMSURfU0lURScsICdDdXJyZW50IHNpdGUgbXVzdCBiZSBpbiBhc3NpZ25lZCBzaXRlcycpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgbm90IGNoYW5naW5nIGN1cnJlbnQgc2l0ZUlkLCBlbnN1cmUgaXQncyBzdGlsbCBpbiB0aGUgbGlzdFxuICAgICAgICBpZiAoIWJvZHkuc2l0ZUlkICYmIGV4aXN0aW5nLnNpdGVJZCAmJiAhYm9keS5zaXRlSWRzLmluY2x1ZGVzKGV4aXN0aW5nLnNpdGVJZCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCAnSU5WQUxJRF9TSVRFJywgJ0N1cnJlbnQgc2l0ZSBtdXN0IHJlbWFpbiBpbiBhc3NpZ25lZCBzaXRlcycpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRGVsZXRlIGV4aXN0aW5nIHNpdGUgYXNzaWdubWVudHMgYW5kIGNyZWF0ZSBuZXcgb25lc1xuICAgICAgICBhd2FpdCBwcmlzbWEudXNlclNpdGUuZGVsZXRlTWFueSh7XG4gICAgICAgICAgd2hlcmU6IHsgdXNlcklkOiByZXEucGFyYW1zLmlkIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGF3YWl0IHByaXNtYS51c2VyU2l0ZS5jcmVhdGVNYW55KHtcbiAgICAgICAgICBkYXRhOiBib2R5LnNpdGVJZHMubWFwKChzaXRlSWQpID0+ICh7XG4gICAgICAgICAgICB1c2VySWQ6IHJlcS5wYXJhbXMuaWQsXG4gICAgICAgICAgICBzaXRlSWQsXG4gICAgICAgICAgfSkpLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgaWYgKGJvZHkuc2l0ZUlkKSB7XG4gICAgICAgIC8vIFZlcmlmeSB0aGUgbmV3IGN1cnJlbnQgc2l0ZSBpcyBpbiB1c2VyJ3MgYXNzaWduZWQgc2l0ZXNcbiAgICAgICAgY29uc3QgYXNzaWduZWRTaXRlSWRzID0gYm9keS5zaXRlSWRzIHx8IGV4aXN0aW5nLnNpdGVzLm1hcCgocykgPT4gcy5zaXRlSWQpO1xuICAgICAgICBpZiAoIWFzc2lnbmVkU2l0ZUlkcy5pbmNsdWRlcyhib2R5LnNpdGVJZCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgQXBwRXJyb3IoNDAwLCAnSU5WQUxJRF9TSVRFJywgJ0N1cnJlbnQgc2l0ZSBtdXN0IGJlIGluIGFzc2lnbmVkIHNpdGVzJyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBWZXJpZnkgc2l0ZSBiZWxvbmdzIHRvIG9yZ1xuICAgICAgICBjb25zdCBzaXRlID0gYXdhaXQgcHJpc21hLnNpdGUuZmluZEZpcnN0KHtcbiAgICAgICAgICB3aGVyZToge1xuICAgICAgICAgICAgaWQ6IGJvZHkuc2l0ZUlkLFxuICAgICAgICAgICAgb3JnSWQ6IHJlcS51c2VyIS5vcmdJZCxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKCFzaXRlKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgJ0lOVkFMSURfU0lURScsICdTaXRlIG5vdCBmb3VuZCBpbiBvcmdhbml6YXRpb24nKTtcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGVEYXRhLnNpdGVJZCA9IGJvZHkuc2l0ZUlkO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci51cGRhdGUoe1xuICAgICAgd2hlcmU6IHsgaWQ6IHJlcS5wYXJhbXMuaWQgfSxcbiAgICAgIGRhdGE6IHVwZGF0ZURhdGEsXG4gICAgICBpbmNsdWRlOiB7XG4gICAgICAgIHNpdGU6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlIH0gfSxcbiAgICAgICAgc2l0ZXM6IHtcbiAgICAgICAgICBpbmNsdWRlOiB7IHNpdGU6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlIH0gfSB9LFxuICAgICAgICAgIG9yZGVyQnk6IHsgc2l0ZTogeyBuYW1lOiAnYXNjJyB9IH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKHN0YXR1c0NoYW5nZSAmJiBleGlzdGluZy51c2VybmFtZSAmJiBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ2RldmVsb3BtZW50Jykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgaWYgKGJvZHkuc3RhdHVzID09PSAnaW5hY3RpdmUnKSB7XG4gICAgICAgICAgYXdhaXQgZGlzYWJsZUNvZ25pdG9Vc2VyKGV4aXN0aW5nLnVzZXJuYW1lKTtcbiAgICAgICAgfSBlbHNlIGlmIChib2R5LnN0YXR1cyA9PT0gJ2FjdGl2ZScpIHtcbiAgICAgICAgICBhd2FpdCBlbmFibGVDb2duaXRvVXNlcihleGlzdGluZy51c2VybmFtZSk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBjb25zb2xlLndhcm4oJ0ZhaWxlZCB0byB1cGRhdGUgQ29nbml0byB1c2VyIHN0YXR1czonLCBlcnIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJlcy5qc29uKHVzZXIpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIG5leHQoZXJyb3IpO1xuICB9XG59KTtcblxuLy8gRGVhY3RpdmF0ZSB1c2VyIChhZG1pbiBvbmx5KVxudXNlcnNSb3V0ZXIuZGVsZXRlKFxuICAnLzppZCcsXG4gIGF1dGhvcml6ZSgnYWRtaW4nKSxcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZEZpcnN0KHtcbiAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICBpZDogcmVxLnBhcmFtcy5pZCxcbiAgICAgICAgICBvcmdJZDogcmVxLnVzZXIhLm9yZ0lkLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghZXhpc3RpbmcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgJ05PVF9GT1VORCcsICdVc2VyIG5vdCBmb3VuZCcpO1xuICAgICAgfVxuXG4gICAgICAvLyBEb24ndCBhbGxvdyBkZWxldGluZyB5b3Vyc2VsZlxuICAgICAgaWYgKGV4aXN0aW5nLmlkID09PSByZXEudXNlciEuaWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwMCwgJ0lOVkFMSURfT1BFUkFUSU9OJywgJ0Nhbm5vdCBkZWFjdGl2YXRlIHlvdXJzZWxmJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIFNvZnQgZGVsZXRlIC0ganVzdCBzZXQgdG8gaW5hY3RpdmVcbiAgICAgIGF3YWl0IHByaXNtYS51c2VyLnVwZGF0ZSh7XG4gICAgICAgIHdoZXJlOiB7IGlkOiByZXEucGFyYW1zLmlkIH0sXG4gICAgICAgIGRhdGE6IHsgc3RhdHVzOiAnaW5hY3RpdmUnIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKGV4aXN0aW5nLnVzZXJuYW1lICYmIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAnZGV2ZWxvcG1lbnQnKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYXdhaXQgZGlzYWJsZUNvZ25pdG9Vc2VyKGV4aXN0aW5nLnVzZXJuYW1lKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKCdGYWlsZWQgdG8gZGlzYWJsZSBDb2duaXRvIHVzZXI6JywgZXJyKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXMuc3RhdHVzKDIwNCkuc2VuZCgpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBuZXh0KGVycm9yKTtcbiAgICB9XG4gIH1cbik7XG5cbi8vIFJlc2V0IHVzZXIgcGFzc3dvcmQgKGFkbWluIG9ubHkpXG51c2Vyc1JvdXRlci5wb3N0KFxuICAnLzppZC9yZXNldC1wYXNzd29yZCcsXG4gIGF1dGhvcml6ZSgnYWRtaW4nKSxcbiAgYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGJvZHkgPSBSZXNldFBhc3N3b3JkUmVxdWVzdFNjaGVtYS5wYXJzZShyZXEuYm9keSA/PyB7fSk7XG5cbiAgICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZEZpcnN0KHtcbiAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICBpZDogcmVxLnBhcmFtcy5pZCxcbiAgICAgICAgICBvcmdJZDogcmVxLnVzZXIhLm9yZ0lkLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghZXhpc3RpbmcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFwcEVycm9yKDQwNCwgJ05PVF9GT1VORCcsICdVc2VyIG5vdCBmb3VuZCcpO1xuICAgICAgfVxuXG4gICAgICBpZiAoZXhpc3Rpbmcuc3RhdHVzID09PSAnYXJjaGl2ZWQnKSB7XG4gICAgICAgIHRocm93IG5ldyBBcHBFcnJvcig0MDAsICdBUkNISVZFRCcsICdDYW5ub3QgcmVzZXQgcGFzc3dvcmQgZm9yIGFyY2hpdmVkIHVzZXInKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgdGVtcFBhc3N3b3JkID0gYm9keS50ZW1wb3JhcnlQYXNzd29yZCB8fCAoYm9keS5nZW5lcmF0ZVRlbXBvcmFyeVBhc3N3b3JkID8gZ2VuZXJhdGVUZW1wb3JhcnlQYXNzd29yZCgpIDogdW5kZWZpbmVkKTtcblxuICAgICAgaWYgKGV4aXN0aW5nLnVzZXJuYW1lICYmIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAnZGV2ZWxvcG1lbnQnKSB7XG4gICAgICAgIGF3YWl0IHJlc2V0Q29nbml0b1VzZXJQYXNzd29yZChleGlzdGluZy51c2VybmFtZSwgdGVtcFBhc3N3b3JkKTtcbiAgICAgIH1cblxuICAgICAgYXdhaXQgYXVkaXRMb2coe1xuICAgICAgICBvcmdJZDogcmVxLnVzZXIhLm9yZ0lkLFxuICAgICAgICBhY3RvclVzZXJJZDogcmVxLnVzZXIhLmlkLFxuICAgICAgICBhY3Rpb246ICdyZXNldF9wYXNzd29yZCcsXG4gICAgICAgIGVudGl0eVR5cGU6ICd1c2VyJyxcbiAgICAgICAgZW50aXR5SWQ6IGV4aXN0aW5nLmlkLFxuICAgICAgICBtZXRhZGF0YTogeyB0YXJnZXRVc2VySWQ6IGV4aXN0aW5nLmlkIH0sXG4gICAgICAgIHJlcSxcbiAgICAgIH0pO1xuXG4gICAgICByZXMuanNvbih7XG4gICAgICAgIHN0YXR1czogJ29rJyxcbiAgICAgICAgLi4uKHRlbXBQYXNzd29yZCA/IHsgdGVtcG9yYXJ5UGFzc3dvcmQ6IHRlbXBQYXNzd29yZCB9IDoge30pLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIG5leHQoZXJyb3IpO1xuICAgIH1cbiAgfVxuKTtcbiJdfQ==