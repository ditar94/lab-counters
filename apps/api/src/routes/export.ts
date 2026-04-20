import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, enforceOrgScope } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { auditLog } from '../services/audit';
import { z } from 'zod';
import type { CountRecordType, RecordStatus } from '@lab-counters/shared';

export const exportRouter = Router();

// All routes require authentication and org scoping
exportRouter.use(authenticate);
exportRouter.use(enforceOrgScope);

// Schema for export query parameters
const ExportQuerySchema = z.object({
  siteId: z.string().min(1).optional(),
  month: z.coerce.number().min(1).max(12).optional(),
  year: z.coerce.number().min(2000).max(2100).optional(),
  type: z.enum(['hemocytometer', 'fetal', 'retic', 'parasite']).optional(),
  status: z.enum(['draft', 'pending_verification', 'verified', 'corrected']).optional(),
});

const MonthlyReviewQuerySchema = z.object({
  siteId: z.string().min(1),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100),
  type: z.enum(['hemocytometer', 'fetal', 'retic', 'parasite']).optional(),
});

// Type for record with relations
interface RecordWithRelations {
  id: string;
  specimenId: string;
  type: CountRecordType;
  status: RecordStatus;
  fluidType: string | null;
  dilution: number;
  squaresCounted: number;
  isQC: boolean;
  rawTallies: unknown;
  calculations: unknown;
  performedAt: Date;
  verifiedAt: Date | null;
  site: { id: string; name: string };
  performedBy: { id: string; name: string };
  verifiedBy: { id: string; name: string } | null;
}

// CSV utility functions
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function formatTime(date: Date): string {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  return `${hours}:${minutes} ${ampm}`;
}

// Extract hemocytometer-specific fields for Monthly Review
interface HemocytometerRawTallies {
  side1?: {
    squaresCounted?: number;
    dilutionFactor?: number;
    tncSquaresCounted?: number;
    tncDilution?: number;
    rbcSquaresCounted?: number;
    rbcDilution?: number;
    separateSettings?: boolean;
  };
}

function getHemocytometerFields(rawTallies: unknown): {
  squaresCountedTnc: string;
  squaresCountedRbc: string;
  dilutionTnc: string;
  dilutionRbc: string;
} {
  const tallies = rawTallies as HemocytometerRawTallies;
  const side1 = tallies?.side1;

  if (!side1) {
    return {
      squaresCountedTnc: '',
      squaresCountedRbc: '',
      dilutionTnc: '',
      dilutionRbc: '',
    };
  }

  // Check if using separate settings for TNC/RBC
  const useSeparate = side1.separateSettings;

  return {
    squaresCountedTnc: String(useSeparate ? (side1.tncSquaresCounted ?? side1.squaresCounted ?? '') : (side1.squaresCounted ?? '')),
    squaresCountedRbc: String(useSeparate ? (side1.rbcSquaresCounted ?? side1.squaresCounted ?? '') : (side1.squaresCounted ?? '')),
    dilutionTnc: String(useSeparate ? (side1.tncDilution ?? side1.dilutionFactor ?? '') : (side1.dilutionFactor ?? '')),
    dilutionRbc: String(useSeparate ? (side1.rbcDilution ?? side1.dilutionFactor ?? '') : (side1.dilutionFactor ?? '')),
  };
}

// Generate Monthly Review CSV
function generateMonthlyReviewCSV(records: RecordWithRelations[]): string {
  const headers = [
    'Date',
    'Specimen ID',
    'Squares Counted TNC',
    'Squares Counted RBC',
    'Dilution TNC',
    'Dilution RBC',
    'Performer',
    'Performed Time',
    'Verifier',
    'Verified Time',
  ];

  const rows = records.map((record) => {
    const hemoFields = getHemocytometerFields(record.rawTallies);
    const performedDate = new Date(record.performedAt);
    const verifiedDate = record.verifiedAt ? new Date(record.verifiedAt) : null;

    return [
      escapeCSV(formatDate(performedDate)),
      escapeCSV(record.specimenId),
      escapeCSV(hemoFields.squaresCountedTnc),
      escapeCSV(hemoFields.squaresCountedRbc),
      escapeCSV(hemoFields.dilutionTnc),
      escapeCSV(hemoFields.dilutionRbc),
      escapeCSV(record.performedBy.name),
      escapeCSV(formatTime(performedDate)),
      escapeCSV(record.verifiedBy?.name ?? ''),
      escapeCSV(verifiedDate ? formatTime(verifiedDate) : ''),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

// Generate full records export CSV
function generateRecordsCSV(records: RecordWithRelations[]): string {
  const headers = [
    'ID',
    'Specimen ID',
    'Type',
    'Fluid Type',
    'Status',
    'Is QC',
    'Site',
    'Dilution',
    'Squares Counted',
    'Performed At',
    'Performed By',
    'Verified At',
    'Verified By',
  ];

  const rows = records.map((record) => {
    const performedDate = new Date(record.performedAt);
    const verifiedDate = record.verifiedAt ? new Date(record.verifiedAt) : null;

    return [
      escapeCSV(record.id),
      escapeCSV(record.specimenId),
      escapeCSV(record.type),
      escapeCSV(record.fluidType),
      escapeCSV(record.status),
      escapeCSV(record.isQC ? 'Yes' : 'No'),
      escapeCSV(record.site.name),
      escapeCSV(record.dilution),
      escapeCSV(record.squaresCounted),
      escapeCSV(`${formatDate(performedDate)} ${formatTime(performedDate)}`),
      escapeCSV(record.performedBy.name),
      escapeCSV(verifiedDate ? `${formatDate(verifiedDate)} ${formatTime(verifiedDate)}` : ''),
      escapeCSV(record.verifiedBy?.name ?? ''),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

// Monthly Review Export - supervisors and admins only
exportRouter.get(
  '/monthly-review',
  authorize('supervisor', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = MonthlyReviewQuerySchema.parse(req.query);
      const { siteId, month, year, type } = query;

      // Verify site belongs to user's org
      const site = await prisma.site.findFirst({
        where: { id: siteId, orgId: req.user!.orgId },
      });

      if (!site) {
        throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');
      }

      // Calculate date range for the month
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

      // Fetch verified records only for monthly review
      const records = await prisma.manualCountRecord.findMany({
        where: {
          orgId: req.user!.orgId,
          siteId,
          status: 'verified',
          createdAt: { gte: monthStart, lte: monthEnd },
          ...(type && { type }),
        },
        include: {
          site: { select: { id: true, name: true } },
          performedBy: { select: { id: true, name: true } },
          verifiedBy: { select: { id: true, name: true } },
        },
        orderBy: { performedAt: 'asc' },
      });

      // Audit log the export
      await auditLog({
        orgId: req.user!.orgId,
        actorUserId: req.user!.id,
        action: 'export_monthly_review',
        entityType: 'export',
        entityId: `${siteId}-${year}-${month}`,
        metadata: { siteId, month, year, recordCount: records.length, type: type ?? 'all' },
        req,
      });

      // Generate CSV
      const csv = generateMonthlyReviewCSV(records as unknown as RecordWithRelations[]);
      const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
      const filename = `monthly-review-${site.name.replace(/[^a-zA-Z0-9]/g, '-')}-${monthName}-${year}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
);

// General records export - supervisors and admins only
exportRouter.get(
  '/records',
  authorize('supervisor', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = ExportQuerySchema.parse(req.query);
      const { siteId, month, year, type, status } = query;

      // If siteId provided, verify it belongs to user's org
      if (siteId) {
        const site = await prisma.site.findFirst({
          where: { id: siteId, orgId: req.user!.orgId },
        });

        if (!site) {
          throw new AppError(404, 'SITE_NOT_FOUND', 'Site not found');
        }
      }

      // Build date filter
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
        const currentYear = new Date().getFullYear();
        const monthStart = new Date(currentYear, month - 1, 1);
        const monthEnd = new Date(currentYear, month, 0, 23, 59, 59, 999);
        dateFilter = { createdAt: { gte: monthStart, lte: monthEnd } };
      }

      // Fetch records
      const records = await prisma.manualCountRecord.findMany({
        where: {
          orgId: req.user!.orgId,
          ...(siteId && { siteId }),
          ...(type && { type }),
          ...(status && { status }),
          ...dateFilter,
        },
        include: {
          site: { select: { id: true, name: true } },
          performedBy: { select: { id: true, name: true } },
          verifiedBy: { select: { id: true, name: true } },
        },
        orderBy: { performedAt: 'desc' },
      });

      // Audit log the export
      await auditLog({
        orgId: req.user!.orgId,
        actorUserId: req.user!.id,
        action: 'export_records',
        entityType: 'export',
        entityId: `records-${Date.now()}`,
        metadata: { siteId: siteId ?? 'all', month, year, type: type ?? 'all', status: status ?? 'all', recordCount: records.length },
        req,
      });

      // Generate CSV
      const csv = generateRecordsCSV(records as unknown as RecordWithRelations[]);
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `records-export-${timestamp}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
);
