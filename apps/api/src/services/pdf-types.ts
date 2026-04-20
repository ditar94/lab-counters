import type { CountRecordType, RecordStatus, ParamsSnapshot } from '@lab-counters/shared';

export interface AuditEventForPdf {
  action: string;
  createdAt: Date;
  actor?: { name: string } | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Full record data for PDF generation
 */
export interface RecordForPdf {
  id: string;
  type: CountRecordType;
  specimenId: string;
  fluidType: string;
  dilution: number;
  squaresCounted: number;
  isQC: boolean;
  status: RecordStatus;
  rawTallies: unknown;
  calculations: unknown;
  methodVersion: string;
  paramsSnapshot?: ParamsSnapshot | null;
  version: number;
  correctionReason?: string | null;
  performedAt: Date;
  performerAttestation?: string | null;
  performerAttestedAt?: Date | null;
  verifiedAt?: Date | null;
  verifierAttestation?: string | null;
  createdAt: Date;
  organization: { name: string; slug: string };
  site: { name: string; location: string };
  performedBy: { name: string; email: string };
  verifiedBy?: { name: string; email: string } | null;
  auditEvents?: AuditEventForPdf[];
}
