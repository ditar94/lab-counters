import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, superadminOnly } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';

export const auditRouter = Router();

// All routes require authentication
auditRouter.use(authenticate);

// Query schema for audit log filtering
const AuditLogQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  actorId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// List audit logs for org admins (only their org's logs)
auditRouter.get('/', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = AuditLogQuerySchema.parse(req.query);
    const { page, pageSize, action, entityType, entityId, actorId, startDate, endDate } = query;

    const where = {
      orgId: req.user!.orgId,
      ...(action && { action: { contains: action } }),
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...(actorId && { actorUserId: actorId }),
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
      ...((startDate && endDate) && { createdAt: { gte: startDate, lte: endDate } }),
    };

    const [logs, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.auditEvent.count({ where }),
    ]);

    res.json({
      data: logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    next(error);
  }
});

// Get distinct actions for filter dropdown
auditRouter.get('/actions', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actions = await prisma.auditEvent.findMany({
      where: { orgId: req.user!.orgId },
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    });

    res.json(actions.map((a: { action: string }) => a.action));
  } catch (error) {
    next(error);
  }
});

// Get distinct entity types for filter dropdown
auditRouter.get('/entity-types', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const types = await prisma.auditEvent.findMany({
      where: { orgId: req.user!.orgId },
      select: { entityType: true },
      distinct: ['entityType'],
      orderBy: { entityType: 'asc' },
    });

    res.json(types.map((t: { entityType: string }) => t.entityType));
  } catch (error) {
    next(error);
  }
});

// Get actors (users) for filter dropdown
auditRouter.get('/actors', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actors = await prisma.user.findMany({
      where: { orgId: req.user!.orgId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    res.json(actors);
  } catch (error) {
    next(error);
  }
});

// ============================================
// Superadmin Routes (all orgs)
// ============================================

// List all audit logs (superadmin only)
auditRouter.get('/all', superadminOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = AuditLogQuerySchema.extend({
      orgId: z.string().uuid().optional(),
    }).parse(req.query);

    const { page, pageSize, action, entityType, entityId, actorId, startDate, endDate, orgId } = query;

    const where = {
      ...(orgId && { orgId }),
      ...(action && { action: { contains: action } }),
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...(actorId && { actorUserId: actorId }),
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
      ...((startDate && endDate) && { createdAt: { gte: startDate, lte: endDate } }),
    };

    const [logs, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, name: true, email: true } },
          organization: { select: { id: true, name: true } },
        },
      }),
      prisma.auditEvent.count({ where }),
    ]);

    res.json({
      data: logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    next(error);
  }
});

// Get all distinct actions (superadmin)
auditRouter.get('/all/actions', superadminOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actions = await prisma.auditEvent.findMany({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    });

    res.json(actions.map((a: { action: string }) => a.action));
  } catch (error) {
    next(error);
  }
});

// Get all distinct entity types (superadmin)
auditRouter.get('/all/entity-types', superadminOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const types = await prisma.auditEvent.findMany({
      select: { entityType: true },
      distinct: ['entityType'],
      orderBy: { entityType: 'asc' },
    });

    res.json(types.map((t: { entityType: string }) => t.entityType));
  } catch (error) {
    next(error);
  }
});

// Get all organizations (superadmin)
auditRouter.get('/all/organizations', superadminOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    res.json(orgs);
  } catch (error) {
    next(error);
  }
});
