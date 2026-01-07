import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, enforceOrgScope } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { sensitiveRateLimiter } from '../middleware/security';
import { auditLog } from '../services/audit';
import { createParamsSnapshot } from '../services/method-config';
import {
  CreateRecordRequestSchema,
  UpdateRecordRequestSchema,
  SubmitRecordRequestSchema,
  VerifyRecordRequestSchema,
  CreateCorrectionRequestSchema,
  RecordFilterSchema,
  CURRENT_METHOD_VERSION,
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

    // Get sites user has access to by querying UserSite table
    const userSites = await prisma.userSite.findMany({
      where: { userId: req.user!.id },
      select: { siteId: true },
    });
    const userSiteIds = userSites.map((us) => us.siteId);

    // If user has no site assignments, return empty result
    if (userSiteIds.length === 0) {
      res.json({ count: 0, records: [] });
      return;
    }

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

    // Capture method params snapshot for historical accuracy
    const paramsSnapshot = await createParamsSnapshot(req.user!.orgId, body.type);

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
        methodVersion: CURRENT_METHOD_VERSION,
        paramsSnapshot: paramsSnapshot as object,
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
    const body = SubmitRecordRequestSchema.parse(req.body);

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
        performerAttestation: body.performerAttestation,
        performerAttestedAt: new Date(),
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
      metadata: { statusBefore: existing.status, statusAfter: record.status, isQC, performerAttestation: body.performerAttestation },
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
      const body = VerifyRecordRequestSchema.parse(req.body);

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
          verifierAttestation: body.verifierAttestation,
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
        metadata: { statusBefore: existing.status, statusAfter: record.status, verifiedById: record.verifiedById, verifierAttestation: body.verifierAttestation },
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

// Amend/correct a verified record (updates in place, no new version)
// Supervisors/admins can amend any record, technologists can only amend their own
// Status changes to 'corrected', changes are logged to audit trail
recordsRouter.post(
  '/:id/amend',
  sensitiveRateLimiter,
  authorize('technologist', 'supervisor', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CreateCorrectionRequestSchema.parse(req.body);

      const existing = await prisma.manualCountRecord.findFirst({
        where: {
          id: req.params.id,
          orgId: req.user!.orgId,
        },
        include: {
          performedBy: { select: { id: true, name: true } },
          verifiedBy: { select: { id: true, name: true } },
        },
      });

      if (!existing) {
        throw new AppError(404, 'NOT_FOUND', 'Record not found');
      }

      // Allow amending verified or already-corrected records
      if (existing.status !== 'verified' && existing.status !== 'corrected') {
        throw new AppError(400, 'INVALID_STATUS', 'Only verified or corrected records can be amended');
      }

      // Check permission: technologists can only amend their own records
      const isOwnRecord = existing.performedById === req.user!.id;
      const isSupervisorOrAdmin = req.user!.role === 'supervisor' || req.user!.role === 'admin';

      if (!isOwnRecord && !isSupervisorOrAdmin) {
        throw new AppError(403, 'FORBIDDEN', 'You can only amend your own records');
      }

      // Track what changed for the audit log
      const changes: Record<string, { before: unknown; after: unknown }> = {};

      // Determine what's being changed
      const rawTalliesToUse = body.rawTallies ?? existing.rawTallies;
      const talliesChanged = body.rawTallies !== undefined &&
        JSON.stringify(body.rawTallies) !== JSON.stringify(existing.rawTallies);

      if (talliesChanged) {
        changes.rawTallies = { before: existing.rawTallies, after: body.rawTallies };
        // Note: calculations is a derived field, not tracked separately in changedFields
      }

      if (body.specimenId && body.specimenId !== existing.specimenId) {
        changes.specimenId = { before: existing.specimenId, after: body.specimenId };
      }

      if (body.performedAt) {
        const newPerformedAt = new Date(body.performedAt);
        if (newPerformedAt.getTime() !== existing.performedAt.getTime()) {
          changes.performedAt = { before: existing.performedAt, after: newPerformedAt };
        }
      }

      // Must have at least one change
      if (Object.keys(changes).length === 0) {
        throw new AppError(400, 'NO_CHANGES', 'No changes were made to the record');
      }

      // Build update data
      const updateData: Record<string, unknown> = {
        status: 'corrected',
        correctionReason: body.reason,
      };

      if (talliesChanged && body.rawTallies) {
        updateData.rawTallies = body.rawTallies;
        updateData.calculations = calculateResults(existing.type, body.rawTallies as Record<string, unknown>);
      }

      if (body.specimenId) {
        updateData.specimenId = body.specimenId;
      }

      if (body.performedAt) {
        updateData.performedAt = new Date(body.performedAt);
      }

      // Update the record in place
      const updatedRecord = await prisma.manualCountRecord.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          site: { select: { id: true, name: true } },
          performedBy: { select: { id: true, name: true } },
          verifiedBy: { select: { id: true, name: true } },
        },
      });

      // Log detailed changes to audit trail
      await auditLog({
        orgId: req.user!.orgId,
        entityType: 'manual_count_record',
        entityId: updatedRecord.id,
        action: 'amend',
        metadata: {
          correctionReason: body.reason,
          changes,
          changedFields: Object.keys(changes),
        },
        actorUserId: req.user!.id,
        req,
      });

      res.json(updatedRecord);
    } catch (error) {
      next(error);
    }
  }
);

// Get audit log for a record
// Returns all audit events related to this record
recordsRouter.get('/:id/audit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await prisma.manualCountRecord.findFirst({
      where: {
        id: req.params.id,
        orgId: req.user!.orgId,
      },
    });

    if (!record) {
      throw new AppError(404, 'NOT_FOUND', 'Record not found');
    }

    // Get all audit events for this record
    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        entityType: 'manual_count_record',
        entityId: req.params.id,
        orgId: req.user!.orgId,
      },
      include: {
        actor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format the audit events for display
    const events = auditEvents.map((event) => ({
      id: event.id,
      action: event.action,
      createdAt: event.createdAt,
      actor: event.actor,
      metadata: event.metadata as Record<string, unknown>,
    }));

    res.json({ events });
  } catch (error) {
    next(error);
  }
});
