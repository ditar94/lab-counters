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
    const { page, pageSize, type, status, specimenId, startDate, endDate, performedBy, siteId, month, year } = filters;

    // Technologists only see records from their current site
    // Other roles can see all records in the org (optionally filtered by site)
    const siteFilter = req.user!.role === 'technologist'
      ? { siteId: req.user!.siteId }
      : siteId
        ? { siteId }
        : {};

    // Build date filter for month/year
    let dateFilter = {};
    if (month && year) {
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
      dateFilter = { createdAt: { gte: monthStart, lte: monthEnd } };
    } else if (year) {
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
      dateFilter = { createdAt: { gte: yearStart, lte: yearEnd } };
    } else if (month) {
      // Month without year - use current year
      const currentYear = new Date().getFullYear();
      const monthStart = new Date(currentYear, month - 1, 1);
      const monthEnd = new Date(currentYear, month, 0, 23, 59, 59, 999);
      dateFilter = { createdAt: { gte: monthStart, lte: monthEnd } };
    }

    const where = {
      orgId: req.user!.orgId,
      ...siteFilter,
      ...(type && { type }),
      ...(status && { status }),
      ...(specimenId && { specimenId: { contains: specimenId } }),
      ...(startDate && !month && !year && { createdAt: { gte: startDate } }),
      ...(endDate && !month && !year && { createdAt: { lte: endDate } }),
      ...dateFilter,
      ...(performedBy && { performedById: performedBy }),
    };

    const [records, total] = await Promise.all([
      prisma.manualCountRecord.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          site: { select: { id: true, name: true } },
          performedBy: { select: { id: true, name: true } },
          verifiedBy: { select: { id: true, name: true } },
        },
      }),
      prisma.manualCountRecord.count({ where }),
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

// Get overdue pending records (pending for more than 24 hours, non-QC only)
// For supervisors/admins to see records needing attention
recordsRouter.get('/alerts/overdue', authorize('supervisor', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get sites user has access to
    const userSiteIds = req.user!.sites?.map((s: { siteId: string }) => s.siteId) || [];

    const overdueRecords = await prisma.manualCountRecord.findMany({
      where: {
        orgId: req.user!.orgId,
        siteId: { in: userSiteIds },
        status: 'pending_verification',
        isQC: false,
        performedAt: { lt: twentyFourHoursAgo },
      },
      select: {
        id: true,
        specimenId: true,
        type: true,
        performedAt: true,
        site: { select: { id: true, name: true } },
        performedBy: { select: { id: true, name: true } },
      },
      orderBy: { performedAt: 'asc' },
      take: 50, // Limit to prevent huge responses
    });

    res.json({
      count: overdueRecords.length,
      records: overdueRecords,
    });
  } catch (error) {
    next(error);
  }
});

// Get single record
recordsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await prisma.manualCountRecord.findFirst({
      where: {
        id: req.params.id,
        orgId: req.user!.orgId,
      },
      include: {
        site: { select: { id: true, name: true } },
        performedBy: { select: { id: true, name: true, email: true } },
        verifiedBy: { select: { id: true, name: true, email: true } },
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
    const calculations = calculateResults(body.type, body.rawTallies);

    const record = await prisma.manualCountRecord.create({
      data: {
        orgId: req.user!.orgId,
        siteId: req.user!.siteId!,
        type: body.type,
        specimenId: body.specimenId,
        fluidType: body.fluidType,
        dilution: body.dilution,
        squaresCounted: body.squaresCounted,
        isQC: body.isQC ?? false,
        status: 'draft',
        rawTallies: body.rawTallies as object,
        calculations: calculations as object,
        performedById: req.user!.id,
      },
      include: {
        site: { select: { id: true, name: true } },
        performedBy: { select: { id: true, name: true } },
      },
    });

    await auditLog({
      orgId: req.user!.orgId,
      entityType: 'manual_count_record',
      entityId: record.id,
      action: 'create',
      metadata: { record },
      actorUserId: req.user!.id,
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

    const existing = await prisma.manualCountRecord.findFirst({
      where: {
        id: req.params.id,
        orgId: req.user!.orgId,
      },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Record not found');
    }

    if (existing.status !== 'draft') {
      throw new AppError(400, 'INVALID_STATUS', 'Only draft records can be updated');
    }

    const updateData: Record<string, unknown> = {};
    if (body.rawTallies) {
      updateData.rawTallies = body.rawTallies;
      updateData.calculations = calculateResults(existing.type, body.rawTallies);
    }
    if (body.status) {
      updateData.status = body.status;
    }

    const record = await prisma.manualCountRecord.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        performedBy: { select: { id: true, name: true } },
      },
    });

    await auditLog({
      orgId: req.user!.orgId,
      entityType: 'manual_count_record',
      entityId: record.id,
      action: 'update',
      metadata: { before: existing, after: record },
      actorUserId: req.user!.id,
      req,
    });

    res.json(record);
  } catch (error) {
    next(error);
  }
});

// Submit for verification (QC records auto-verify)
recordsRouter.post('/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.manualCountRecord.findFirst({
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

    // QC records auto-verify (no peer review needed)
    const isQC = existing.isQC;
    const newStatus = isQC ? 'verified' : 'pending_verification';

    const record = await prisma.manualCountRecord.update({
      where: { id: req.params.id },
      data: {
        status: newStatus,
        ...(isQC && {
          verifiedById: req.user!.id,
          verifiedAt: new Date(),
        }),
      },
    });

    await auditLog({
      orgId: req.user!.orgId,
      entityType: 'manual_count_record',
      entityId: record.id,
      action: isQC ? 'submit_qc_auto_verified' : 'submit_pending',
      metadata: { statusBefore: existing.status, statusAfter: record.status, isQC },
      actorUserId: req.user!.id,
      req,
    });

    res.json(record);
  } catch (error) {
    next(error);
  }
});

// Verify record (technologists, supervisors, and admins can verify others' records)
// Apply strict rate limiting to prevent abuse
recordsRouter.post(
  '/:id/verify',
  sensitiveRateLimiter,
  authorize('technologist', 'supervisor', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      VerifyRecordRequestSchema.parse(req.body);

      const existing = await prisma.manualCountRecord.findFirst({
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

      // Self-verification is never allowed - a different user must verify
      if (existing.performedById === req.user!.id) {
        throw new AppError(403, 'SELF_VERIFICATION_NOT_ALLOWED', 'You cannot verify your own records');
      }

      const record = await prisma.manualCountRecord.update({
        where: { id: req.params.id },
        data: {
          status: 'verified',
          verifiedById: req.user!.id,
          verifiedAt: new Date(),
        },
        include: {
          performedBy: { select: { id: true, name: true } },
          verifiedBy: { select: { id: true, name: true } },
        },
      });

      await auditLog({
        orgId: req.user!.orgId,
        entityType: 'manual_count_record',
        entityId: record.id,
        action: 'verify',
        metadata: { statusBefore: existing.status, statusAfter: record.status, verifiedById: record.verifiedById },
        actorUserId: req.user!.id,
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
      const existing = await prisma.manualCountRecord.findFirst({
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

      await prisma.manualCountRecord.delete({
        where: { id: req.params.id },
      });

      await auditLog({
        orgId: req.user!.orgId,
        entityType: 'manual_count_record',
        entityId: req.params.id,
        action: 'delete',
        metadata: { record: existing },
        actorUserId: req.user!.id,
        req,
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);
