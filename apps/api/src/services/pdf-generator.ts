import { renderRecordHtml, renderPdfFooter, renderPdfHeader } from './pdf-template';
import { renderPdfFromHtml } from './pdf-renderer';
import type { RecordForPdf } from './pdf-types';

export type { RecordForPdf } from './pdf-types';

/**
 * Generate PDF for a verified record
 * Returns a Buffer containing the PDF data
 */
export async function generateRecordPdf(record: RecordForPdf): Promise<Buffer> {
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[pdf] generateRecordPdf v3 record=${record.id}`);
  }

  const html = renderRecordHtml(record);
  const headerTemplate = renderPdfHeader(record);
  const footerTemplate = renderPdfFooter(record);

  return renderPdfFromHtml(html, { headerTemplate, footerTemplate });
}

/**
 * Generate a storage key for a record PDF
 */
export function getPdfStorageKey(record: { id: string; orgId: string; siteId: string; version: number }): string {
  return `pdfs/${record.orgId}/${record.siteId}/${record.id}_v${record.version}.pdf`;
}
