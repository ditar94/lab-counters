import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, enforceOrgScope } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { generateRecordPdf, getPdfStorageKey, RecordForPdf } from '../services/pdf-generator';
import { getStorageProvider } from '../services/storage';
import { auditLog } from '../services/audit';

export const pdfRouter = Router();

// All routes require authentication
pdfRouter.use(authenticate);
pdfRouter.use(enforceOrgScope);

/**
 * Generate/download PDF for a record
 * GET /api/pdf/records/:id
 *
 * Query params:
 *   - regenerate: If true, regenerate even if cached
 */
pdfRouter.get('/records/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const regenerate = req.query.regenerate === 'true';

    // Fetch the record with all needed relations
    const record = await prisma.manualCountRecord.findFirst({
      where: {
        id,
        orgId: req.user!.orgId,
      },
      include: {
        organization: { select: { name: true, slug: true } },
        site: { select: { name: true, location: true } },
        performedBy: { select: { name: true, email: true } },
        verifiedBy: { select: { name: true, email: true } },
      },
    });

    if (!record) {
      throw new AppError(404, 'NOT_FOUND', 'Record not found');
    }

    // Only allow PDF generation for verified or corrected records
    if (record.status !== 'verified' && record.status !== 'corrected') {
      throw new AppError(400, 'INVALID_STATUS', 'PDF can only be generated for verified or corrected records');
    }

    // Check if user has access to this site
    if (req.user!.role !== 'admin' && req.user!.role !== 'superadmin') {
      const userSites = await prisma.userSite.findMany({
        where: { userId: req.user!.id },
        select: { siteId: true },
      });
      const userSiteIds = userSites.map((us: { siteId: string }) => us.siteId);

      if (!userSiteIds.includes(record.siteId)) {
        throw new AppError(403, 'FORBIDDEN', 'You do not have access to this record');
      }
    }

    const storage = getStorageProvider();
    const storageKey = getPdfStorageKey(record);

    let pdfBuffer: Buffer;
    let wasRegenerated = false;

    // Check if PDF already exists and we don't need to regenerate
    if (!regenerate) {
      try {
        const exists = await storage.exists(storageKey);
        if (exists) {
          pdfBuffer = await storage.get(storageKey);
        } else {
          // Generate new PDF
          const recordForPdf: RecordForPdf = {
            id: record.id,
            type: record.type,
            specimenId: record.specimenId,
            fluidType: record.fluidType,
            dilution: record.dilution,
            squaresCounted: record.squaresCounted,
            isQC: record.isQC,
            status: record.status,
            rawTallies: record.rawTallies,
            calculations: record.calculations,
            methodVersion: record.methodVersion,
            paramsSnapshot: record.paramsSnapshot,
            version: record.version,
            correctionReason: record.correctionReason,
            performedAt: record.performedAt,
            performerAttestation: record.performerAttestation,
            performerAttestedAt: record.performerAttestedAt,
            verifiedAt: record.verifiedAt,
            verifierAttestation: record.verifierAttestation,
            createdAt: record.createdAt,
            organization: record.organization,
            site: record.site,
            performedBy: record.performedBy,
            verifiedBy: record.verifiedBy,
          };

          pdfBuffer = await generateRecordPdf(recordForPdf);
          await storage.put(storageKey, pdfBuffer, 'application/pdf');
          wasRegenerated = true;
        }
      } catch (err) {
        // If storage check fails, generate fresh
        const recordForPdf: RecordForPdf = {
          id: record.id,
          type: record.type,
          specimenId: record.specimenId,
          fluidType: record.fluidType,
          dilution: record.dilution,
          squaresCounted: record.squaresCounted,
          isQC: record.isQC,
          status: record.status,
          rawTallies: record.rawTallies,
          calculations: record.calculations,
          methodVersion: record.methodVersion,
          paramsSnapshot: record.paramsSnapshot,
          version: record.version,
          correctionReason: record.correctionReason,
          performedAt: record.performedAt,
          performerAttestation: record.performerAttestation,
          performerAttestedAt: record.performerAttestedAt,
          verifiedAt: record.verifiedAt,
          verifierAttestation: record.verifierAttestation,
          createdAt: record.createdAt,
          organization: record.organization,
          site: record.site,
          performedBy: record.performedBy,
          verifiedBy: record.verifiedBy,
        };

        pdfBuffer = await generateRecordPdf(recordForPdf);
        try {
          await storage.put(storageKey, pdfBuffer, 'application/pdf');
        } catch {
          // Storage failed but we can still return the PDF
          console.warn('Failed to store PDF, returning generated version');
        }
        wasRegenerated = true;
      }
    } else {
      // Force regenerate
      const recordForPdf: RecordForPdf = {
        id: record.id,
        type: record.type,
        specimenId: record.specimenId,
        fluidType: record.fluidType,
        dilution: record.dilution,
        squaresCounted: record.squaresCounted,
        isQC: record.isQC,
        status: record.status,
        rawTallies: record.rawTallies,
        calculations: record.calculations,
        methodVersion: record.methodVersion,
        paramsSnapshot: record.paramsSnapshot,
        version: record.version,
        correctionReason: record.correctionReason,
        performedAt: record.performedAt,
        performerAttestation: record.performerAttestation,
        performerAttestedAt: record.performerAttestedAt,
        verifiedAt: record.verifiedAt,
        verifierAttestation: record.verifierAttestation,
        createdAt: record.createdAt,
        organization: record.organization,
        site: record.site,
        performedBy: record.performedBy,
        verifiedBy: record.verifiedBy,
      };

      pdfBuffer = await generateRecordPdf(recordForPdf);
      await storage.put(storageKey, pdfBuffer, 'application/pdf');
      wasRegenerated = true;
    }

    // Log the PDF access
    await auditLog({
      orgId: req.user!.orgId,
      actorUserId: req.user!.id,
      action: wasRegenerated ? 'pdf_generated' : 'pdf_downloaded',
      entityType: 'record',
      entityId: record.id,
      metadata: {
        recordVersion: record.version,
        specimenId: record.specimenId,
        recordType: record.type,
        regenerated: wasRegenerated,
      },
      req,
    });

    // Return the PDF
    const filename = `${record.specimenId}_${record.type}_v${record.version}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

/**
 * Check if PDF exists for a record
 * HEAD /api/pdf/records/:id
 */
pdfRouter.head('/records/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const record = await prisma.manualCountRecord.findFirst({
      where: {
        id,
        orgId: req.user!.orgId,
      },
      select: {
        id: true,
        orgId: true,
        siteId: true,
        version: true,
        status: true,
      },
    });

    if (!record) {
      res.status(404).send();
      return;
    }

    if (record.status !== 'verified' && record.status !== 'corrected') {
      res.status(400).send();
      return;
    }

    const storage = getStorageProvider();
    const storageKey = getPdfStorageKey(record);

    const exists = await storage.exists(storageKey);
    if (exists) {
      res.status(200).send();
    } else {
      res.status(204).send(); // No content - PDF doesn't exist yet but can be generated
    }
  } catch (error) {
    next(error);
  }
});
