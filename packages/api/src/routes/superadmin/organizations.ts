import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error-handler';
import { auditLog } from '../../services/audit';
import { CreateOrganizationSchema, UpdateOrganizationSchema } from '@lab-counters/shared';

export const organizationsRouter = Router();

// List all organizations (excluding system org)
organizationsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizations = await prisma.organization.findMany({
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
  } catch (error) {
    next(error);
  }
});

// Get single organization with details
organizationsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await prisma.organization.findUnique({
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
      throw new AppError(404, 'NOT_FOUND', 'Organization not found');
    }

    if (org.slug === 'system') {
      throw new AppError(403, 'FORBIDDEN', 'Cannot access system organization');
    }

    res.json(org);
  } catch (error) {
    next(error);
  }
});

// Create organization
organizationsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateOrganizationSchema.parse(req.body);

    // Check slug uniqueness
    const existing = await prisma.organization.findUnique({
      where: { slug: body.slug },
    });

    if (existing) {
      throw new AppError(400, 'SLUG_EXISTS', 'An organization with this slug already exists');
    }

    // Prevent creating org with reserved slug
    if (body.slug === 'system') {
      throw new AppError(400, 'RESERVED_SLUG', 'This slug is reserved');
    }

    const defaultSettings = {
      timezone: 'America/New_York',
      defaultDilution: 10,
      requireVerification: true,
      allowSelfVerification: false,
    };

    const org = await prisma.organization.create({
      data: {
        name: body.name,
        slug: body.slug,
        settings: { ...defaultSettings, ...body.settings },
      },
    });

    await auditLog({
      orgId: org.id,
      tableName: 'organizations',
      recordId: org.id,
      action: 'create',
      newValues: org,
      userId: req.user!.id,
      req,
    });

    res.status(201).json(org);
  } catch (error) {
    next(error);
  }
});

// Update organization
organizationsRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = UpdateOrganizationSchema.parse(req.body);

    const existing = await prisma.organization.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Organization not found');
    }

    if (existing.slug === 'system') {
      throw new AppError(403, 'FORBIDDEN', 'Cannot modify system organization');
    }

    const updateData: Record<string, unknown> = {};
    if (body.name) updateData.name = body.name;
    if (body.settings) {
      updateData.settings = { ...(existing.settings as object), ...body.settings };
    }

    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await auditLog({
      orgId: org.id,
      tableName: 'organizations',
      recordId: org.id,
      action: 'update',
      oldValues: existing,
      newValues: org,
      userId: req.user!.id,
      req,
    });

    res.json(org);
  } catch (error) {
    next(error);
  }
});

// Change organization status (active/inactive)
organizationsRouter.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;

    if (!status || !['active', 'inactive'].includes(status)) {
      throw new AppError(400, 'INVALID_STATUS', 'Status must be active or inactive');
    }

    const existing = await prisma.organization.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Organization not found');
    }

    if (existing.slug === 'system') {
      throw new AppError(403, 'FORBIDDEN', 'Cannot modify system organization');
    }

    if (existing.status === 'archived') {
      throw new AppError(400, 'ARCHIVED', 'Cannot change status of archived organization. Restore it first.');
    }

    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: { status },
    });

    // If deactivating, also deactivate all users
    if (status === 'inactive') {
      await prisma.user.updateMany({
        where: { orgId: req.params.id, status: 'active' },
        data: { status: 'inactive' },
      });
    }

    await auditLog({
      orgId: org.id,
      tableName: 'organizations',
      recordId: org.id,
      action: 'update',
      oldValues: { status: existing.status },
      newValues: { status: org.status },
      userId: req.user!.id,
      req,
    });

    res.json(org);
  } catch (error) {
    next(error);
  }
});

// Archive organization (soft delete - can be restored)
organizationsRouter.post('/:id/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.organization.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Organization not found');
    }

    if (existing.slug === 'system') {
      throw new AppError(403, 'FORBIDDEN', 'Cannot archive system organization');
    }

    if (existing.status === 'archived') {
      throw new AppError(400, 'ALREADY_ARCHIVED', 'Organization is already archived');
    }

    // Archive the org
    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: {
        status: 'archived',
        archivedAt: new Date(),
      },
    });

    // Archive all users in the org
    await prisma.user.updateMany({
      where: { orgId: req.params.id },
      data: {
        status: 'archived',
        archivedAt: new Date(),
      },
    });

    // Archive all sites in the org
    await prisma.site.updateMany({
      where: { orgId: req.params.id },
      data: {
        status: 'archived',
        archivedAt: new Date(),
      },
    });

    await auditLog({
      orgId: org.id,
      tableName: 'organizations',
      recordId: org.id,
      action: 'update',
      oldValues: { status: existing.status },
      newValues: { status: 'archived', archivedAt: org.archivedAt },
      userId: req.user!.id,
      req,
    });

    res.json(org);
  } catch (error) {
    next(error);
  }
});

// Restore archived organization
organizationsRouter.post('/:id/restore', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.organization.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Organization not found');
    }

    if (existing.status !== 'archived') {
      throw new AppError(400, 'NOT_ARCHIVED', 'Organization is not archived');
    }

    // Restore the org
    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: {
        status: 'active',
        archivedAt: null,
      },
    });

    // Restore all sites (but not users - they need to be activated individually)
    await prisma.site.updateMany({
      where: { orgId: req.params.id },
      data: {
        status: 'active',
        archivedAt: null,
      },
    });

    // Set users to inactive (not active) - admin needs to reactivate them
    await prisma.user.updateMany({
      where: { orgId: req.params.id, status: 'archived' },
      data: {
        status: 'inactive',
        archivedAt: null,
      },
    });

    await auditLog({
      orgId: org.id,
      tableName: 'organizations',
      recordId: org.id,
      action: 'update',
      oldValues: { status: existing.status, archivedAt: existing.archivedAt },
      newValues: { status: 'active', archivedAt: null },
      userId: req.user!.id,
      req,
    });

    res.json(org);
  } catch (error) {
    next(error);
  }
});

// Permanently delete organization
// Only allowed for archived orgs with no records, or if confirmed
organizationsRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { confirm } = req.query;

    const existing = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { users: true, countRecords: true } },
      },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Organization not found');
    }

    if (existing.slug === 'system') {
      throw new AppError(403, 'FORBIDDEN', 'Cannot delete system organization');
    }

    // If org has records, require explicit confirmation
    if (existing._count.countRecords > 0 && confirm !== 'true') {
      throw new AppError(400, 'HAS_RECORDS',
        `Organization has ${existing._count.countRecords} records. Add ?confirm=true to permanently delete.`);
    }

    // Warn if not archived first
    if (existing.status !== 'archived' && confirm !== 'true') {
      throw new AppError(400, 'NOT_ARCHIVED',
        'Organization should be archived before permanent deletion. Add ?confirm=true to delete anyway.');
    }

    // Log before deletion
    await auditLog({
      orgId: existing.id,
      tableName: 'organizations',
      recordId: existing.id,
      action: 'delete',
      oldValues: { ...existing, _count: existing._count },
      userId: req.user!.id,
      req,
    });

    // Cascade delete will handle users, sites, records
    await prisma.organization.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
