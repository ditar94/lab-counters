import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';
import type {
  RecordStatus,
  CountRecordType,
  HemocytometerRecord,
  HemocytometerData,
  HemocytometerCalculations,
  ReticRecord,
  ReticData,
  ReticCalculations,
  ParasiteRecord,
  ParasiteData,
  ParasiteCalculations,
  FetalRecord,
  FetalData,
  FetalCalculations,
  ParamsSnapshot,
  MethodParams,
  HemocytometerMethodParams,
  FetalMethodParams,
  ReticMethodParams,
} from '@lab-counters/shared';
import './Records.css';

interface RecordWithRelations {
  id: string;
  specimenId: string;
  fluidType: string;
  type: CountRecordType;
  status: RecordStatus;
  rawTallies: HemocytometerData | unknown;
  calculations: HemocytometerCalculations | unknown;
  performedAt: Date | string;
  performerAttestation?: string;
  performerAttestedAt?: Date | string;
  verifiedAt?: Date | string;
  verifierAttestation?: string;
  performedById: string;
  performedBy: { id: string; name: string; email: string };
  verifiedBy?: { id: string; name: string; email: string };
  site?: { id: string; name: string };
  methodVersion?: string;
  paramsSnapshot?: ParamsSnapshot;
  version?: number;
  parentRecordId?: string;
  correctionReason?: string;
}

interface AuditChange {
  before: unknown;
  after: unknown;
}

interface AuditEvent {
  id: string;
  action: string;
  createdAt: string;
  actor: { id: string; name: string } | null;
  metadata: {
    correctionReason?: string;
    changes?: Record<string, AuditChange>;
    changedFields?: string[];
  };
}

interface AuditLogResponse {
  events: AuditEvent[];
}

export function RecordDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getToken, user } = useAuth();
  const [record, setRecord] = useState<RecordWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attestationChecked, setAttestationChecked] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);

  useEffect(() => {
    async function fetchRecord() {
      if (!id) return;

      try {
        const token = await getToken();
        if (!token) return;

        const data = await api.get<RecordWithRelations>(`/api/records/${id}`, token);
        setRecord(data);

        // Fetch audit log for amendment history
        try {
          const auditData = await api.get<AuditLogResponse>(`/api/records/${id}/audit`, token);
          setAuditLog(auditData.events);
        } catch {
          // Ignore errors fetching audit log
        }
      } catch (err) {
        console.error('Failed to fetch record:', err);
        setError('Failed to load record');
      } finally {
        setLoading(false);
      }
    }

    fetchRecord();
  }, [id, getToken]);

  const handleVerify = async () => {
    if (!id || !record) return;

    setVerifying(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      // Construct the verifier attestation statement
      const verifierAttestation = `I, ${user?.name}, attest that I have reviewed the count performed by ${record.performedBy.name} and confirmed the results are correctly entered in the LIS.`;

      await api.post(`/api/records/${id}/verify`, { verifierAttestation }, token);
      navigate('/records');
    } catch (err) {
      console.error('Verify error:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify');
    } finally {
      setVerifying(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!id || !record) return;

    setDownloadingPdf(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      await api.download(
        `/api/pdf/records/${id}`,
        token,
        `${record.specimenId}_${record.type}_v${record.version || 1}.pdf`
      );
    } catch (err) {
      console.error('PDF download error:', err);
      setError(err instanceof Error ? err.message : 'Failed to download PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString();
  };

  const formatAuditAction = (action: string): string => {
    const actionMap: Record<string, string> = {
      'create': 'Record Created',
      'update': 'Record Updated',
      'submit': 'Submitted for Verification',
      'verify': 'Record Verified',
      'amend': 'Record Amended',
    };
    return actionMap[action] || action.replace(/_/g, ' ');
  };

  const formatFieldName = (field: string): string => {
    const fieldMap: Record<string, string> = {
      'rawTallies': 'Count Data',
      'calculations': 'Calculations',
      'specimenId': 'Specimen ID',
      'performedAt': 'Performed Date/Time',
    };
    return fieldMap[field] || field;
  };

  const formatChangeValue = (field: string, value: unknown): string => {
    if (value === null || value === undefined) return 'N/A';
    if (field === 'performedAt') {
      return formatDate(value as string | Date);
    }
    if (field === 'rawTallies') {
      return 'Count data';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const formatChangeDescription = (field: string, change: AuditChange): string => {
    if (field === 'rawTallies') {
      return 'Count data was modified';
    }
    const beforeStr = formatChangeValue(field, change.before);
    const afterStr = formatChangeValue(field, change.after);
    return `${formatFieldName(field)} changed from "${beforeStr}" to "${afterStr}"`;
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!record) {
    return <div className="error">Record not found</div>;
  }

  const canVerify =
    record.status === 'pending_verification' &&
    record.performedById !== user?.id &&
    (user?.role === 'technologist' || user?.role === 'supervisor' || user?.role === 'admin');

  const canEdit = record.status === 'draft';

  // Can amend verified or corrected records: supervisors/admins can amend any, technologists can amend their own
  const isOwnRecord = record.performedById === user?.id;
  const isSupervisorOrAdmin = user?.role === 'supervisor' || user?.role === 'admin';
  const canAmend = (record.status === 'verified' || record.status === 'corrected') && (isSupervisorOrAdmin || isOwnRecord);

  // PDF download available for verified or corrected records
  const canDownloadPdf = record.status === 'verified' || record.status === 'corrected';

  return (
    <div className="record-detail">
      <header className="page-header">
        <div>
          <h1>Record: {record.specimenId}</h1>
          <p className="subtitle">
            {record.type} - {record.fluidType}
          </p>
        </div>
        <div className="header-actions">
          <Link to="/records" className="btn secondary">
            Back to List
          </Link>
          {canEdit && (
            <Link to={`/count/${record.type}/${record.id}`} className="btn primary">
              Edit
            </Link>
          )}
          {canAmend && (
            <Link to={`/records/${record.id}/amend`} className="btn warning">
              Amend Record
            </Link>
          )}
          {canDownloadPdf && (
            <button
              className="btn secondary"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
            >
              {downloadingPdf ? 'Generating...' : 'Download PDF'}
            </button>
          )}
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="record-info">
        <div className="info-grid">
          <div className="info-item">
            <label>Status</label>
            <span className={`status-badge status-${record.status.replace('_', '-')}`}>
              {record.status.replace('_', ' ')}
            </span>
          </div>
          <div className="info-item">
            <label>Performed</label>
            <span>{formatDate(record.performedAt)}</span>
          </div>
          <div className="info-item">
            <label>Performed By</label>
            <span>{record.performedBy.name}</span>
          </div>
          {record.verifiedBy && (
            <>
              <div className="info-item">
                <label>Verified</label>
                <span>{formatDate(record.verifiedAt!)}</span>
              </div>
              <div className="info-item">
                <label>Verified By</label>
                <span>{record.verifiedBy.name}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Correction Reason (for amended records) */}
      {record.correctionReason && (
        <div className="correction-reason-section">
          <h2>Amendment Reason</h2>
          <p className="correction-reason-text">{record.correctionReason}</p>
        </div>
      )}

      {/* Count Data - displayed first for easy visibility */}
      {record.type === 'hemocytometer' && (
        <HemocytometerDetails record={record as unknown as HemocytometerRecord} />
      )}

      {record.type === 'retic' && (
        <ReticDetails record={record as unknown as ReticRecord} />
      )}

      {record.type === 'parasite' && (
        <ParasiteDetails record={record as unknown as ParasiteRecord} />
      )}

      {record.type === 'fetal' && (
        <FetalDetails record={record as unknown as FetalRecord} />
      )}

      {/* Attestations Section */}
      {(record.performerAttestation || record.verifierAttestation) && (
        <div className="attestations-section">
          <h2>Attestations</h2>

          {record.performerAttestation && (
            <div className="attestation-display">
              <h3>Performer Attestation</h3>
              <p className="attestation-text">{record.performerAttestation}</p>
              {record.performerAttestedAt && (
                <p className="attestation-timestamp">
                  Attested on {formatDate(record.performerAttestedAt)}
                </p>
              )}
            </div>
          )}

          {record.verifierAttestation && (
            <div className="attestation-display">
              <h3>Verifier Attestation</h3>
              <p className="attestation-text">{record.verifierAttestation}</p>
              {record.verifiedAt && (
                <p className="attestation-timestamp">
                  Attested on {formatDate(record.verifiedAt)}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Method Parameters Section */}
      {record.paramsSnapshot && (
        <div className="method-params-section">
          <h2>Method Parameters</h2>
          <div className="params-header">
            <span className="method-version">v{record.methodVersion || '1.0.0'}</span>
            <span className={`source-badge source-${record.paramsSnapshot.source}`}>
              {record.paramsSnapshot.source === 'org' ? 'Org Config' : 'System Default'}
            </span>
          </div>
          <RecordMethodParamsDisplay
            type={record.type}
            params={record.paramsSnapshot.params}
          />
        </div>
      )}

      {/* Audit Log Section - at bottom for reference */}
      <div className="audit-log-section">
        <h2>Audit Log</h2>
        {auditLog.length > 0 ? (
          <div className="audit-list">
            {auditLog.map((event) => (
              <div key={event.id} className="audit-item">
                <div className="audit-header">
                  <span className="audit-action">{formatAuditAction(event.action)}</span>
                  <span className="audit-time">{formatDate(event.createdAt)}</span>
                </div>
                <div className="audit-actor">
                  By: {event.actor?.name || 'System'}
                </div>
                {event.metadata.correctionReason && (
                  <div className="audit-reason">
                    Reason: {event.metadata.correctionReason}
                  </div>
                )}
                {event.metadata.changes && Object.keys(event.metadata.changes).length > 0 && (
                  <div className="audit-changes">
                    <span className="changes-label">Changes:</span>
                    <ul className="changes-list">
                      {Object.entries(event.metadata.changes).map(([field, change]) => (
                        <li key={field} className="change-item">
                          {formatChangeDescription(field, change)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="no-audit-events">No activity recorded for this record.</p>
        )}
      </div>

      {canVerify && (
        <div className="verify-section">
          <h2>Verification</h2>
          <p>Review the count data above and verify if it is correct.</p>
          <label className="attestation-checkbox">
            <input
              type="checkbox"
              checked={attestationChecked}
              onChange={(e) => setAttestationChecked(e.target.checked)}
            />
            <span>
              I, <strong>{user?.name}</strong>, attest that I have reviewed the count performed by{' '}
              <strong>{record.performedBy.name}</strong> and confirmed the results are correctly entered in the LIS.
            </span>
          </label>
          <button
            className="btn success"
            onClick={handleVerify}
            disabled={verifying || !attestationChecked}
          >
            {verifying ? 'Verifying...' : 'Verify Record'}
          </button>
        </div>
      )}
    </div>
  );
}

function HemocytometerDetails({ record }: { record: HemocytometerRecord }) {
  const { rawTallies, calculations } = record;
  const hasSeparateSettings = rawTallies.side1.separateSettings;
  const rbcSquares = hasSeparateSettings
    ? (rawTallies.side1.rbcSquaresCounted ?? rawTallies.side1.squaresCounted)
    : rawTallies.side1.squaresCounted;
  const rbcDilution = hasSeparateSettings
    ? (rawTallies.side1.rbcDilution ?? rawTallies.side1.dilutionFactor)
    : rawTallies.side1.dilutionFactor;
  const tncSquares = hasSeparateSettings
    ? (rawTallies.side1.tncSquaresCounted ?? rawTallies.side1.squaresCounted)
    : rawTallies.side1.squaresCounted;
  const tncDilution = hasSeparateSettings
    ? (rawTallies.side1.tncDilution ?? rawTallies.side1.dilutionFactor)
    : rawTallies.side1.dilutionFactor;
  const rbcAvg = (rawTallies.side1.rbcCount + rawTallies.side2.rbcCount) / 2;
  const tncAvg = (rawTallies.side1.tncCount + rawTallies.side2.tncCount) / 2;

  return (
    <div className="hemocytometer-details">
      <h2>Count Settings</h2>

      <div className="settings-display">
        {hasSeparateSettings ? (
          <div className="separate-settings">
            <div className="setting-group">
              <h4>RBC Settings</h4>
              <dl>
                <dt>Squares Counted</dt>
                <dd>{rawTallies.side1.rbcSquaresCounted}</dd>
                <dt>Dilution Factor</dt>
                <dd>{rawTallies.side1.rbcDilution}</dd>
              </dl>
            </div>
            <div className="setting-group">
              <h4>TNC Settings</h4>
              <dl>
                <dt>Squares Counted</dt>
                <dd>{rawTallies.side1.tncSquaresCounted}</dd>
                <dt>Dilution Factor</dt>
                <dd>{rawTallies.side1.tncDilution}</dd>
              </dl>
            </div>
          </div>
        ) : (
          <div className="shared-settings">
            <dl>
              <dt>Squares Counted</dt>
              <dd>{rawTallies.side1.squaresCounted}</dd>
              <dt>Dilution Factor</dt>
              <dd>{rawTallies.side1.dilutionFactor}</dd>
            </dl>
          </div>
        )}
      </div>

      <h2>Count Data</h2>

      <div className="sides-grid">
        <div className="side-detail">
          <h3>Side 1</h3>
          <dl>
            <dt>RBC Count</dt>
            <dd>{rawTallies.side1.rbcCount}</dd>
            <dt>TNC Count</dt>
            <dd>{rawTallies.side1.tncCount}</dd>
          </dl>
        </div>

        <div className="side-detail">
          <h3>Side 2</h3>
          <dl>
            <dt>RBC Count</dt>
            <dd>{rawTallies.side2.rbcCount}</dd>
            <dt>TNC Count</dt>
            <dd>{rawTallies.side2.tncCount}</dd>
          </dl>
        </div>
      </div>

      <div className="final-results-display">
        <div className={`result ${calculations.rbcWithinTolerance ? 'valid' : 'invalid'}`}>
          <span className="label">Final RBC</span>
          <span className="value">{calculations.finalRbc}</span>
          {!calculations.rbcWithinTolerance && (
            <span className="warning">Counts out of tolerance</span>
          )}
        </div>
        <div className={`result ${calculations.tncWithinTolerance ? 'valid' : 'invalid'}`}>
          <span className="label">Final TNC</span>
          <span className="value">{calculations.finalTnc}</span>
          {!calculations.tncWithinTolerance && (
            <span className="warning">Counts out of tolerance</span>
          )}
        </div>
      </div>

      <div className="formula-display">
        <div className="formula-row">
          <p>RBC Count = </p>
          <div className="fraction">
            <span className="numerator">(RBC Average) x (dilution) x 10</span>
            <span className="denominator">(# of Squares Counted)</span>
          </div>
          <p> = </p>
          <div className="fraction">
            <span className="numerator">({rbcAvg}) x ({rbcDilution}) x 10</span>
            <span className="denominator">({rbcSquares})</span>
          </div>
          <p> ≈ {calculations.finalRbc}</p>
        </div>
        <div className="formula-row">
          <p>TNC Count = </p>
          <div className="fraction">
            <span className="numerator">(TNC Average) x (dilution) x 10</span>
            <span className="denominator">(# of Squares Counted)</span>
          </div>
          <p> = </p>
          <div className="fraction">
            <span className="numerator">({tncAvg}) x ({tncDilution}) x 10</span>
            <span className="denominator">({tncSquares})</span>
          </div>
          <p> ≈ {calculations.finalTnc}</p>
        </div>
      </div>
    </div>
  );
}

function ReticDetails({ record }: { record: ReticRecord }) {
  const data = record.rawTallies as ReticData;
  const calculations = record.calculations as ReticCalculations;

  return (
    <div className="counter-details retic-details">
      <h2>Count Data</h2>
      <div className="simple-data-grid">
        <div className="data-item">
          <label>Reticulocytes</label>
          <span className="value">{data.reticCount}</span>
        </div>
        <div className="data-item">
          <label>Total RBCs</label>
          <span className="value">{data.rbcCount}</span>
        </div>
      </div>

      <h2>Result</h2>
      <div className="final-results-display">
        <div className="result valid">
          <span className="label">Reticulocyte %</span>
          <span className="value">{calculations.percentRetic}%</span>
        </div>
      </div>

      <div className="formula-display">
        <div className="formula-row">
          <p>Retic % = </p>
          <div className="fraction">
            <span className="numerator">Retic Count</span>
            <span className="denominator">Total RBC Count</span>
          </div>
          <p> × 100 = </p>
          <div className="fraction">
            <span className="numerator">{data.reticCount}</span>
            <span className="denominator">{data.rbcCount}</span>
          </div>
          <p> × 100 = {calculations.percentRetic}%</p>
        </div>
      </div>
    </div>
  );
}

function ParasiteDetails({ record }: { record: ParasiteRecord }) {
  const data = record.rawTallies as ParasiteData;
  const calculations = record.calculations as ParasiteCalculations;

  return (
    <div className="counter-details parasite-details">
      <h2>Count Data</h2>
      <div className="simple-data-grid">
        <div className="data-item">
          <label>Parasitized RBCs</label>
          <span className="value">{data.parasiteCount}</span>
        </div>
        <div className="data-item">
          <label>Total RBCs</label>
          <span className="value">{data.rbcCount}</span>
        </div>
      </div>

      <h2>Result</h2>
      <div className="final-results-display">
        <div className="result valid">
          <span className="label">Parasitemia %</span>
          <span className="value">{calculations.percentParasitemia}%</span>
        </div>
      </div>

      <div className="formula-display">
        <div className="formula-row">
          <p>Parasitemia % = </p>
          <div className="fraction">
            <span className="numerator">Parasite Count</span>
            <span className="denominator">Total RBC Count</span>
          </div>
          <p> × 100 = </p>
          <div className="fraction">
            <span className="numerator">{data.parasiteCount}</span>
            <span className="denominator">{data.rbcCount}</span>
          </div>
          <p> × 100 = {calculations.percentParasitemia}%</p>
        </div>
      </div>
    </div>
  );
}

function FetalDetails({ record }: { record: FetalRecord & { paramsSnapshot?: ParamsSnapshot } }) {
  const data = record.rawTallies as FetalData;
  const calculations = record.calculations as FetalCalculations;
  const params = record.paramsSnapshot?.params as FetalMethodParams | undefined;
  const rbcFieldsCount = params?.rbcFieldsCount ?? data.fields.length;
  const fetalFieldsCount = params?.fetalFieldsCount ?? 30;

  return (
    <div className="counter-details fetal-details">
      <h2>RBC Counts ({rbcFieldsCount} Fields)</h2>
      <div className="fields-data-grid">
        {data.fields.map((count, index) => (
          <div key={index} className="data-item">
            <label>Field {index + 1}</label>
            <span className="value">{count}</span>
          </div>
        ))}
      </div>

      <div className="calculations-grid">
        <div className="calc-item">
          <label>Total in {rbcFieldsCount} Fields</label>
          <span>{calculations.totalRbcIn5Fields}</span>
        </div>
        <div className="calc-item">
          <label>Average per Field</label>
          <span>{calculations.averageRbcPerField}</span>
        </div>
        <div className="calc-item">
          <label>Est. RBCs in {fetalFieldsCount} Fields</label>
          <span>{calculations.rbcIn30Fields}</span>
        </div>
      </div>

      <h2>Fetal Cell Count</h2>
      <div className="simple-data-grid">
        <div className="data-item">
          <label>Fetal Cells (in {fetalFieldsCount} fields)</label>
          <span className="value">{data.fetalCellCount}</span>
        </div>
        <div className="data-item">
          <label>Fields Counted</label>
          <span className="value">{data.fetalFieldsCounted ?? 0}</span>
        </div>
      </div>

      <h2>Result</h2>
      <div className="final-results-display">
        <div className="result valid">
          <span className="label">Fetal Cells %</span>
          <span className="value">{calculations.percentFetal}%</span>
        </div>
      </div>

      <div className="formula-display">
        <div className="formula-row">
          <p>Fetal % = </p>
          <div className="fraction">
            <span className="numerator">Fetal Cells</span>
            <span className="denominator">RBCs in {fetalFieldsCount} Fields</span>
          </div>
          <p> × 100 = </p>
          <div className="fraction">
            <span className="numerator">{data.fetalCellCount}</span>
            <span className="denominator">{calculations.rbcIn30Fields}</span>
          </div>
          <p> × 100 = {calculations.percentFetal}%</p>
        </div>
      </div>
    </div>
  );
}

function RecordMethodParamsDisplay({
  type,
  params,
}: {
  type: CountRecordType;
  params: MethodParams;
}) {
  if (type === 'hemocytometer') {
    const hc = params as HemocytometerMethodParams;
    return (
      <div className="params-display">
        <dl className="params-grid">
          <dt>Default Dilution</dt>
          <dd>{hc.defaultDilution}</dd>
          <dt>Default Squares</dt>
          <dd>{hc.defaultSquaresCounted}</dd>
          <dt>Tolerance %</dt>
          <dd>{hc.tolerancePercent}%</dd>
          <dt>Low Count Tolerance</dt>
          <dd>{hc.lowCountTolerance}</dd>
          <dt>Low Count Threshold</dt>
          <dd>{hc.lowCountThreshold}</dd>
        </dl>
      </div>
    );
  }

  if (type === 'retic' || type === 'parasite') {
    const pc = params as ReticMethodParams;
    return (
      <div className="params-display">
        <dl className="params-grid">
          <dt>Target RBC Count</dt>
          <dd>{pc.targetRbcCount}</dd>
        </dl>
      </div>
    );
  }

  const fc = params as FetalMethodParams;
  return (
    <div className="params-display">
      <dl className="params-grid">
        <dt>RBC Fields Count</dt>
        <dd>{fc.rbcFieldsCount}</dd>
        <dt>Fetal Fields Count</dt>
        <dd>{fc.fetalFieldsCount}</dd>
      </dl>
    </div>
  );
}
