import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';
import type { CountRecord, HemocytometerRecord } from '@lab-counters/shared';
import './Records.css';

interface RecordWithRelations extends CountRecord {
  createdBy: { id: string; name: string; email: string };
  verifiedBy?: { id: string; name: string; email: string };
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
    (user?.role === 'supervisor' || user?.role === 'admin');

  const canEdit = record.status === 'draft';

  return (
    <div className="record-detail">
      <header className="page-header">
        <div>
          <h1>Record: {record.specimenId}</h1>
          <p className="subtitle">
            {record.type} - {record.specimenType}
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
            <label>Created</label>
            <span>{formatDate(record.createdAt)}</span>
          </div>
          <div className="info-item">
            <label>Created By</label>
            <span>{record.createdBy.name}</span>
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
  const { data, calculations } = record;

  return (
    <div className="hemocytometer-details">
      <h2>Count Data</h2>

      <div className="sides-grid">
        <div className="side-detail">
          <h3>Side 1</h3>
          <dl>
            <dt>RBC Count</dt>
            <dd>{data.side1.rbcCount}</dd>
            <dt>TNC Count</dt>
            <dd>{data.side1.tncCount}</dd>
            <dt>Squares</dt>
            <dd>{data.side1.squaresCounted}</dd>
            <dt>Dilution</dt>
            <dd>{data.side1.dilutionFactor}</dd>
          </dl>
        </div>

        <div className="side-detail">
          <h3>Side 2</h3>
          <dl>
            <dt>RBC Count</dt>
            <dd>{data.side2.rbcCount}</dd>
            <dt>TNC Count</dt>
            <dd>{data.side2.tncCount}</dd>
            <dt>Squares</dt>
            <dd>{data.side2.squaresCounted}</dd>
            <dt>Dilution</dt>
            <dd>{data.side2.dilutionFactor}</dd>
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
