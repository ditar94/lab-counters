import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error-handler';
import { auditLog } from '../../services/audit';
import { CreateSiteSchema, UpdateSiteSchema } from '@lab-counters/shared';

export const sitesRouter = Router({ mergeParams: true }); // To access :orgId from parent

// List sites in an organization
sitesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
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
      throw new AppError(403, 'FORBIDDEN', 'Cannot access system organization');
    }

    const sites = await prisma.site.findMany({
      where: { orgId },
      include: {
        _count: { select: { users: true, countRecords: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json(sites);
  } catch (error) {
    next(error);
  }
});

// Get single site
sitesRouter.get('/:siteId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, siteId } = req.params;

    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        orgId,
      },
      include: {
        users: {
          select: { id: true, name: true, email: true, role: true, status: true },
          orderBy: { name: 'asc' },
        },
        _count: { select: { countRecords: true } },
      },
    });

    if (!site) {
      throw new AppError(404, 'NOT_FOUND', 'Site not found');
    }

    res.json(site);
  } catch (error) {
    next(error);
  }
});

// Create site in organization
sitesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params;
    const body = CreateSiteSchema.parse(req.body);

    // Verify org exists
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new AppError(404, 'NOT_FOUND', 'Organization not found');
    }

    if (org.slug === 'system') {
      throw new AppError(403, 'FORBIDDEN', 'Cannot add sites to system organization');
    }

    const site = await prisma.site.create({
      data: {
        orgId,
        name: body.name,
        location: body.location || '',
        settings: body.settings || {},
      },
    });

    await auditLog({
      orgId,
      tableName: 'sites',
      recordId: site.id,
      action: 'create',
      newValues: site,
      userId: req.user!.id,
      req,
    });

    res.status(201).json(site);
  } catch (error) {
    next(error);
  }
});

// Update site
sitesRouter.patch('/:siteId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, siteId } = req.params;
    const body = UpdateSiteSchema.parse(req.body);

    const existing = await prisma.site.findFirst({
      where: { id: siteId, orgId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Site not found');
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.settings) {
      updateData.settings = { ...(existing.settings as object), ...body.settings };
    }

    const site = await prisma.site.update({
      where: { id: siteId },
      data: updateData,
    });

    await auditLog({
      orgId,
      tableName: 'sites',
      recordId: site.id,
      action: 'update',
      oldValues: existing,
      newValues: site,
      userId: req.user!.id,
      req,
    });

    res.json(site);
  } catch (error) {
    next(error);
  }
});

// Change site status (active/inactive)
sitesRouter.patch('/:siteId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, siteId } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'inactive'].includes(status)) {
      throw new AppError(400, 'INVALID_STATUS', 'Status must be active or inactive');
    }

    const existing = await prisma.site.findFirst({
      where: { id: siteId, orgId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Site not found');
    }

    if (existing.status === 'archived') {
      throw new AppError(400, 'ARCHIVED', 'Cannot change status of archived site. Restore it first.');
    }

    const site = await prisma.site.update({
      where: { id: siteId },
      data: { status },
    });

    await auditLog({
      orgId,
      tableName: 'sites',
      recordId: site.id,
      action: 'update',
      oldValues: { status: existing.status },
      newValues: { status: site.status },
      userId: req.user!.id,
      req,
    });

    res.json(site);
  } catch (error) {
    next(error);
  }
});

// Archive site
sitesRouter.post('/:siteId/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, siteId } = req.params;

    const existing = await prisma.site.findFirst({
      where: { id: siteId, orgId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Site not found');
    }

    if (existing.status === 'archived') {
      throw new AppError(400, 'ALREADY_ARCHIVED', 'Site is already archived');
    }

    const site = await prisma.site.update({
      where: { id: siteId },
      data: {
        status: 'archived',
        archivedAt: new Date(),
      },
    });

    await auditLog({
      orgId,
      tableName: 'sites',
      recordId: site.id,
      action: 'update',
      oldValues: { status: existing.status },
      newValues: { status: 'archived', archivedAt: site.archivedAt },
      userId: req.user!.id,
      req,
    });

    res.json(site);
  } catch (error) {
    next(error);
  }
});

// Restore archived site
sitesRouter.post('/:siteId/restore', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, siteId } = req.params;

    const existing = await prisma.site.findFirst({
      where: { id: siteId, orgId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Site not found');
    }

    if (existing.status !== 'archived') {
      throw new AppError(400, 'NOT_ARCHIVED', 'Site is not archived');
    }

    const site = await prisma.site.update({
      where: { id: siteId },
      data: {
        status: 'active',
        archivedAt: null,
      },
    });

    await auditLog({
      orgId,
      tableName: 'sites',
      recordId: site.id,
      action: 'update',
      oldValues: { status: existing.status, archivedAt: existing.archivedAt },
      newValues: { status: 'active', archivedAt: null },
      userId: req.user!.id,
      req,
    });

    res.json(site);
  } catch (error) {
    next(error);
  }
});

// Permanently delete site
sitesRouter.delete('/:siteId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, siteId } = req.params;
    const { confirm } = req.query;

    const existing = await prisma.site.findFirst({
      where: { id: siteId, orgId },
      include: {
        _count: { select: { users: true, countRecords: true } },
      },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Site not found');
    }

    // Prevent deletion if site has users (unless confirmed)
    if (existing._count.users > 0 && confirm !== 'true') {
      throw new AppError(400, 'SITE_HAS_USERS',
        `Site has ${existing._count.users} users. Reassign them first or add ?confirm=true to delete.`);
    }

    // Warn about records
    if (existing._count.countRecords > 0 && confirm !== 'true') {
      throw new AppError(400, 'SITE_HAS_RECORDS',
        `Site has ${existing._count.countRecords} records. Add ?confirm=true to permanently delete.`);
    }

    // Warn if not archived first
    if (existing.status !== 'archived' && confirm !== 'true') {
      throw new AppError(400, 'NOT_ARCHIVED',
        'Site should be archived before permanent deletion. Add ?confirm=true to delete anyway.');
    }

    await auditLog({
      orgId,
      tableName: 'sites',
      recordId: siteId,
      action: 'delete',
      oldValues: { ...existing, _count: existing._count },
      userId: req.user!.id,
      req,
    });

    await prisma.site.delete({
      where: { id: siteId },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
