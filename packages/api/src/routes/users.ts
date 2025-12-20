import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, enforceOrgScope } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
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
        },
        orderBy: { name: 'asc' },
      });

      res.json(users);
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

      // Note: In production, this would create a Cognito user
      // and use the Cognito ID. For now, generate a placeholder.
      const user = await prisma.user.create({
        data: {
          cognitoId: `pending-${Date.now()}`,
          email: body.email,
          name: body.name,
          orgId: req.user!.orgId,
          siteId: body.siteId,
          role: body.role,
          status: 'pending',
        },
        include: {
          site: { select: { id: true, name: true } },
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

    // Only admins can update role, status, site
    if (isAdmin) {
      if (body.role) updateData.role = body.role;
      if (body.status) updateData.status = body.status;
      if (body.siteId) {
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
