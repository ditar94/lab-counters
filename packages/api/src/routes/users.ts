import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, enforceOrgScope } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { createCognitoUser, CognitoError, disableCognitoUser, enableCognitoUser, resetCognitoUserPassword } from '../services/cognito';
import { CreateUserRequestSchema, UpdateUserRequestSchema, ResetPasswordRequestSchema } from '@lab-counters/shared';
import { auditLog } from '../services/audit';
import { generateTemporaryPassword } from '../lib/passwords';
import { buildUsernameBase, buildUsernameCandidate } from '../lib/usernames';

export const usersRouter = Router();

// All routes require authentication
usersRouter.use(authenticate);
usersRouter.use(enforceOrgScope);

// List users in organization (admin only)
usersRouter.get(
  '/',
  authorize('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await prisma.user.findMany({
        where: { orgId: req.user!.orgId },
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
    } catch (error) {
      next(error);
    }
  }
);

// List sites in organization (for user creation forms)
usersRouter.get(
  '/sites',
  authorize('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sites = await prisma.site.findMany({
        where: { orgId: req.user!.orgId },
        select: { id: true, name: true, location: true },
        orderBy: { name: 'asc' },
      });

      res.json(sites);
    } catch (error) {
      next(error);
    }
  }
);

// Get single user
usersRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findFirst({
      where: {
        id: req.params.id,
        orgId: req.user!.orgId,
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
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Create user (admin only)
usersRouter.post(
  '/',
  authorize('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CreateUserRequestSchema.parse(req.body);

      // Determine all sites to assign (default to just the primary site)
      const siteIdsToAssign = body.siteIds || [body.siteId];

      // Verify all sites belong to org
      const sites = await prisma.site.findMany({
        where: {
          id: { in: siteIdsToAssign },
          orgId: req.user!.orgId,
        },
      });

      if (sites.length !== siteIdsToAssign.length) {
        throw new AppError(400, 'INVALID_SITE', 'One or more sites not found in organization');
      }

      // Verify primary site is in the assigned sites
      if (!siteIdsToAssign.includes(body.siteId)) {
        throw new AppError(400, 'INVALID_SITE', 'Primary site must be in assigned sites');
      }

      // Check if email already exists in org
      const existingEmail = await prisma.user.findFirst({
        where: { orgId: req.user!.orgId, email: body.email },
      });

      if (existingEmail) {
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

      // Create user in database with Cognito ID and site assignments
      const user = await prisma.user.create({
        data: {
          cognitoId: cognitoResult.cognitoId,
          username: candidateUsername,
          email: body.email,
          name: body.name,
          orgId: req.user!.orgId,
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
    } catch (error) {
      next(error);
    }
  }
);

// Update user (admin only, or self for limited fields)
usersRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = UpdateUserRequestSchema.parse(req.body);

    const existing = await prisma.user.findFirst({
      where: {
        id: req.params.id,
        orgId: req.user!.orgId,
      },
      include: {
        sites: true,
      },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    // Non-admins can only update their own name
    const isAdmin = req.user!.role === 'admin';
    const isSelf = req.user!.id === req.params.id;

    if (!isAdmin && !isSelf) {
      throw new AppError(403, 'FORBIDDEN', 'Cannot update other users');
    }

    const updateData: Record<string, unknown> = {};
    const statusChange = isAdmin && body.status && body.status !== existing.status;

    if (body.name) {
      updateData.name = body.name;
    }

    // Only admins can update role, status, sites
    if (isAdmin) {
      if (body.role) updateData.role = body.role;
      if (body.status) updateData.status = body.status;

      // Handle site assignments update
      if (body.siteIds) {
        // Verify all sites belong to org
        const sites = await prisma.site.findMany({
          where: {
            id: { in: body.siteIds },
            orgId: req.user!.orgId,
          },
        });

        if (sites.length !== body.siteIds.length) {
          throw new AppError(400, 'INVALID_SITE', 'One or more sites not found in organization');
        }

        // If changing siteId too, verify it's in the new siteIds list
        if (body.siteId && !body.siteIds.includes(body.siteId)) {
          throw new AppError(400, 'INVALID_SITE', 'Current site must be in assigned sites');
        }

        // If not changing current siteId, ensure it's still in the list
        if (!body.siteId && existing.siteId && !body.siteIds.includes(existing.siteId)) {
          throw new AppError(400, 'INVALID_SITE', 'Current site must remain in assigned sites');
        }

        // Delete existing site assignments and create new ones
        await prisma.userSite.deleteMany({
          where: { userId: req.params.id },
        });

        await prisma.userSite.createMany({
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
          throw new AppError(400, 'INVALID_SITE', 'Current site must be in assigned sites');
        }

        // Verify site belongs to org
        const site = await prisma.site.findFirst({
          where: {
            id: body.siteId,
            orgId: req.user!.orgId,
          },
        });
        if (!site) {
          throw new AppError(400, 'INVALID_SITE', 'Site not found in organization');
        }
        updateData.siteId = body.siteId;
      }
    }

    const user = await prisma.user.update({
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
          await disableCognitoUser(existing.username);
        } else if (body.status === 'active') {
          await enableCognitoUser(existing.username);
        }
      } catch (err) {
        console.warn('Failed to update Cognito user status:', err);
      }
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Deactivate user (admin only)
usersRouter.delete(
  '/:id',
  authorize('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.user.findFirst({
        where: {
          id: req.params.id,
          orgId: req.user!.orgId,
        },
      });

      if (!existing) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
      }

      // Don't allow deleting yourself
      if (existing.id === req.user!.id) {
        throw new AppError(400, 'INVALID_OPERATION', 'Cannot deactivate yourself');
      }

      // Soft delete - just set to inactive
      await prisma.user.update({
        where: { id: req.params.id },
        data: { status: 'inactive' },
      });

      if (existing.username && process.env.NODE_ENV !== 'development') {
        try {
          await disableCognitoUser(existing.username);
        } catch (err) {
          console.warn('Failed to disable Cognito user:', err);
        }
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// Reset user password (admin only)
usersRouter.post(
  '/:id/reset-password',
  authorize('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = ResetPasswordRequestSchema.parse(req.body ?? {});

      const existing = await prisma.user.findFirst({
        where: {
          id: req.params.id,
          orgId: req.user!.orgId,
        },
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
        orgId: req.user!.orgId,
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
  }
);
