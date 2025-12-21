import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, enforceOrgScope } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { createCognitoUser, CognitoError } from '../services/cognito';
import { CreateUserRequestSchema, UpdateUserRequestSchema } from '@lab-counters/shared';

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

      // Create user in database with Cognito ID and site assignments
      const user = await prisma.user.create({
        data: {
          cognitoId: cognitoResult.cognitoId,
          username: body.username,
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

      res.status(201).json(user);
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
        if (!body.siteId && !body.siteIds.includes(existing.siteId)) {
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

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);
