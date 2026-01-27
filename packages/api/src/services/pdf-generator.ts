import PDFDocument from 'pdfkit';
import type {
  CountRecordType,
  HemocytometerData,
  HemocytometerCalculations,
  FetalData,
  FetalCalculations,
  ReticData,
  ReticCalculations,
  ParasiteData,
  ParasiteCalculations,
  RecordStatus,
} from '@lab-counters/shared';

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
  paramsSnapshot: unknown;
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
}

const FLUID_TYPE_LABELS: Record<string, string> = {
  csf: 'Cerebrospinal Fluid (CSF)',
  synovial: 'Synovial Fluid',
  pleural: 'Pleural Fluid',
  peritoneal: 'Peritoneal Fluid',
  pericardial: 'Pericardial Fluid',
  other: 'Other',
};

const COUNTER_TYPE_LABELS: Record<CountRecordType, string> = {
  hemocytometer: 'Hemocytometer Cell Count',
  fetal: 'Fetal Cell (Kleihauer-Betke) Test',
  retic: 'Reticulocyte Count',
  parasite: 'Parasite Count',
};

/**
 * Generate PDF for a verified record
 * Returns a Buffer containing the PDF data
 */
export async function generateRecordPdf(record: RecordForPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 50,
      info: {
        Title: `Manual Count Worksheet - ${record.specimenId}`,
        Author: record.performedBy.name,
        Subject: `${COUNTER_TYPE_LABELS[record.type]} for specimen ${record.specimenId}`,
        Creator: 'Lab Counters Application',
        Producer: 'Lab Counters / PDFKit',
      },
    });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    renderHeader(doc, record);

    // Record identification
    doc.moveDown(0.5);
    renderRecordInfo(doc, record);

    // Count data based on type
    doc.moveDown(0.5);
    renderCountData(doc, record);

    // Attestations and signatures
    doc.moveDown(0.5);
    renderAttestations(doc, record);

    // Audit information
    doc.moveDown(0.5);
    renderAuditInfo(doc, record);

    // Footer
    renderFooter(doc, record);

    doc.end();
  });
}

function renderHeader(doc: PDFKit.PDFDocument, record: RecordForPdf): void {
  const pageWidth = doc.page.width - 100;

  // Organization name
  doc.fontSize(16).font('Helvetica-Bold');
  doc.text(record.organization.name, { align: 'center', width: pageWidth });

  // Site name
  doc.fontSize(12).font('Helvetica');
  doc.text(record.site.name, { align: 'center', width: pageWidth });
  if (record.site.location) {
    doc.fontSize(10).text(record.site.location, { align: 'center', width: pageWidth });
  }

  doc.moveDown(0.5);

  // Document title
  doc.fontSize(14).font('Helvetica-Bold');
  doc.text('MANUAL COUNT WORKSHEET', { align: 'center', width: pageWidth });

  doc.fontSize(12);
  doc.text(COUNTER_TYPE_LABELS[record.type], { align: 'center', width: pageWidth });

  // Status badge
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica');
  const statusText = record.status === 'verified' ? 'VERIFIED' : record.status.toUpperCase().replace('_', ' ');
  doc.text(`Status: ${statusText}`, { align: 'center', width: pageWidth });

  // Horizontal line
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
}

function renderRecordInfo(doc: PDFKit.PDFDocument, record: RecordForPdf): void {
  doc.fontSize(11).font('Helvetica-Bold');
  doc.text('SPECIMEN INFORMATION');

  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica');

  const leftCol = 50;
  const rightCol = 300;
  let y = doc.y;

  // Left column
  doc.text(`Specimen ID: ${record.specimenId}`, leftCol, y);
  y += 15;
  doc.text(`Fluid Type: ${FLUID_TYPE_LABELS[record.fluidType] || record.fluidType}`, leftCol, y);
  y += 15;
  doc.text(`QC Sample: ${record.isQC ? 'Yes' : 'No'}`, leftCol, y);

  // Right column
  y = doc.y - 45;
  doc.text(`Record ID: ${record.id.substring(0, 8)}...`, rightCol, y);
  y += 15;
  doc.text(`Version: ${record.version}`, rightCol, y);
  y += 15;
  doc.text(`Method Version: ${record.methodVersion}`, rightCol, y);

  doc.y = y + 20;
}

function renderCountData(doc: PDFKit.PDFDocument, record: RecordForPdf): void {
  doc.fontSize(11).font('Helvetica-Bold');
  doc.text('COUNT DATA AND RESULTS');
  doc.moveDown(0.3);

  switch (record.type) {
    case 'hemocytometer':
      renderHemocytometerData(doc, record.rawTallies as HemocytometerData, record.calculations as HemocytometerCalculations);
      break;
    case 'fetal':
      renderFetalData(doc, record.rawTallies as FetalData, record.calculations as FetalCalculations);
      break;
    case 'retic':
      renderReticData(doc, record.rawTallies as ReticData, record.calculations as ReticCalculations);
      break;
    case 'parasite':
      renderParasiteData(doc, record.rawTallies as ParasiteData, record.calculations as ParasiteCalculations);
      break;
  }
}

function renderHemocytometerData(
  doc: PDFKit.PDFDocument,
  data: HemocytometerData,
  calc: HemocytometerCalculations
): void {
  doc.fontSize(10).font('Helvetica');

  // Parameters
  doc.font('Helvetica-Bold').text('Parameters:', { continued: false });
  doc.font('Helvetica');
  doc.text(`  Dilution Factor: ${data.side1.dilutionFactor}`);
  doc.text(`  Squares Counted: ${data.side1.squaresCounted}`);

  if (data.side1.separateSettings) {
    doc.text(`  Separate RBC Settings: Yes`);
    doc.text(`    RBC Dilution: ${data.side1.rbcDilution}, Squares: ${data.side1.rbcSquaresCounted}`);
    doc.text(`    TNC Dilution: ${data.side1.tncDilution}, Squares: ${data.side1.tncSquaresCounted}`);
  }

  doc.moveDown(0.5);

  // Raw counts table
  doc.font('Helvetica-Bold').text('Raw Counts:');
  doc.font('Helvetica');

  const tableTop = doc.y + 5;
  const col1 = 70;
  const col2 = 180;
  const col3 = 290;
  const col4 = 400;

  // Header
  doc.text('', col1, tableTop);
  doc.text('RBC Count', col2, tableTop);
  doc.text('TNC Count', col3, tableTop);
  doc.text('Status', col4, tableTop);

  // Side 1
  const row1 = tableTop + 18;
  doc.text('Side 1:', col1, row1);
  doc.text(data.side1.rbcCount.toString(), col2, row1);
  doc.text(data.side1.tncCount.toString(), col3, row1);
  doc.text(data.side1.isDone ? 'Complete' : 'Incomplete', col4, row1);

  // Side 2
  const row2 = row1 + 15;
  doc.text('Side 2:', col1, row2);
  doc.text(data.side2.rbcCount.toString(), col2, row2);
  doc.text(data.side2.tncCount.toString(), col3, row2);
  doc.text(data.side2.isDone ? 'Complete' : 'Incomplete', col4, row2);

  doc.y = row2 + 25;
  doc.moveDown(0.3);

  // Calculations
  doc.font('Helvetica-Bold').text('Calculated Results:');
  doc.font('Helvetica');
  doc.text(`  Side 1 RBC: ${calc.side1Rbc} cells/µL`);
  doc.text(`  Side 1 TNC: ${calc.side1Tnc} cells/µL`);
  doc.text(`  Side 2 RBC: ${calc.side2Rbc} cells/µL`);
  doc.text(`  Side 2 TNC: ${calc.side2Tnc} cells/µL`);

  doc.moveDown(0.3);
  doc.font('Helvetica-Bold');
  doc.text(`  FINAL RBC: ${calc.finalRbc} cells/µL`, { continued: true });
  doc.font('Helvetica').text(`  (Within tolerance: ${calc.rbcWithinTolerance ? 'Yes' : 'NO'})`);
  doc.font('Helvetica-Bold');
  doc.text(`  FINAL TNC: ${calc.finalTnc} cells/µL`, { continued: true });
  doc.font('Helvetica').text(`  (Within tolerance: ${calc.tncWithinTolerance ? 'Yes' : 'NO'})`);
}

function renderFetalData(
  doc: PDFKit.PDFDocument,
  data: FetalData,
  calc: FetalCalculations
): void {
  doc.fontSize(10).font('Helvetica');

  // Raw counts
  doc.font('Helvetica-Bold').text('RBC Counts in 5 Fields:');
  doc.font('Helvetica');
  data.fields.forEach((count, i) => {
    doc.text(`  Field ${i + 1}: ${count}`);
  });
  doc.text(`  Total: ${calc.totalRbcIn5Fields}`);

  doc.moveDown(0.3);
  doc.text(`Fetal Cells in 30 Fields: ${data.fetalCellCount}`);

  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').text('Calculated Results:');
  doc.font('Helvetica');
  doc.text(`  Average RBC per Field: ${calc.averageRbcPerField.toFixed(1)}`);
  doc.text(`  Estimated RBC in 30 Fields: ${calc.rbcIn30Fields.toFixed(0)}`);

  doc.moveDown(0.3);
  doc.font('Helvetica-Bold');
  doc.text(`  FETAL CELL PERCENTAGE: ${calc.percentFetal.toFixed(2)}%`);
}

function renderReticData(
  doc: PDFKit.PDFDocument,
  data: ReticData,
  calc: ReticCalculations
): void {
  doc.fontSize(10).font('Helvetica');

  doc.font('Helvetica-Bold').text('Raw Counts:');
  doc.font('Helvetica');
  doc.text(`  Reticulocyte Count: ${data.reticCount}`);
  doc.text(`  Total RBC Count: ${data.rbcCount}`);

  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').text('Calculated Result:');
  doc.font('Helvetica-Bold');
  doc.text(`  RETICULOCYTE PERCENTAGE: ${calc.percentRetic.toFixed(2)}%`);
}

function renderParasiteData(
  doc: PDFKit.PDFDocument,
  data: ParasiteData,
  calc: ParasiteCalculations
): void {
  doc.fontSize(10).font('Helvetica');

  doc.font('Helvetica-Bold').text('Raw Counts:');
  doc.font('Helvetica');
  doc.text(`  Parasite Count: ${data.parasiteCount}`);
  doc.text(`  Total RBC Count: ${data.rbcCount}`);

  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').text('Calculated Result:');
  doc.font('Helvetica-Bold');
  doc.text(`  PARASITEMIA PERCENTAGE: ${calc.percentParasitemia.toFixed(2)}%`);
}

function renderAttestations(doc: PDFKit.PDFDocument, record: RecordForPdf): void {
  doc.fontSize(11).font('Helvetica-Bold');
  doc.text('ATTESTATIONS');
  doc.moveDown(0.3);

  doc.fontSize(10).font('Helvetica');

  // Performer attestation
  doc.font('Helvetica-Bold').text('Performed By:');
  doc.font('Helvetica');
  doc.text(`  Name: ${record.performedBy.name}`);
  doc.text(`  Email: ${record.performedBy.email}`);
  doc.text(`  Date/Time: ${formatDateTime(record.performedAt)}`);
  if (record.performerAttestation) {
    doc.text(`  Attestation: "${record.performerAttestation}"`);
    if (record.performerAttestedAt) {
      doc.text(`  Attested At: ${formatDateTime(record.performerAttestedAt)}`);
    }
  }

  doc.moveDown(0.5);

  // Verifier attestation
  doc.font('Helvetica-Bold').text('Verified By:');
  doc.font('Helvetica');
  if (record.verifiedBy && record.verifiedAt) {
    doc.text(`  Name: ${record.verifiedBy.name}`);
    doc.text(`  Email: ${record.verifiedBy.email}`);
    doc.text(`  Date/Time: ${formatDateTime(record.verifiedAt)}`);
    if (record.verifierAttestation) {
      doc.text(`  Attestation: "${record.verifierAttestation}"`);
    }
  } else {
    doc.text('  Not yet verified');
  }

  // Correction reason if applicable
  if (record.correctionReason) {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('Correction Information:');
    doc.font('Helvetica');
    doc.text(`  Reason: ${record.correctionReason}`);
  }
}

function renderAuditInfo(doc: PDFKit.PDFDocument, record: RecordForPdf): void {
  // Horizontal line
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
  doc.moveDown(0.3);

  doc.fontSize(9).font('Helvetica');
  doc.text(`Record Created: ${formatDateTime(record.createdAt)}`);
  doc.text(`PDF Generated: ${formatDateTime(new Date())}`);
  doc.text(`Record ID: ${record.id}`);
}

function renderFooter(doc: PDFKit.PDFDocument, record: RecordForPdf): void {
  const bottom = doc.page.height - 50;

  doc.fontSize(8).font('Helvetica');
  doc.text(
    'This document is an official record generated by the Lab Counters application. ' +
    'Any alterations to this PDF after generation are unauthorized.',
    50,
    bottom - 25,
    { width: doc.page.width - 100, align: 'center' }
  );

  doc.text(
    `${record.organization.name} | ${record.site.name} | Generated ${formatDateTime(new Date())}`,
    50,
    bottom - 10,
    { width: doc.page.width - 100, align: 'center' }
  );
}

function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Generate a storage key for a record PDF
 */
export function getPdfStorageKey(record: { id: string; orgId: string; siteId: string; version: number }): string {
  return `pdfs/${record.orgId}/${record.siteId}/${record.id}_v${record.version}.pdf`;
}
