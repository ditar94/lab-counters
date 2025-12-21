import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, enforceOrgScope } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { sensitiveRateLimiter } from '../middleware/security';
import { auditLog } from '../services/audit';
import {
  CreateRecordRequestSchema,
  UpdateRecordRequestSchema,
  VerifyRecordRequestSchema,
  RecordFilterSchema,
} from '@lab-counters/shared';
import { calculateResults } from '../services/calculations';

export const recordsRouter = Router();

// All routes require authentication
recordsRouter.use(authenticate);
recordsRouter.use(enforceOrgScope);

// List records (with filtering and pagination)
recordsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = RecordFilterSchema.parse(req.query);
    const { page, pageSize, type, status, specimenId, startDate, endDate, createdBy, siteId } = filters;

    // Technologists only see records from their current site
    // Other roles can see all records in the org (optionally filtered by site)
    const siteFilter = req.user!.role === 'technologist'
      ? { siteId: req.user!.siteId }
      : siteId
        ? { siteId }
        : {};

    const where = {
      orgId: req.user!.orgId,
      ...siteFilter,
      ...(type && { type }),
      ...(status && { status }),
      ...(specimenId && { specimenId: { contains: specimenId } }),
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
      ...(createdBy && { createdById: createdBy }),
    };

    const [records, total] = await Promise.all([
      prisma.countRecord.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          site: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          verifiedBy: { select: { id: true, name: true } },
        },
      }),
      prisma.countRecord.count({ where }),
    ]);

    res.json({
      data: records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    next(error);
  }
});

// Get single record
recordsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await prisma.countRecord.findFirst({
      where: {
        id: req.params.id,
        orgId: req.user!.orgId,
      },
      include: {
        site: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        verifiedBy: { select: { id: true, name: true, email: true } },
        corrections: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!record) {
      throw new AppError(404, 'NOT_FOUND', 'Record not found');
    }

    res.json(record);
  } catch (error) {
    next(error);
  }
});

// Create new record
recordsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateRecordRequestSchema.parse(req.body);
    const calculations = calculateResults(body.type, body.data);

    const record = await prisma.countRecord.create({
      data: {
        orgId: req.user!.orgId,
        siteId: req.user!.siteId,
        type: body.type,
        specimenId: body.specimenId,
        specimenType: body.specimenType,
        status: 'draft',
        data: body.data as object,
        calculations: calculations as object,
        createdById: req.user!.id,
      },
      include: {
        site: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await auditLog({
      orgId: req.user!.orgId,
      tableName: 'count_records',
      recordId: record.id,
      action: 'create',
      newValues: record,
      userId: req.user!.id,
      req,
    });

    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
});

// Update record (only drafts can be updated)
recordsRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = UpdateRecordRequestSchema.parse(req.body);

    const existing = await prisma.countRecord.findFirst({
      where: {
        id: req.params.id,
        orgId: req.user!.orgId,
      },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Record not found');
    }

    if (existing.isImmutable) {
      throw new AppError(400, 'IMMUTABLE', 'Verified records cannot be modified');
    }

    if (existing.status !== 'draft') {
      throw new AppError(400, 'INVALID_STATUS', 'Only draft records can be updated');
    }

    const updateData: Record<string, unknown> = {};
    if (body.data) {
      updateData.data = body.data;
      updateData.calculations = calculateResults(existing.type, body.data);
    }
    if (body.status) {
      updateData.status = body.status;
    }

    const record = await prisma.countRecord.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    await auditLog({
      orgId: req.user!.orgId,
      tableName: 'count_records',
      recordId: record.id,
      action: 'update',
      oldValues: existing,
      newValues: record,
      userId: req.user!.id,
      req,
    });

    res.json(record);
  } catch (error) {
    next(error);
  }
});

// Submit for verification
recordsRouter.post('/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.countRecord.findFirst({
      where: {
        id: req.params.id,
        orgId: req.user!.orgId,
      },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Record not found');
    }

    if (existing.status !== 'draft') {
      throw new AppError(400, 'INVALID_STATUS', 'Only draft records can be submitted');
    }

    const record = await prisma.countRecord.update({
      where: { id: req.params.id },
      data: { status: 'pending_verification' },
    });

    await auditLog({
      orgId: req.user!.orgId,
      tableName: 'count_records',
      recordId: record.id,
      action: 'update',
      oldValues: { status: existing.status },
      newValues: { status: record.status },
      userId: req.user!.id,
      req,
    });

    res.json(record);
  } catch (error) {
    next(error);
  }
});

// Verify record (supervisors and admins only)
// Apply strict rate limiting to prevent abuse
recordsRouter.post(
  '/:id/verify',
  sensitiveRateLimiter,
  authorize('supervisor', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      VerifyRecordRequestSchema.parse(req.body);

      const existing = await prisma.countRecord.findFirst({
        where: {
          id: req.params.id,
          orgId: req.user!.orgId,
        },
      });

      if (!existing) {
        throw new AppError(404, 'NOT_FOUND', 'Record not found');
      }

      if (existing.status !== 'pending_verification') {
        throw new AppError(400, 'INVALID_STATUS', 'Only pending records can be verified');
      }

      // Check if self-verification is allowed
      if (existing.createdById === req.user!.id) {
        // Get org settings to check if self-verification is allowed
        const org = await prisma.organization.findUnique({
          where: { id: req.user!.orgId },
          select: { settings: true },
        });
        const settings = org?.settings as { allowSelfVerification?: boolean } | null;

        if (!settings?.allowSelfVerification) {
          throw new AppError(403, 'SELF_VERIFICATION_NOT_ALLOWED', 'You cannot verify your own records');
        }
      }

      const record = await prisma.countRecord.update({
        where: { id: req.params.id },
        data: {
          status: 'verified',
          verifiedById: req.user!.id,
          verifiedAt: new Date(),
          isImmutable: true,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          verifiedBy: { select: { id: true, name: true } },
        },
      });

      await auditLog({
        orgId: req.user!.orgId,
        tableName: 'count_records',
        recordId: record.id,
        action: 'verify',
        oldValues: { status: existing.status },
        newValues: { status: record.status, verifiedById: record.verifiedById },
        userId: req.user!.id,
        req,
      });

      res.json(record);
    } catch (error) {
      next(error);
    }
  }
);

// Delete record (only drafts, admins only)
recordsRouter.delete(
  '/:id',
  authorize('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.countRecord.findFirst({
        where: {
          id: req.params.id,
          orgId: req.user!.orgId,
        },
      });

      if (!existing) {
        throw new AppError(404, 'NOT_FOUND', 'Record not found');
      }

      if (existing.status !== 'draft') {
        throw new AppError(400, 'INVALID_STATUS', 'Only draft records can be deleted');
      }

      await prisma.countRecord.delete({
        where: { id: req.params.id },
      });

      await auditLog({
        orgId: req.user!.orgId,
        tableName: 'count_records',
        recordId: req.params.id,
        action: 'delete',
        oldValues: existing,
        userId: req.user!.id,
        req,
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);
