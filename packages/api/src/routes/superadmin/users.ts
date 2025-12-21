import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error-handler';
import { auditLog } from '../../services/audit';
import { createCognitoUser, CognitoError } from '../../services/cognito';
import { CreateOrgAdminSchema } from '@lab-counters/shared';

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

    // Verify site belongs to org
    const site = await prisma.site.findFirst({
      where: { id: body.siteId, orgId },
    });

    if (!site) {
      throw new AppError(400, 'INVALID_SITE', 'Site not found in this organization');
    }

    // Check if email already exists in org
    const existingUser = await prisma.user.findFirst({
      where: { orgId, email: body.email },
    });

    if (existingUser) {
      throw new AppError(400, 'EMAIL_EXISTS', 'A user with this email already exists in this organization');
    }

    // Check if username already exists
    const existingUsername = await prisma.user.findFirst({
      where: { username: body.username },
    });

    if (existingUsername) {
      throw new AppError(400, 'USERNAME_EXISTS', 'A user with this username already exists');
    }

    // Create user in Cognito first
    let cognitoResult;
    try {
      cognitoResult = await createCognitoUser({
        username: body.username,
        email: body.email,
        name: body.name,
        temporaryPassword: body.temporaryPassword,
        suppressEmail: !!body.temporaryPassword,
      });
    } catch (error) {
      if (error instanceof CognitoError) {
        throw new AppError(400, error.code, error.message);
      }
      throw error;
    }

    // Create user in database with Cognito ID
    const user = await prisma.user.create({
      data: {
        cognitoId: cognitoResult.cognitoId,
        username: body.username,
        email: body.email,
        name: body.name,
        orgId,
        siteId: body.siteId,
        role: 'admin', // Superadmin creates org admins
        status: 'pending', // Will be activated when user sets password
      },
      include: {
        site: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
      },
    });

    await auditLog({
      orgId,
      tableName: 'users',
      recordId: user.id,
      action: 'create',
      newValues: user,
      userId: req.user!.id,
      req,
    });

    res.status(201).json(user);
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
        _count: { select: { createdRecords: true, verifiedRecords: true } },
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

    await auditLog({
      orgId,
      tableName: 'users',
      recordId: user.id,
      action: 'update',
      oldValues: { status: existing.status },
      newValues: { status: user.status },
      userId: req.user!.id,
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

    await auditLog({
      orgId,
      tableName: 'users',
      recordId: user.id,
      action: 'update',
      oldValues: { status: existing.status },
      newValues: { status: 'archived', archivedAt: user.archivedAt },
      userId: req.user!.id,
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
      tableName: 'users',
      recordId: user.id,
      action: 'update',
      oldValues: { status: existing.status, archivedAt: existing.archivedAt },
      newValues: { status: 'inactive', archivedAt: null },
      userId: req.user!.id,
      req,
    });

    res.json(user);
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
        _count: { select: { createdRecords: true, verifiedRecords: true } },
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

    // Warn about records
    const totalRecords = existing._count.createdRecords + existing._count.verifiedRecords;
    if (totalRecords > 0 && confirm !== 'true') {
      throw new AppError(400, 'USER_HAS_RECORDS',
        `User has ${existing._count.createdRecords} created and ${existing._count.verifiedRecords} verified records. Add ?confirm=true to permanently delete.`);
    }

    // Warn if not archived first
    if (existing.status !== 'archived' && confirm !== 'true') {
      throw new AppError(400, 'NOT_ARCHIVED',
        'User should be archived before permanent deletion. Add ?confirm=true to delete anyway.');
    }

    await auditLog({
      orgId,
      tableName: 'users',
      recordId: userId,
      action: 'delete',
      oldValues: { ...existing, _count: existing._count },
      userId: req.user!.id,
      req,
    });

    await prisma.user.delete({
      where: { id: userId },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
