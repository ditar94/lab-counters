import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { auditLog } from '../services/audit';
import { z } from 'zod';

export const reviewsRouter = Router();

// All routes require authentication
reviewsRouter.use(authenticate);

// Schema for creating a monthly review
const CreateMonthlyReviewSchema = z.object({
  siteId: z.string().min(1),
  year: z.number().min(2000).max(2100),
  month: z.number().min(1).max(12),
  notes: z.string().max(1000).optional(),
});

// Get monthly review status for a site/month/year
reviewsRouter.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const siteId = req.query.siteId as string;
    const year = parseInt(req.query.year as string);
    const month = parseInt(req.query.month as string);

    if (!siteId || !year || !month) {
      throw new AppError(400, 'MISSING_PARAMS', 'siteId, year, and month are required');
    }

    // Check site belongs to user's org
    const site = await prisma.site.findFirst({
      where: { id: siteId, orgId: req.user!.orgId },
    });

    if (!site) {
      throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');
    }

    // Get date range for the month
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    // Get record stats for the month
    const [totalRecords, verifiedRecords, pendingRecords, draftRecords, qcRecords] = await Promise.all([
      prisma.manualCountRecord.count({
        where: { siteId, createdAt: { gte: monthStart, lte: monthEnd } },
      }),
      prisma.manualCountRecord.count({
        where: { siteId, createdAt: { gte: monthStart, lte: monthEnd }, status: 'verified' },
      }),
      prisma.manualCountRecord.count({
        where: { siteId, createdAt: { gte: monthStart, lte: monthEnd }, status: 'pending_verification' },
      }),
      prisma.manualCountRecord.count({
        where: { siteId, createdAt: { gte: monthStart, lte: monthEnd }, status: 'draft' },
      }),
      prisma.manualCountRecord.count({
        where: { siteId, createdAt: { gte: monthStart, lte: monthEnd }, isQC: true },
      }),
    ]);

    // Check if review exists
    const review = await prisma.monthlyReview.findUnique({
      where: {
        orgId_siteId_year_month: {
          orgId: req.user!.orgId,
          siteId,
          year,
          month,
        },
      },
      include: {
        reviewedBy: { select: { id: true, name: true } },
      },
    });

    // Non-QC pending records block sign-off
    const nonQcPending = await prisma.manualCountRecord.count({
      where: {
        siteId,
        createdAt: { gte: monthStart, lte: monthEnd },
        status: 'pending_verification',
        isQC: false,
      },
    });

    res.json({
      siteId,
      year,
      month,
      stats: {
        total: totalRecords,
        verified: verifiedRecords,
        pending: pendingRecords,
        draft: draftRecords,
        qc: qcRecords,
        nonQcPending,
      },
      canSignOff: nonQcPending === 0 && draftRecords === 0,
      review: review
        ? {
            id: review.id,
            reviewedAt: review.reviewedAt,
            reviewedBy: review.reviewedBy,
            notes: review.notes,
            stats: review.stats,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

// Get review history for a site
reviewsRouter.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const siteId = req.query.siteId as string;

    if (!siteId) {
      throw new AppError(400, 'MISSING_PARAMS', 'siteId is required');
    }

    // Check site belongs to user's org
    const site = await prisma.site.findFirst({
      where: { id: siteId, orgId: req.user!.orgId },
    });

    if (!site) {
      throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');
    }

    const reviews = await prisma.monthlyReview.findMany({
      where: { siteId, orgId: req.user!.orgId },
      include: {
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    res.json(reviews);
  } catch (error) {
    next(error);
  }
});

// Create monthly review (sign off)
reviewsRouter.post(
  '/',
  authorize('supervisor', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CreateMonthlyReviewSchema.parse(req.body);
      const { siteId, year, month, notes } = body;

      // Check site belongs to user's org
      const site = await prisma.site.findFirst({
        where: { id: siteId, orgId: req.user!.orgId },
      });

      if (!site) {
        throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');
      }

      // Check if review already exists
      const existingReview = await prisma.monthlyReview.findUnique({
        where: {
          orgId_siteId_year_month: {
            orgId: req.user!.orgId,
            siteId,
            year,
            month,
          },
        },
      });

      if (existingReview) {
        throw new AppError(400, 'ALREADY_REVIEWED', 'This month has already been reviewed');
      }

      // Get date range for the month
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

      // Check for non-QC pending or draft records
      const [nonQcPending, drafts] = await Promise.all([
        prisma.manualCountRecord.count({
          where: {
            siteId,
            createdAt: { gte: monthStart, lte: monthEnd },
            status: 'pending_verification',
            isQC: false,
          },
        }),
        prisma.manualCountRecord.count({
          where: {
            siteId,
            createdAt: { gte: monthStart, lte: monthEnd },
            status: 'draft',
          },
        }),
      ]);

      if (nonQcPending > 0) {
        throw new AppError(
          400,
          'PENDING_RECORDS_EXIST',
          `Cannot sign off: ${nonQcPending} record(s) pending verification`
        );
      }

      if (drafts > 0) {
        throw new AppError(
          400,
          'DRAFT_RECORDS_EXIST',
          `Cannot sign off: ${drafts} draft record(s) exist`
        );
      }

      // Get stats snapshot
      const [totalRecords, verifiedRecords, qcRecords] = await Promise.all([
        prisma.manualCountRecord.count({
          where: { siteId, createdAt: { gte: monthStart, lte: monthEnd } },
        }),
        prisma.manualCountRecord.count({
          where: { siteId, createdAt: { gte: monthStart, lte: monthEnd }, status: 'verified' },
        }),
        prisma.manualCountRecord.count({
          where: { siteId, createdAt: { gte: monthStart, lte: monthEnd }, isQC: true },
        }),
      ]);

      const review = await prisma.monthlyReview.create({
        data: {
          orgId: req.user!.orgId,
          siteId,
          year,
          month,
          reviewedById: req.user!.id,
          notes,
          stats: {
            total: totalRecords,
            verified: verifiedRecords,
            qc: qcRecords,
          },
        },
        include: {
          reviewedBy: { select: { id: true, name: true } },
          site: { select: { id: true, name: true } },
        },
      });

      await auditLog({
        orgId: req.user!.orgId,
        actorUserId: req.user!.id,
        action: 'monthly_review_signoff',
        entityType: 'monthly_review',
        entityId: review.id,
        metadata: { year, month, siteId, stats: review.stats },
        req,
      });

      res.status(201).json(review);
    } catch (error) {
      next(error);
    }
  }
);
