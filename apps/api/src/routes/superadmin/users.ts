import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error-handler';
import { auditLog } from '../../services/audit';
import { createCognitoUser, CognitoError, deleteCognitoUser, disableCognitoUser, enableCognitoUser, resetCognitoUserPassword } from '../../services/cognito';
import { CreateOrgAdminSchema, ResetPasswordRequestSchema } from '@lab-counters/shared';
import { generateTemporaryPassword } from '../../lib/passwords';
import { buildUsernameBase, buildUsernameCandidate } from '../../lib/usernames';

export const usersRouter = Router({ mergeParams: true }); // To access :orgId from parent

// List users in an organization
usersRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params;

    // Verify org exists
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new AppError(404, 'NOT_FOUND', 'Organization not found');
    }

    if (org.slug === 'system') {
      throw new AppError(403, 'FORBIDDEN', 'Cannot access system organization users');
    }

    const users = await prisma.user.findMany({
      where: { orgId },
      include: {
        site: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Create org admin (initial admin for an organization)
usersRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params;
    const body = CreateOrgAdminSchema.parse(req.body);

    // Verify org exists
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new AppError(404, 'NOT_FOUND', 'Organization not found');
    }

    if (org.slug === 'system') {
      throw new AppError(403, 'FORBIDDEN', 'Cannot add users to system organization');
    }

    const siteIdsToAssign = body.siteIds ?? [body.siteId];

    if (!siteIdsToAssign.includes(body.siteId)) {
      throw new AppError(400, 'INVALID_SITE', 'Primary site must be in assigned sites');
    }

    // Verify all sites belong to org
    const sites = await prisma.site.findMany({
      where: {
        id: { in: siteIdsToAssign },
        orgId,
      },
      select: { id: true },
    });

    if (sites.length !== siteIdsToAssign.length) {
      throw new AppError(400, 'INVALID_SITE', 'One or more sites not found in this organization');
    }

    // Check if email already exists in org
    const existingUser = await prisma.user.findFirst({
      where: { orgId, email: body.email },
    });

    if (existingUser) {
      throw new AppError(400, 'EMAIL_EXISTS', 'A user with this email already exists in this organization');
    }

    const baseUsername = buildUsernameBase(body.name);
    let candidateUsername = body.username;

    if (!candidateUsername) {
      let suffix = 0;
      while (true) {
        const possible = buildUsernameCandidate(baseUsername, suffix);
        const existingUsername = await prisma.user.findFirst({
          where: { username: possible },
          select: { id: true },
        });
        if (!existingUsername) {
          candidateUsername = possible;
          break;
        }
        suffix += 1;
      }
    } else {
      const existingUsername = await prisma.user.findFirst({
        where: { username: candidateUsername },
      });
      if (existingUsername) {
        throw new AppError(400, 'USERNAME_EXISTS', 'A user with this username already exists');
      }
    }

    const tempPassword = body.temporaryPassword || (body.generateTemporaryPassword ? generateTemporaryPassword() : undefined);
    const suppressEmail = !!tempPassword;

    // Create user in Cognito first
    let cognitoResult;
    if (!candidateUsername) {
      throw new AppError(400, 'INVALID_USERNAME', 'Unable to generate username');
    }

    let suffix = 0;
    while (true) {
      if (!body.username) {
        const existingUsername = await prisma.user.findFirst({
          where: { username: candidateUsername },
          select: { id: true },
        });
        if (existingUsername) {
          suffix += 1;
          candidateUsername = buildUsernameCandidate(baseUsername, suffix);
          continue;
        }
      }

      try {
        cognitoResult = await createCognitoUser({
          username: candidateUsername,
          email: body.email,
          name: body.name,
          temporaryPassword: tempPassword,
          suppressEmail,
        });
        break;
      } catch (error) {
        if (!body.username && error instanceof CognitoError && error.code === 'USERNAME_EXISTS') {
          suffix += 1;
          candidateUsername = buildUsernameCandidate(baseUsername, suffix);
          continue;
        }
        if (error instanceof CognitoError) {
          throw new AppError(400, error.code, error.message);
        }
        throw error;
      }
    }

    // Create user in database with Cognito ID
    const user = await prisma.user.create({
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

    await auditLog({
      orgId,
      actorUserId: req.user!.id,
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
  } catch (error) {
    next(error);
  }
});

// Get single user
usersRouter.get('/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, userId } = req.params;

    const user = await prisma.user.findFirst({
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
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update user status (activate/deactivate)
usersRouter.patch('/:userId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, userId } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'inactive'].includes(status)) {
      throw new AppError(400, 'INVALID_STATUS', 'Status must be active or inactive');
    }

    const existing = await prisma.user.findFirst({
      where: { id: userId, orgId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    // Don't allow status change on superadmins
    if (existing.role === 'superadmin') {
      throw new AppError(403, 'FORBIDDEN', 'Cannot change status of superadmin users');
    }

    if (existing.status === 'archived') {
      throw new AppError(400, 'ARCHIVED', 'Cannot change status of archived user. Restore it first.');
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { status },
      include: {
        site: { select: { id: true, name: true } },
      },
    });

    if (existing.username && process.env.NODE_ENV !== 'development') {
      try {
        if (status === 'inactive') {
          await disableCognitoUser(existing.username);
        } else if (status === 'active') {
          await enableCognitoUser(existing.username);
        }
      } catch (err) {
        console.warn('Failed to update Cognito user status:', err);
      }
    }

    await auditLog({
      orgId,
      actorUserId: req.user!.id,
      action: 'update',
      entityType: 'user',
      entityId: user.id,
      metadata: { statusBefore: existing.status, statusAfter: user.status },
      req,
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Archive user
usersRouter.post('/:userId/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, userId } = req.params;

    const existing = await prisma.user.findFirst({
      where: { id: userId, orgId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    if (existing.role === 'superadmin') {
      throw new AppError(403, 'FORBIDDEN', 'Cannot archive superadmin users');
    }

    if (existing.status === 'archived') {
      throw new AppError(400, 'ALREADY_ARCHIVED', 'User is already archived');
    }

    const user = await prisma.user.update({
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
        await disableCognitoUser(existing.username);
      } catch (err) {
        console.warn('Failed to disable Cognito user:', err);
      }
    }

    await auditLog({
      orgId,
      actorUserId: req.user!.id,
      action: 'update',
      entityType: 'user',
      entityId: user.id,
      metadata: { statusBefore: existing.status, statusAfter: 'archived', archivedAt: user.archivedAt },
      req,
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Restore archived user
usersRouter.post('/:userId/restore', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, userId } = req.params;

    const existing = await prisma.user.findFirst({
      where: { id: userId, orgId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    if (existing.status !== 'archived') {
      throw new AppError(400, 'NOT_ARCHIVED', 'User is not archived');
    }

    // Set to inactive - admin needs to explicitly activate
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'inactive',
        archivedAt: null,
      },
      include: {
        site: { select: { id: true, name: true } },
      },
    });

    await auditLog({
      orgId,
      actorUserId: req.user!.id,
      action: 'update',
      entityType: 'user',
      entityId: user.id,
      metadata: { statusBefore: existing.status, statusAfter: 'inactive', archivedAt: null },
      req,
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Reset user password
usersRouter.post('/:userId/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, userId } = req.params;
    const body = ResetPasswordRequestSchema.parse(req.body ?? {});

    const existing = await prisma.user.findFirst({
      where: { id: userId, orgId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    if (existing.status === 'archived') {
      throw new AppError(400, 'ARCHIVED', 'Cannot reset password for archived user');
    }

    const tempPassword = body.temporaryPassword || (body.generateTemporaryPassword ? generateTemporaryPassword() : undefined);

    if (existing.username && process.env.NODE_ENV !== 'development') {
      await resetCognitoUserPassword(existing.username, tempPassword);
    }

    await auditLog({
      orgId,
      actorUserId: req.user!.id,
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
  } catch (error) {
    next(error);
  }
});

// Permanently delete user
usersRouter.delete('/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, userId } = req.params;
    const { confirm } = req.query;

    const existing = await prisma.user.findFirst({
      where: { id: userId, orgId },
      include: {
        _count: { select: { performedRecords: true, verifiedRecords: true } },
      },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    if (existing.role === 'superadmin') {
      throw new AppError(403, 'FORBIDDEN', 'Cannot delete superadmin users');
    }

    // Prevent self-deletion
    if (existing.id === req.user!.id) {
      throw new AppError(400, 'CANNOT_DELETE_SELF', 'Cannot delete your own account');
    }

    // Prevent deletion if user has records
    const totalRecords = existing._count.performedRecords + existing._count.verifiedRecords;
    if (totalRecords > 0) {
      throw new AppError(400, 'USER_HAS_RECORDS',
        `User has ${existing._count.performedRecords} performed and ${existing._count.verifiedRecords} verified records and cannot be deleted.`);
    }

    // Warn if not archived first
    if (existing.status !== 'archived' && confirm !== 'true') {
      throw new AppError(400, 'NOT_ARCHIVED',
        'User should be archived before permanent deletion. Add ?confirm=true to delete anyway.');
    }

    await auditLog({
      orgId,
      actorUserId: req.user!.id,
      action: 'delete',
      entityType: 'user',
      entityId: userId,
      metadata: { record: existing, counts: existing._count },
      req,
    });

    if (existing.username && process.env.NODE_ENV !== 'development') {
      try {
        await deleteCognitoUser(existing.username);
      } catch (err) {
        console.warn('Failed to delete Cognito user:', err);
      }
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
