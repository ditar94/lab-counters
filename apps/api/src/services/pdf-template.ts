import type {
  CountRecordType,
  HemocytometerData,
  HemocytometerCalculations,
  ReticData,
  ReticCalculations,
  ParasiteData,
  ParasiteCalculations,
  FetalData,
  FetalCalculations,
  MethodParams,
  HemocytometerMethodParams,
  ReticMethodParams,
  FetalMethodParams,
} from '@lab-counters/shared';
import type { RecordForPdf } from './pdf-types';

const BASE_CSS = `
:root {
  --color-primary: #0e7490;
  --color-primary-dark: #0b5b70;
  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-error: #dc2626;
  --color-gray-50: #f8fafc;
  --color-gray-100: #f1f5f9;
  --color-gray-200: #e2e8f0;
  --color-gray-300: #cbd5e1;
  --color-gray-400: #94a3b8;
  --color-gray-500: #64748b;
  --color-gray-600: #475569;
  --color-gray-700: #334155;
  --color-gray-800: #1e293b;
  --color-gray-900: #0f172a;
  --font-sans: 'Space Grotesk', 'IBM Plex Sans', 'Segoe UI', Arial, sans-serif;
  --font-mono: 'IBM Plex Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  --shadow-sm: 0 1px 2px 0 rgb(15 23 42 / 0.06);
  --shadow: 0 6px 12px -6px rgb(15 23 42 / 0.16), 0 2px 4px -2px rgb(15 23 42 / 0.08);
  --radius: 0.6rem;
  --radius-md: 0.9rem;
  --radius-lg: 1.2rem;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  font-family: var(--font-sans);
  color: var(--color-gray-900);
  background: #ffffff;
  line-height: 1.6;
}

h1, h2, h3, h4 {
  margin: 0 0 0.5rem;
  font-weight: 600;
  line-height: 1.2;
}

h1 { font-size: 1.8rem; letter-spacing: -0.02em; }
h2 { font-size: 1.2rem; letter-spacing: -0.01em; }
h3 { font-size: 1rem; }

p { margin: 0 0 0.75rem; }

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.page-header h1 { margin: 0; }

.subtitle {
  color: var(--color-gray-600);
  margin: 0;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 9999px;
  text-transform: capitalize;
}

.status-draft { background-color: var(--color-gray-100); color: var(--color-gray-700); }
.status-pending, .status-pending_verification, .status-pending-verification { background-color: #fef3c7; color: #92400e; }
.status-verified { background-color: #d1fae5; color: #065f46; }
.status-corrected { background-color: #fee2e2; color: #991b1b; }

.record-detail {
  max-width: 860px;
  margin: 0 auto;
  padding: 12px 6px 24px;
}

.record-info,
.hemocytometer-details,
.counter-details,
.correction-reason-section,
.attestations-section,
.method-params-section,
.audit-log-section {
  border: 1px solid var(--color-gray-200);
  break-inside: avoid;
  page-break-inside: avoid;
}

.record-info,
.hemocytometer-details,
.counter-details,
.correction-reason-section,
.attestations-section,
.method-params-section,
.audit-log-section {
  background: white;
  padding: 1.25rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  margin-bottom: 1.25rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.info-item label {
  font-size: 0.7rem;
  color: var(--color-gray-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-item span {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-gray-900);
}

.hemocytometer-details h2,
.counter-details h2 {
  margin-top: 1.25rem;
}

.hemocytometer-details h2:first-child,
.counter-details h2:first-child {
  margin-top: 0;
}

.settings-display {
  margin-bottom: 1.25rem;
  padding: 0.9rem;
  background: var(--color-gray-50);
  border-radius: var(--radius);
}

.shared-settings dl {
  display: flex;
  gap: 2rem;
  margin: 0;
}

.shared-settings dt,
.setting-group dt,
.side-detail dt {
  font-size: 0.85rem;
  color: var(--color-gray-500);
}

.shared-settings dd,
.setting-group dd,
.side-detail dd {
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0 1.5rem 0 0.5rem;
}

.separate-settings {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

.setting-group {
  padding: 0.75rem;
  background: white;
  border-radius: var(--radius);
  border: 1px solid var(--color-gray-200);
}

.setting-group h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.85rem;
  color: var(--color-gray-700);
}

.setting-group dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.25rem 0.75rem;
  margin: 0;
}

.sides-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

.side-detail {
  padding: 0.9rem;
  background: var(--color-gray-50);
  border-radius: var(--radius);
}

.side-detail h3 {
  margin-bottom: 0.6rem;
}

.side-detail dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.25rem 1rem;
  margin: 0;
}

.calculations-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.calc-item {
  text-align: center;
  padding: 0.75rem;
  background: var(--color-gray-50);
  border-radius: var(--radius);
}

.calc-item label {
  font-size: 0.75rem;
  color: var(--color-gray-500);
}

.calc-item span {
  display: block;
  font-size: 1.1rem;
  font-weight: 600;
}

.final-results-display {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.final-results-display .result {
  padding: 1.1rem;
  text-align: center;
  border-radius: var(--radius);
  border: 2px solid;
}

.final-results-display .result.valid {
  border-color: var(--color-success);
  background-color: rgba(22, 163, 74, 0.05);
}

.final-results-display .result.invalid {
  border-color: var(--color-error);
  background-color: rgba(220, 38, 38, 0.05);
}

.final-results-display .label {
  display: block;
  font-size: 0.85rem;
  color: var(--color-gray-500);
}

.final-results-display .value {
  display: block;
  font-size: 1.6rem;
  font-weight: 700;
}

.final-results-display .warning {
  display: block;
  font-size: 0.75rem;
  color: var(--color-error);
  margin-top: 0.25rem;
}

.simple-data-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.simple-data-grid .data-item,
.fields-data-grid .data-item {
  background: var(--color-gray-50);
  padding: 0.9rem;
  border-radius: var(--radius);
  text-align: center;
}

.simple-data-grid .data-item label,
.fields-data-grid .data-item label {
  display: block;
  font-size: 0.7rem;
  color: var(--color-gray-500);
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}

.simple-data-grid .data-item .value,
.fields-data-grid .data-item .value {
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--color-gray-900);
}

.fields-data-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.formula-display {
  background: var(--color-gray-50);
  border: 1px solid var(--color-gray-200);
  border-radius: var(--radius);
  padding: 0.85rem;
  margin-top: 0.75rem;
}

.formula-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.formula-row p { margin: 0; }

.formula-display .fraction {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
}

.formula-display .fraction .numerator {
  border-bottom: 1px solid var(--color-gray-400);
  padding: 0 0.5rem 0.2rem;
}

.formula-display .fraction .denominator {
  padding: 0.2rem 0.5rem 0;
}

.correction-reason-section h2 {
  margin-top: 0;
}

.attestations-section h2,
.method-params-section h2,
.audit-log-section h2 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
}

.attestation-display {
  background: #d1fae5;
  border: 1px solid #065f46;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-lg);
  margin-bottom: 1rem;
}

.attestation-display:last-child { margin-bottom: 0; }

.attestation-display h3 {
  font-size: 0.85rem;
  font-weight: 600;
  color: #065f46;
  margin: 0 0 0.5rem 0;
}

.attestation-display .attestation-text {
  font-size: 0.85rem;
  color: #047857;
  margin: 0 0 0.5rem 0;
  font-style: italic;
}

.attestation-display .attestation-timestamp {
  font-size: 0.75rem;
  color: #065f46;
  margin: 0;
  opacity: 0.8;
}

.params-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.method-version {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-gray-500);
  padding: 0.25rem 0.5rem;
  background: var(--color-gray-100);
  border-radius: var(--radius);
}

.source-badge {
  display: inline-block;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.source-badge.source-org {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.source-badge.source-system_default {
  background: var(--color-gray-100);
  color: var(--color-gray-600);
}

.params-display {
  background: var(--color-gray-50);
  padding: 1rem;
  border-radius: var(--radius);
  border: 1px solid var(--color-gray-200);
}

.params-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.375rem 1rem;
  margin: 0;
}

.params-grid dt {
  font-size: 0.85rem;
  color: var(--color-gray-500);
}

.params-grid dd {
  font-size: 0.85rem;
  font-weight: 500;
  margin: 0;
  text-align: right;
}

.no-params-text {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-gray-500);
  font-style: italic;
}

.audit-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.audit-item {
  padding: 0.9rem;
  background: var(--color-gray-50);
  border-radius: var(--radius);
  border-left: 3px solid var(--color-gray-300);
}

.audit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.audit-action {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-gray-900);
}

.audit-time {
  font-size: 0.75rem;
  color: var(--color-gray-500);
}

.audit-actor {
  font-size: 0.8rem;
  color: var(--color-gray-600);
  margin-bottom: 0.25rem;
}

.audit-reason {
  font-size: 0.8rem;
  color: var(--color-gray-700);
  font-style: italic;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-gray-200);
}

.audit-changes {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--color-gray-700);
}

.changes-label { font-weight: 600; }

.changes-list {
  margin: 0.35rem 0 0 1rem;
  padding: 0;
}

.change-item { margin-bottom: 0.25rem; }

.no-audit-events {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-gray-500);
  font-style: italic;
}

@media (max-width: 768px) {
  .sides-grid,
  .final-results-display,
  .calculations-grid { grid-template-columns: 1fr; }
  .fields-data-grid { grid-template-columns: repeat(3, 1fr); }
}
`;

export function renderRecordHtml(record: RecordForPdf): string {
  const statusClass = `status-${record.status.replace('_', '-')}`;
  const statusText = record.status.replace('_', ' ');
  const subtitle = `${record.type} - ${record.fluidType}`;

  const sections: string[] = [];
  sections.push(renderRecordInfo(record, statusClass, statusText));

  if (record.correctionReason) {
    sections.push(`
      <div class="correction-reason-section">
        <h2>Amendment Reason</h2>
        <p class="correction-reason-text">${escapeHtml(record.correctionReason)}</p>
      </div>
    `);
  }

  sections.push(renderCountData(record));

  if (record.performerAttestation || record.verifierAttestation) {
    sections.push(renderAttestations(record));
  }

  if (record.paramsSnapshot) {
    sections.push(renderMethodParams(record));
  }

  sections.push(renderAuditLog(record));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Record ${escapeHtml(record.specimenId)}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  <div class="record-detail">
    <header class="page-header">
      <div>
        <h1>Record: ${escapeHtml(record.specimenId)}</h1>
        <p class="subtitle">${escapeHtml(subtitle)}</p>
      </div>
    </header>
    ${sections.join('\n')}
  </div>
</body>
</html>`;
}

export function renderPdfHeader(record: RecordForPdf): string {
  return `
  <style>
    .pdf-header {
      font-family: Arial, sans-serif;
      font-size: 10px;
      width: 100%;
      padding: 0 40px;
      color: #334155;
    }
    .pdf-header .title { font-weight: 600; }
    .pdf-header .meta { color: #64748b; font-size: 9px; margin-top: 2px; }
  </style>
  <div class="pdf-header">
    <div class="title">${escapeHtml(record.organization.name)} — Record ${escapeHtml(record.specimenId)}</div>
    <div class="meta">${escapeHtml(record.site.name)} • ${escapeHtml(record.type)} • ${escapeHtml(record.status.replace('_', ' '))}</div>
  </div>
  `;
}

export function renderPdfFooter(record: RecordForPdf): string {
  return `
  <style>
    .pdf-footer {
      font-family: Arial, sans-serif;
      font-size: 9px;
      width: 100%;
      padding: 0 40px;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .pdf-footer .page { color: #94a3b8; }
  </style>
  <div class="pdf-footer">
    <div>Generated ${escapeHtml(formatDate(new Date()))}</div>
    <div class="page">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
  </div>
  `;
}

function renderRecordInfo(record: RecordForPdf, statusClass: string, statusText: string): string {
  return `
    <div class="record-info">
      <div class="info-grid">
        <div class="info-item">
          <label>Status</label>
          <span class="status-badge ${escapeHtml(statusClass)}">${escapeHtml(statusText)}</span>
        </div>
        <div class="info-item">
          <label>Performed</label>
          <span>${escapeHtml(formatDate(record.performedAt))}</span>
        </div>
        <div class="info-item">
          <label>Performed By</label>
          <span>${escapeHtml(record.performedBy.name)}</span>
        </div>
        ${record.verifiedBy && record.verifiedAt ? `
          <div class="info-item">
            <label>Verified</label>
            <span>${escapeHtml(formatDate(record.verifiedAt))}</span>
          </div>
          <div class="info-item">
            <label>Verified By</label>
            <span>${escapeHtml(record.verifiedBy.name)}</span>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function renderCountData(record: RecordForPdf): string {
  switch (record.type) {
    case 'hemocytometer':
      return renderHemocytometer(record);
    case 'retic':
      return renderRetic(record);
    case 'parasite':
      return renderParasite(record);
    case 'fetal':
      return renderFetal(record);
    default:
      return '';
  }
}

function renderHemocytometer(record: RecordForPdf): string {
  const data = record.rawTallies as HemocytometerData;
  const calculations = record.calculations as HemocytometerCalculations;
  const hasSeparateSettings = data.side1.separateSettings;
  const rbcSquares = hasSeparateSettings
    ? (data.side1.rbcSquaresCounted ?? data.side1.squaresCounted)
    : data.side1.squaresCounted;
  const rbcDilution = hasSeparateSettings
    ? (data.side1.rbcDilution ?? data.side1.dilutionFactor)
    : data.side1.dilutionFactor;
  const tncSquares = hasSeparateSettings
    ? (data.side1.tncSquaresCounted ?? data.side1.squaresCounted)
    : data.side1.squaresCounted;
  const tncDilution = hasSeparateSettings
    ? (data.side1.tncDilution ?? data.side1.dilutionFactor)
    : data.side1.dilutionFactor;
  const rbcAvg = (data.side1.rbcCount + data.side2.rbcCount) / 2;
  const tncAvg = (data.side1.tncCount + data.side2.tncCount) / 2;

  return `
    <div class="hemocytometer-details">
      <h2>Count Settings</h2>
      <div class="settings-display">
        ${hasSeparateSettings ? `
          <div class="separate-settings">
            <div class="setting-group">
              <h4>RBC Settings</h4>
              <dl>
                <dt>Squares Counted</dt>
                <dd>${escapeHtml(rbcSquares)}</dd>
                <dt>Dilution Factor</dt>
                <dd>${escapeHtml(rbcDilution)}</dd>
              </dl>
            </div>
            <div class="setting-group">
              <h4>TNC Settings</h4>
              <dl>
                <dt>Squares Counted</dt>
                <dd>${escapeHtml(tncSquares)}</dd>
                <dt>Dilution Factor</dt>
                <dd>${escapeHtml(tncDilution)}</dd>
              </dl>
            </div>
          </div>
        ` : `
          <div class="shared-settings">
            <dl>
              <dt>Squares Counted</dt>
              <dd>${escapeHtml(data.side1.squaresCounted)}</dd>
              <dt>Dilution Factor</dt>
              <dd>${escapeHtml(data.side1.dilutionFactor)}</dd>
            </dl>
          </div>
        `}
      </div>

      <h2>Count Data</h2>
      <div class="sides-grid">
        <div class="side-detail">
          <h3>Side 1</h3>
          <dl>
            <dt>RBC Count</dt>
            <dd>${escapeHtml(data.side1.rbcCount)}</dd>
            <dt>TNC Count</dt>
            <dd>${escapeHtml(data.side1.tncCount)}</dd>
          </dl>
        </div>
        <div class="side-detail">
          <h3>Side 2</h3>
          <dl>
            <dt>RBC Count</dt>
            <dd>${escapeHtml(data.side2.rbcCount)}</dd>
            <dt>TNC Count</dt>
            <dd>${escapeHtml(data.side2.tncCount)}</dd>
          </dl>
        </div>
      </div>

      <div class="final-results-display">
        <div class="result ${calculations.rbcWithinTolerance ? 'valid' : 'invalid'}">
          <span class="label">Final RBC</span>
          <span class="value">${escapeHtml(calculations.finalRbc)}</span>
          ${calculations.rbcWithinTolerance ? '' : '<span class="warning">Counts out of tolerance</span>'}
        </div>
        <div class="result ${calculations.tncWithinTolerance ? 'valid' : 'invalid'}">
          <span class="label">Final TNC</span>
          <span class="value">${escapeHtml(calculations.finalTnc)}</span>
          ${calculations.tncWithinTolerance ? '' : '<span class="warning">Counts out of tolerance</span>'}
        </div>
      </div>

      <div class="formula-display">
        <div class="formula-row">
          <p>RBC Count = </p>
          <div class="fraction">
            <span class="numerator">(RBC Average) x (dilution) x 10</span>
            <span class="denominator">(# of Squares Counted)</span>
          </div>
          <p> = </p>
          <div class="fraction">
            <span class="numerator">(${escapeHtml(rbcAvg)}) x (${escapeHtml(rbcDilution)}) x 10</span>
            <span class="denominator">(${escapeHtml(rbcSquares)})</span>
          </div>
          <p> ≈ ${escapeHtml(calculations.finalRbc)}</p>
        </div>
        <div class="formula-row">
          <p>TNC Count = </p>
          <div class="fraction">
            <span class="numerator">(TNC Average) x (dilution) x 10</span>
            <span class="denominator">(# of Squares Counted)</span>
          </div>
          <p> = </p>
          <div class="fraction">
            <span class="numerator">(${escapeHtml(tncAvg)}) x (${escapeHtml(tncDilution)}) x 10</span>
            <span class="denominator">(${escapeHtml(tncSquares)})</span>
          </div>
          <p> ≈ ${escapeHtml(calculations.finalTnc)}</p>
        </div>
      </div>
    </div>
  `;
}

function renderRetic(record: RecordForPdf): string {
  const data = record.rawTallies as ReticData;
  const calculations = record.calculations as ReticCalculations;

  return `
    <div class="counter-details retic-details">
      <h2>Count Data</h2>
      <div class="simple-data-grid">
        <div class="data-item">
          <label>Reticulocytes</label>
          <span class="value">${escapeHtml(data.reticCount)}</span>
        </div>
        <div class="data-item">
          <label>Total RBCs</label>
          <span class="value">${escapeHtml(data.rbcCount)}</span>
        </div>
      </div>

      <h2>Result</h2>
      <div class="final-results-display">
        <div class="result valid">
          <span class="label">Reticulocyte %</span>
          <span class="value">${escapeHtml(calculations.percentRetic)}%</span>
        </div>
      </div>

      <div class="formula-display">
        <div class="formula-row">
          <p>Retic % = </p>
          <div class="fraction">
            <span class="numerator">Retic Count</span>
            <span class="denominator">Total RBC Count</span>
          </div>
          <p> × 100 = </p>
          <div class="fraction">
            <span class="numerator">${escapeHtml(data.reticCount)}</span>
            <span class="denominator">${escapeHtml(data.rbcCount)}</span>
          </div>
          <p> × 100 = ${escapeHtml(calculations.percentRetic)}%</p>
        </div>
      </div>
    </div>
  `;
}

function renderParasite(record: RecordForPdf): string {
  const data = record.rawTallies as ParasiteData;
  const calculations = record.calculations as ParasiteCalculations;

  return `
    <div class="counter-details parasite-details">
      <h2>Count Data</h2>
      <div class="simple-data-grid">
        <div class="data-item">
          <label>Parasitized RBCs</label>
          <span class="value">${escapeHtml(data.parasiteCount)}</span>
        </div>
        <div class="data-item">
          <label>Total RBCs</label>
          <span class="value">${escapeHtml(data.rbcCount)}</span>
        </div>
      </div>

      <h2>Result</h2>
      <div class="final-results-display">
        <div class="result valid">
          <span class="label">Parasitemia %</span>
          <span class="value">${escapeHtml(calculations.percentParasitemia)}%</span>
        </div>
      </div>

      <div class="formula-display">
        <div class="formula-row">
          <p>Parasitemia % = </p>
          <div class="fraction">
            <span class="numerator">Parasite Count</span>
            <span class="denominator">Total RBC Count</span>
          </div>
          <p> × 100 = </p>
          <div class="fraction">
            <span class="numerator">${escapeHtml(data.parasiteCount)}</span>
            <span class="denominator">${escapeHtml(data.rbcCount)}</span>
          </div>
          <p> × 100 = ${escapeHtml(calculations.percentParasitemia)}%</p>
        </div>
      </div>
    </div>
  `;
}

function renderFetal(record: RecordForPdf): string {
  const data = record.rawTallies as FetalData;
  const calculations = record.calculations as FetalCalculations;
  const params = record.paramsSnapshot?.params as FetalMethodParams | undefined;
  const rbcFieldsCount = params?.rbcFieldsCount ?? data.fields.length;
  const fetalFieldsCount = params?.fetalFieldsCount ?? 30;

  const fields = data.fields.map((count, index) => `
    <div class="data-item">
      <label>Field ${index + 1}</label>
      <span class="value">${escapeHtml(count)}</span>
    </div>
  `).join('');

  return `
    <div class="counter-details fetal-details">
      <h2>RBC Counts (${escapeHtml(rbcFieldsCount)} Fields)</h2>
      <div class="fields-data-grid">
        ${fields}
      </div>

      <div class="calculations-grid">
        <div class="calc-item">
          <label>Total in ${escapeHtml(rbcFieldsCount)} Fields</label>
          <span>${escapeHtml(calculations.totalRbcIn5Fields)}</span>
        </div>
        <div class="calc-item">
          <label>Average per Field</label>
          <span>${escapeHtml(calculations.averageRbcPerField)}</span>
        </div>
        <div class="calc-item">
          <label>Est. RBCs in ${escapeHtml(fetalFieldsCount)} Fields</label>
          <span>${escapeHtml(calculations.rbcIn30Fields)}</span>
        </div>
      </div>

      <h2>Fetal Cell Count</h2>
      <div class="simple-data-grid">
        <div class="data-item">
          <label>Fetal Cells (in ${escapeHtml(fetalFieldsCount)} fields)</label>
          <span class="value">${escapeHtml(data.fetalCellCount)}</span>
        </div>
        <div class="data-item">
          <label>Fields Counted</label>
          <span class="value">${escapeHtml(data.fetalFieldsCounted ?? 0)}</span>
        </div>
      </div>

      <h2>Result</h2>
      <div class="final-results-display">
        <div class="result valid">
          <span class="label">Fetal Cells %</span>
          <span class="value">${escapeHtml(calculations.percentFetal)}%</span>
        </div>
      </div>

      <div class="formula-display">
        <div class="formula-row">
          <p>Fetal % = </p>
          <div class="fraction">
            <span class="numerator">Fetal Cells</span>
            <span class="denominator">RBCs in ${escapeHtml(fetalFieldsCount)} Fields</span>
          </div>
          <p> × 100 = </p>
          <div class="fraction">
            <span class="numerator">${escapeHtml(data.fetalCellCount)}</span>
            <span class="denominator">${escapeHtml(calculations.rbcIn30Fields)}</span>
          </div>
          <p> × 100 = ${escapeHtml(calculations.percentFetal)}%</p>
        </div>
      </div>
    </div>
  `;
}

function renderAttestations(record: RecordForPdf): string {
  return `
    <div class="attestations-section">
      <h2>Attestations</h2>
      ${record.performerAttestation ? `
        <div class="attestation-display">
          <h3>Performer Attestation</h3>
          <p class="attestation-text">${escapeHtml(record.performerAttestation)}</p>
          ${record.performerAttestedAt ? `<p class="attestation-timestamp">Attested on ${escapeHtml(formatDate(record.performerAttestedAt))}</p>` : ''}
        </div>
      ` : ''}
      ${record.verifierAttestation ? `
        <div class="attestation-display">
          <h3>Verifier Attestation</h3>
          <p class="attestation-text">${escapeHtml(record.verifierAttestation)}</p>
          ${record.verifiedAt ? `<p class="attestation-timestamp">Attested on ${escapeHtml(formatDate(record.verifiedAt))}</p>` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

function renderMethodParams(record: RecordForPdf): string {
  if (!record.paramsSnapshot) return '';
  const source = record.paramsSnapshot.source;
  const sourceLabel = source === 'org' ? 'Org Config' : 'System Default';
  const sourceClass = sanitizeClass(source || 'system_default');

  return `
    <div class="method-params-section">
      <h2>Method Parameters</h2>
      <div class="params-header">
        <span class="method-version">v${escapeHtml(record.methodVersion || '1.0.0')}</span>
        <span class="source-badge source-${escapeHtml(sourceClass)}">${escapeHtml(sourceLabel)}</span>
      </div>
      ${renderParamsDisplay(record.type, record.paramsSnapshot.params)}
    </div>
  `;
}

function renderParamsDisplay(type: CountRecordType, params: MethodParams): string {
  if (type === 'hemocytometer') {
    const hc = params as HemocytometerMethodParams;
    return `
      <div class="params-display">
        <dl class="params-grid">
          <dt>Default Dilution</dt>
          <dd>${escapeHtml(hc.defaultDilution)}</dd>
          <dt>Default Squares</dt>
          <dd>${escapeHtml(hc.defaultSquaresCounted)}</dd>
          <dt>Tolerance %</dt>
          <dd>${escapeHtml(hc.tolerancePercent)}%</dd>
          <dt>Low Count Tolerance</dt>
          <dd>${escapeHtml(hc.lowCountTolerance)}</dd>
          <dt>Low Count Threshold</dt>
          <dd>${escapeHtml(hc.lowCountThreshold)}</dd>
        </dl>
      </div>
    `;
  }

  if (type === 'retic' || type === 'parasite') {
    const pc = params as ReticMethodParams;
    return `
      <div class="params-display">
        <dl class="params-grid">
          <dt>Target RBC Count</dt>
          <dd>${escapeHtml(pc.targetRbcCount)}</dd>
        </dl>
      </div>
    `;
  }

  const fc = params as FetalMethodParams;
  return `
    <div class="params-display">
      <dl class="params-grid">
        <dt>RBC Fields Count</dt>
        <dd>${escapeHtml(fc.rbcFieldsCount)}</dd>
        <dt>Fetal Fields Count</dt>
        <dd>${escapeHtml(fc.fetalFieldsCount)}</dd>
      </dl>
    </div>
  `;
}

function renderAuditLog(record: RecordForPdf): string {
  const events = record.auditEvents ?? [];
  if (events.length === 0) {
    return `
      <div class="audit-log-section">
        <h2>Audit Log</h2>
        <p class="no-audit-events">No activity recorded for this record.</p>
      </div>
    `;
  }

  const items = events.map((event) => {
    const actorName = event.actor?.name || 'System';
    const metadata = event.metadata || {};
    const correctionReason = typeof metadata.correctionReason === 'string' ? metadata.correctionReason : null;
    const changes = isObject(metadata.changes) ? metadata.changes : null;

    const changeList = changes
      ? `<div class="audit-changes">
          <span class="changes-label">Changes:</span>
          <ul class="changes-list">
            ${Object.entries(changes)
              .map(([field, change]) => `<li class="change-item">${escapeHtml(formatChangeDescription(field, change))}</li>`)
              .join('')}
          </ul>
        </div>`
      : '';

    return `
      <div class="audit-item">
        <div class="audit-header">
          <span class="audit-action">${escapeHtml(formatAuditAction(event.action))}</span>
          <span class="audit-time">${escapeHtml(formatDate(event.createdAt))}</span>
        </div>
        <div class="audit-actor">By: ${escapeHtml(actorName)}</div>
        ${correctionReason ? `<div class="audit-reason">Reason: ${escapeHtml(correctionReason)}</div>` : ''}
        ${changeList}
      </div>
    `;
  }).join('');

  return `
    <div class="audit-log-section">
      <h2>Audit Log</h2>
      <div class="audit-list">
        ${items}
      </div>
    </div>
  `;
}

function formatAuditAction(action: string): string {
  const actionMap: Record<string, string> = {
    'create': 'Record Created',
    'update': 'Record Updated',
    'submit': 'Submitted for Verification',
    'verify': 'Record Verified',
    'amend': 'Record Amended',
  };
  return actionMap[action] || action.replace(/_/g, ' ');
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US');
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeClass(value: string): string {
  return value.replace(/[^a-z0-9_-]/gi, '_');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatChangeDescription(field: string, change: unknown): string {
  if (!isObject(change)) return `${field} changed`;
  const before = 'before' in change ? (change as Record<string, unknown>).before : undefined;
  const after = 'after' in change ? (change as Record<string, unknown>).after : undefined;
  const beforeStr = formatChangeValue(field, before);
  const afterStr = formatChangeValue(field, after);
  return `${formatFieldName(field)} changed from "${beforeStr}" to "${afterStr}"`;
}

function formatFieldName(field: string): string {
  const fieldMap: Record<string, string> = {
    rawTallies: 'Count Data',
    calculations: 'Calculations',
    specimenId: 'Specimen ID',
    performedAt: 'Performed Date/Time',
  };
  return fieldMap[field] || field;
}

function formatChangeValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return 'N/A';
  if (field === 'performedAt') {
    return formatDate(String(value));
  }
  if (field === 'rawTallies') {
    return 'Count data';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return 'Object';
    }
  }
  return String(value);
}
