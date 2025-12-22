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
  verifiedAt?: Date | string;
  performedBy: { id: string; name: string; email: string };
  verifiedBy?: { id: string; name: string; email: string };
  site?: { id: string; name: string };
}

export function RecordDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getToken, user } = useAuth();
  const [record, setRecord] = useState<RecordWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecord() {
      if (!id) return;

      try {
        const token = await getToken();
        if (!token) return;

        const data = await api.get<RecordWithRelations>(`/api/records/${id}`, token);
        setRecord(data);
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

      await api.post(`/api/records/${id}/verify`, {}, token);
      navigate('/records');
    } catch (err) {
      console.error('Verify error:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify');
    } finally {
      setVerifying(false);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString();
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

      {canVerify && (
        <div className="verify-section">
          <h2>Verification</h2>
          <p>Review the count data above and verify if it is correct.</p>
          <button
            className="btn success"
            onClick={handleVerify}
            disabled={verifying}
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

      <h2>Calculations</h2>

      <div className="calculations-grid">
        <div className="calc-item">
          <label>Side 1 RBC</label>
          <span>{calculations.side1Rbc}</span>
        </div>
        <div className="calc-item">
          <label>Side 2 RBC</label>
          <span>{calculations.side2Rbc}</span>
        </div>
        <div className="calc-item">
          <label>Side 1 TNC</label>
          <span>{calculations.side1Tnc}</span>
        </div>
        <div className="calc-item">
          <label>Side 2 TNC</label>
          <span>{calculations.side2Tnc}</span>
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
    </div>
  );
}

function FetalDetails({ record }: { record: FetalRecord }) {
  const data = record.rawTallies as FetalData;
  const calculations = record.calculations as FetalCalculations;

  return (
    <div className="counter-details fetal-details">
      <h2>RBC Counts (5 Fields)</h2>
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
          <label>Total in 5 Fields</label>
          <span>{calculations.totalRbcIn5Fields}</span>
        </div>
        <div className="calc-item">
          <label>Average per Field</label>
          <span>{calculations.averageRbcPerField}</span>
        </div>
        <div className="calc-item">
          <label>Est. RBCs in 30 Fields</label>
          <span>{calculations.rbcIn30Fields}</span>
        </div>
      </div>

      <h2>Fetal Cell Count</h2>
      <div className="simple-data-grid">
        <div className="data-item">
          <label>Fetal Cells (in 30 fields)</label>
          <span className="value">{data.fetalCellCount}</span>
        </div>
      </div>

      <h2>Result</h2>
      <div className="final-results-display">
        <div className="result valid">
          <span className="label">Fetal Cells %</span>
          <span className="value">{calculations.percentFetal}%</span>
        </div>
      </div>
    </div>
  );
}
