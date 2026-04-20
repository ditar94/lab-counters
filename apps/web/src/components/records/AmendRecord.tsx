import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';
import type {
  CountRecordType,
  HemocytometerData,
  ReticData,
  ParasiteData,
  FetalData,
  HemocytometerCalculations,
  ReticCalculations,
  ParasiteCalculations,
  FetalCalculations,
} from '@lab-counters/shared';
import './Records.css';

type RawTalliesType = HemocytometerData | ReticData | ParasiteData | FetalData;

interface RecordForAmend {
  id: string;
  specimenId: string;
  fluidType: string;
  type: CountRecordType;
  status: string;
  rawTallies: RawTalliesType;
  performedBy: { id: string; name: string };
  performedAt: string;
}

export function AmendRecord() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getToken, user } = useAuth();
  const [record, setRecord] = useState<RecordForAmend | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');

  // Metadata fields
  const [specimenId, setSpecimenId] = useState('');
  const [performedAt, setPerformedAt] = useState('');

  // Track original values for comparison
  const [originalRawTallies, setOriginalRawTallies] = useState<RawTalliesType | null>(null);
  const [rawTallies, setRawTallies] = useState<RawTalliesType | null>(null);

  useEffect(() => {
    async function fetchRecord() {
      if (!id) return;

      try {
        const token = await getToken();
        if (!token) return;

        const data = await api.get<RecordForAmend>(`/api/records/${id}`, token);

        // Check if record can be amended (verified or already corrected)
        if (data.status !== 'verified' && data.status !== 'corrected') {
          setError('Only verified or corrected records can be amended');
          setLoading(false);
          return;
        }

        // Check permission
        const isOwnRecord = data.performedBy.id === user?.id;
        const isSupervisorOrAdmin = user?.role === 'supervisor' || user?.role === 'admin';
        if (!isOwnRecord && !isSupervisorOrAdmin) {
          setError('You do not have permission to amend this record');
          setLoading(false);
          return;
        }

        setRecord(data);
        setSpecimenId(data.specimenId);
        // Format date for datetime-local input
        const date = new Date(data.performedAt);
        setPerformedAt(date.toISOString().slice(0, 16));
        setRawTallies(data.rawTallies);
        setOriginalRawTallies(JSON.parse(JSON.stringify(data.rawTallies)));
      } catch (err) {
        console.error('Failed to fetch record:', err);
        setError('Failed to load record');
      } finally {
        setLoading(false);
      }
    }

    fetchRecord();
  }, [id, getToken, user]);

  // Check if rawTallies have changed
  const talliesChanged = useCallback(() => {
    if (!rawTallies || !originalRawTallies) return false;
    return JSON.stringify(rawTallies) !== JSON.stringify(originalRawTallies);
  }, [rawTallies, originalRawTallies]);

  // Check if any metadata changed
  const metadataChanged = useCallback(() => {
    if (!record) return false;
    const originalDate = new Date(record.performedAt).toISOString().slice(0, 16);
    return specimenId !== record.specimenId || performedAt !== originalDate;
  }, [record, specimenId, performedAt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !record) return;

    if (!correctionReason.trim()) {
      setError('Please provide a reason for the amendment');
      return;
    }

    if (!talliesChanged() && !metadataChanged()) {
      setError('No changes have been made to the record');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const requestBody: {
        reason: string;
        rawTallies?: RawTalliesType;
        specimenId?: string;
        performedAt?: string;
      } = {
        reason: correctionReason,
      };

      // Only include rawTallies if changed
      if (talliesChanged() && rawTallies) {
        requestBody.rawTallies = rawTallies;
      }

      // Only include metadata if changed
      if (specimenId !== record.specimenId) {
        requestBody.specimenId = specimenId;
      }
      if (performedAt !== new Date(record.performedAt).toISOString().slice(0, 16)) {
        requestBody.performedAt = new Date(performedAt).toISOString();
      }

      await api.post(
        `/api/records/${id}/amend`,
        requestBody,
        token
      );

      // Navigate back to the record (same ID, now corrected)
      navigate(`/records/${id}`);
    } catch (err) {
      console.error('Amendment failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to create amendment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error && !record) {
    return (
      <div className="amend-record">
        <div className="error-banner">{error}</div>
        <Link to={`/records/${id}`} className="btn secondary">
          Back to Record
        </Link>
      </div>
    );
  }

  if (!record || !rawTallies) {
    return <div className="error">Record not found</div>;
  }

  return (
    <div className="amend-record">
      <header className="page-header">
        <div>
          <h1>Amend Record: {record.specimenId}</h1>
          <p className="subtitle">{record.type}</p>
        </div>
        <div className="header-actions">
          <Link to={`/records/${id}`} className="btn secondary">
            Cancel
          </Link>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Metadata Section */}
        <div className="amend-section">
          <h2>Record Metadata</h2>
          <div className="amend-metadata-grid">
            <div className="form-group">
              <label htmlFor="specimen-id">Specimen ID</label>
              <input
                type="text"
                id="specimen-id"
                value={specimenId}
                onChange={(e) => setSpecimenId(e.target.value)}
                placeholder="Enter specimen ID"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="performed-at">Date/Time Performed</label>
              <input
                type="datetime-local"
                id="performed-at"
                value={performedAt}
                onChange={(e) => setPerformedAt(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Reason Section */}
        <div className="amend-section">
          <h2>Reason for Amendment</h2>
          <p className="section-description">
            Describe why this record needs to be corrected. This will be recorded in the audit trail.
          </p>
          <textarea
            className="correction-reason-input"
            value={correctionReason}
            onChange={(e) => setCorrectionReason(e.target.value)}
            placeholder="Enter the reason for this amendment..."
            rows={3}
            required
          />
        </div>

        {/* Counter Section */}
        <div className="amend-section">
          <h2>Count Data</h2>
          <p className="section-description">
            Modify the count values below using the counter interface.
          </p>

          {record.type === 'hemocytometer' && (
            <HemocytometerAmendCounter
              rawTallies={rawTallies as HemocytometerData}
              onChange={setRawTallies}
            />
          )}

          {record.type === 'retic' && (
            <ReticAmendCounter
              rawTallies={rawTallies as ReticData}
              onChange={setRawTallies}
            />
          )}

          {record.type === 'parasite' && (
            <ParasiteAmendCounter
              rawTallies={rawTallies as ParasiteData}
              onChange={setRawTallies}
            />
          )}

          {record.type === 'fetal' && (
            <FetalAmendCounter
              rawTallies={rawTallies as FetalData}
              onChange={setRawTallies}
            />
          )}
        </div>

        <div className="amend-actions">
          <button
            type="submit"
            className="btn warning"
            disabled={submitting || !correctionReason.trim() || (!talliesChanged() && !metadataChanged())}
          >
            {submitting ? 'Saving Amendment...' : 'Save Amendment'}
          </button>
          <p className="amend-note">
            This will update the record and mark it as corrected. All changes will be logged in the audit trail.
          </p>
        </div>
      </form>
    </div>
  );
}

// ============================================
// Hemocytometer Counter for Amendment
// ============================================

interface SideState {
  rbcCount: number;
  tncCount: number;
  isDone: boolean;
  mode: 'add' | 'subtract';
}

function HemocytometerAmendCounter({
  rawTallies,
  onChange,
}: {
  rawTallies: HemocytometerData;
  onChange: (data: RawTalliesType) => void;
}) {
  const inputRef1 = useRef<HTMLInputElement>(null);
  const inputRef2 = useRef<HTMLInputElement>(null);
  const isInitialMount = useRef(true);

  const [side1, setSide1] = useState<SideState>({
    rbcCount: rawTallies.side1.rbcCount,
    tncCount: rawTallies.side1.tncCount,
    isDone: rawTallies.side1.isDone,
    mode: 'add',
  });

  const [side2, setSide2] = useState<SideState>({
    rbcCount: rawTallies.side2.rbcCount,
    tncCount: rawTallies.side2.tncCount,
    isDone: rawTallies.side2.isDone,
    mode: 'add',
  });

  // Update parent when counts change (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    onChange({
      ...rawTallies,
      side1: { ...rawTallies.side1, rbcCount: side1.rbcCount, tncCount: side1.tncCount, isDone: side1.isDone },
      side2: { ...rawTallies.side2, rbcCount: side2.rbcCount, tncCount: side2.tncCount, isDone: side2.isDone },
    });
  }, [side1.rbcCount, side1.tncCount, side1.isDone, side2.rbcCount, side2.tncCount, side2.isDone]);

  // Calculate results
  const calculate = useCallback((): HemocytometerCalculations => {
    const settings = rawTallies.side1;
    const squares = settings.separateSettings ? settings.rbcSquaresCounted ?? settings.squaresCounted : settings.squaresCounted;
    const dilution = settings.separateSettings ? settings.rbcDilution ?? settings.dilutionFactor : settings.dilutionFactor;
    const tncSquares = settings.separateSettings ? settings.tncSquaresCounted ?? settings.squaresCounted : settings.squaresCounted;
    const tncDilution = settings.separateSettings ? settings.tncDilution ?? settings.dilutionFactor : settings.dilutionFactor;

    const side1Rbc = (side1.rbcCount * dilution * 10) / squares;
    const side1Tnc = (side1.tncCount * tncDilution * 10) / tncSquares;
    const side2Rbc = (side2.rbcCount * dilution * 10) / squares;
    const side2Tnc = (side2.tncCount * tncDilution * 10) / tncSquares;

    const rbcAvg = (side1.rbcCount + side2.rbcCount) / 2;
    const tncAvg = (side1.tncCount + side2.tncCount) / 2;
    const averageRbc = (rbcAvg * dilution * 10) / squares;
    const averageTnc = (tncAvg * tncDilution * 10) / tncSquares;

    const isWithinTolerance = (v1: number, v2: number) => {
      if (v1 < 10 || v2 < 10) return Math.abs(v1 - v2) <= 5;
      const avg = (v1 + v2) / 2;
      return (100 * Math.abs(v1 - v2)) / avg <= 20;
    };

    return {
      side1Rbc: Math.round(side1Rbc),
      side1Tnc: Math.round(side1Tnc),
      side2Rbc: Math.round(side2Rbc),
      side2Tnc: Math.round(side2Tnc),
      averageRbc,
      averageTnc,
      finalRbc: Math.round(averageRbc),
      finalTnc: Math.round(averageTnc),
      rbcWithinTolerance: isWithinTolerance(side1.rbcCount, side2.rbcCount),
      tncWithinTolerance: isWithinTolerance(side1.tncCount, side2.tncCount),
    };
  }, [side1, side2, rawTallies]);

  const handleKeyDown = useCallback(
    (side: 1 | 2) => (e: React.KeyboardEvent) => {
      const setSide = side === 1 ? setSide1 : setSide2;
      const currentSide = side === 1 ? side1 : side2;

      if (currentSide.isDone) return;

      if (e.key === '1') {
        e.preventDefault();
        setSide((prev) => ({
          ...prev,
          rbcCount: prev.mode === 'add' ? prev.rbcCount + 1 : Math.max(0, prev.rbcCount - 1),
        }));
      } else if (e.key === '3') {
        e.preventDefault();
        setSide((prev) => ({
          ...prev,
          tncCount: prev.mode === 'add' ? prev.tncCount + 1 : Math.max(0, prev.tncCount - 1),
        }));
      }
    },
    [side1.isDone, side2.isDone]
  );

  const handleCountClick = (side: 1 | 2, type: 'rbc' | 'tnc') => {
    const setSide = side === 1 ? setSide1 : setSide2;
    const currentSide = side === 1 ? side1 : side2;

    if (currentSide.isDone) return;

    const countKey = type === 'rbc' ? 'rbcCount' : 'tncCount';
    setSide((prev) => ({
      ...prev,
      [countKey]: prev.mode === 'add' ? prev[countKey] + 1 : Math.max(0, prev[countKey] - 1),
    }));
  };

  const handleReset = (side: 1 | 2) => {
    const setSide = side === 1 ? setSide1 : setSide2;
    setSide((prev) => ({ ...prev, rbcCount: 0, tncCount: 0 }));
  };

  const toggleMode = (side: 1 | 2) => {
    const setSide = side === 1 ? setSide1 : setSide2;
    setSide((prev) => ({ ...prev, mode: prev.mode === 'add' ? 'subtract' : 'add' }));
  };

  const calculations = calculate();
  const bothDone = side1.isDone && side2.isDone;

  return (
    <div className="embedded-counter hemocytometer-counter">
      {/* Final Results */}
      {bothDone && (
        <div className="results-section">
          <div className="final-results">
            <div className={`result ${calculations.rbcWithinTolerance ? 'valid' : 'invalid'}`}>
              <span className="label">Final RBC:</span>
              <span className="value">{calculations.finalRbc}</span>
            </div>
            <div className={`result ${calculations.tncWithinTolerance ? 'valid' : 'invalid'}`}>
              <span className="label">Final TNC:</span>
              <span className="value">{calculations.finalTnc}</span>
            </div>
          </div>
        </div>
      )}

      <div className="sides-container">
        {/* Side 1 */}
        <div className={`side ${side1.isDone ? 'done' : ''}`}>
          <div className="side-header">
            <h3>Side 1</h3>
            <label className="done-checkbox">
              <input
                type="checkbox"
                checked={side1.isDone}
                onChange={(e) => setSide1((prev) => ({ ...prev, isDone: e.target.checked }))}
              />
              Done
            </label>
          </div>

          <div className="count-buttons">
            <button
              className={`count-btn rbc ${!calculations.rbcWithinTolerance && bothDone ? 'error' : ''}`}
              onClick={() => handleCountClick(1, 'rbc')}
              disabled={side1.isDone}
            >
              <span>RBC</span>
              <span className="count-value">{side1.rbcCount}</span>
            </button>
            <button
              className={`count-btn tnc ${!calculations.tncWithinTolerance && bothDone ? 'error' : ''}`}
              onClick={() => handleCountClick(1, 'tnc')}
              disabled={side1.isDone}
            >
              <span>TNC</span>
              <span className="count-value">{side1.tncCount}</span>
            </button>
          </div>

          <div className="counter-input">
            <input
              ref={inputRef1}
              type="text"
              placeholder={side1.isDone ? 'Counter Disabled' : 'Click to count (1=RBC, 3=TNC)'}
              onKeyDown={handleKeyDown(1)}
              disabled={side1.isDone}
              readOnly
            />
          </div>

          <div className="counter-controls">
            <button className={`mode-btn ${side1.mode}`} onClick={() => toggleMode(1)} disabled={side1.isDone}>
              {side1.mode === 'add' ? 'Add' : 'Subtract'}
            </button>
            <button className="reset-btn" onClick={() => handleReset(1)} disabled={side1.isDone}>
              Reset
            </button>
          </div>
        </div>

        {/* Side 2 */}
        <div className={`side ${side2.isDone ? 'done' : ''}`}>
          <div className="side-header">
            <h3>Side 2</h3>
            <label className="done-checkbox">
              <input
                type="checkbox"
                checked={side2.isDone}
                onChange={(e) => setSide2((prev) => ({ ...prev, isDone: e.target.checked }))}
              />
              Done
            </label>
          </div>

          <div className="count-buttons">
            <button
              className={`count-btn rbc ${!calculations.rbcWithinTolerance && bothDone ? 'error' : ''}`}
              onClick={() => handleCountClick(2, 'rbc')}
              disabled={side2.isDone}
            >
              <span>RBC</span>
              <span className="count-value">{side2.rbcCount}</span>
            </button>
            <button
              className={`count-btn tnc ${!calculations.tncWithinTolerance && bothDone ? 'error' : ''}`}
              onClick={() => handleCountClick(2, 'tnc')}
              disabled={side2.isDone}
            >
              <span>TNC</span>
              <span className="count-value">{side2.tncCount}</span>
            </button>
          </div>

          <div className="counter-input">
            <input
              ref={inputRef2}
              type="text"
              placeholder={side2.isDone ? 'Counter Disabled' : 'Click to count (1=RBC, 3=TNC)'}
              onKeyDown={handleKeyDown(2)}
              disabled={side2.isDone}
              readOnly
            />
          </div>

          <div className="counter-controls">
            <button className={`mode-btn ${side2.mode}`} onClick={() => toggleMode(2)} disabled={side2.isDone}>
              {side2.mode === 'add' ? 'Add' : 'Subtract'}
            </button>
            <button className="reset-btn" onClick={() => handleReset(2)} disabled={side2.isDone}>
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Retic Counter for Amendment
// ============================================

function ReticAmendCounter({
  rawTallies,
  onChange,
}: {
  rawTallies: ReticData;
  onChange: (data: RawTalliesType) => void;
}) {
  const MAX_COUNT = 1000;
  const isInitialMount = useRef(true);
  const [reticCount, setReticCount] = useState(rawTallies.reticCount);
  const [rbcCount, setRbcCount] = useState(rawTallies.rbcCount);
  const [mode, setMode] = useState<'add' | 'subtract'>('add');

  // Update parent when counts change (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    onChange({ reticCount, rbcCount });
  }, [reticCount, rbcCount]);

  const calculate = useCallback((): ReticCalculations => {
    const percentRetic = rbcCount > 0 ? (reticCount / rbcCount) * 100 : 0;
    return { percentRetic: parseFloat(percentRetic.toFixed(2)) };
  }, [reticCount, rbcCount]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === '1') {
        e.preventDefault();
        if (mode === 'add' && rbcCount < MAX_COUNT) {
          setReticCount((prev) => prev + 1);
          setRbcCount((prev) => prev + 1);
        } else if (mode === 'subtract' && reticCount > 0) {
          setReticCount((prev) => prev - 1);
          if (rbcCount > 0) setRbcCount((prev) => prev - 1);
        }
      } else if (e.key === '3') {
        e.preventDefault();
        if (mode === 'add' && rbcCount < MAX_COUNT) {
          setRbcCount((prev) => prev + 1);
        } else if (mode === 'subtract' && rbcCount > 0) {
          setRbcCount((prev) => prev - 1);
        }
      }
    },
    [mode, reticCount, rbcCount]
  );

  const handleReticClick = () => {
    if (mode === 'add' && rbcCount < MAX_COUNT) {
      setReticCount((prev) => prev + 1);
      setRbcCount((prev) => prev + 1);
    } else if (mode === 'subtract' && reticCount > 0) {
      setReticCount((prev) => prev - 1);
      if (rbcCount > 0) setRbcCount((prev) => prev - 1);
    }
  };

  const handleRbcClick = () => {
    if (mode === 'add' && rbcCount < MAX_COUNT) {
      setRbcCount((prev) => prev + 1);
    } else if (mode === 'subtract' && rbcCount > 0) {
      setRbcCount((prev) => prev - 1);
    }
  };

  const calculations = calculate();

  return (
    <div className="embedded-counter retic-counter">
      <div className="results-section">
        <div className="result-display">
          <span className="label">Reticulocyte %:</span>
          <span className="value">{calculations.percentRetic}%</span>
        </div>
      </div>

      <div className="counter-section">
        <div className="count-buttons two-button">
          <button className="count-btn retic" onClick={handleReticClick}>
            <span>Retic</span>
            <span className="count-value">{reticCount}</span>
            <span className="hint">Press 1</span>
          </button>
          <button className="count-btn rbc" onClick={handleRbcClick}>
            <span>RBC Only</span>
            <span className="count-value">{rbcCount}</span>
            <span className="hint">Press 3</span>
          </button>
        </div>

        <div className="counter-input">
          <input
            type="text"
            placeholder="Click here and use 1/3 keys to count"
            onKeyDown={handleKeyDown}
            readOnly
          />
        </div>

        <div className="counter-controls">
          <button className={`mode-btn ${mode}`} onClick={() => setMode((m) => (m === 'add' ? 'subtract' : 'add'))}>
            {mode === 'add' ? 'Add' : 'Subtract'}
          </button>
          <button className="reset-btn" onClick={() => { setReticCount(0); setRbcCount(0); }}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Parasite Counter for Amendment
// ============================================

function ParasiteAmendCounter({
  rawTallies,
  onChange,
}: {
  rawTallies: ParasiteData;
  onChange: (data: RawTalliesType) => void;
}) {
  const MAX_COUNT = 1000;
  const isInitialMount = useRef(true);
  const [parasiteCount, setParasiteCount] = useState(rawTallies.parasiteCount);
  const [rbcCount, setRbcCount] = useState(rawTallies.rbcCount);
  const [mode, setMode] = useState<'add' | 'subtract'>('add');

  // Update parent when counts change (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    onChange({ parasiteCount, rbcCount });
  }, [parasiteCount, rbcCount]);

  const calculate = useCallback((): ParasiteCalculations => {
    const percentParasitemia = rbcCount > 0 ? (parasiteCount / rbcCount) * 100 : 0;
    return { percentParasitemia: parseFloat(percentParasitemia.toFixed(2)) };
  }, [parasiteCount, rbcCount]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === '1') {
        e.preventDefault();
        if (mode === 'add' && rbcCount < MAX_COUNT) {
          setParasiteCount((prev) => prev + 1);
          setRbcCount((prev) => prev + 1);
        } else if (mode === 'subtract' && parasiteCount > 0) {
          setParasiteCount((prev) => prev - 1);
          if (rbcCount > 0) setRbcCount((prev) => prev - 1);
        }
      } else if (e.key === '3') {
        e.preventDefault();
        if (mode === 'add' && rbcCount < MAX_COUNT) {
          setRbcCount((prev) => prev + 1);
        } else if (mode === 'subtract' && rbcCount > 0) {
          setRbcCount((prev) => prev - 1);
        }
      }
    },
    [mode, parasiteCount, rbcCount]
  );

  const handleParasiteClick = () => {
    if (mode === 'add' && rbcCount < MAX_COUNT) {
      setParasiteCount((prev) => prev + 1);
      setRbcCount((prev) => prev + 1);
    } else if (mode === 'subtract' && parasiteCount > 0) {
      setParasiteCount((prev) => prev - 1);
      if (rbcCount > 0) setRbcCount((prev) => prev - 1);
    }
  };

  const handleRbcClick = () => {
    if (mode === 'add' && rbcCount < MAX_COUNT) {
      setRbcCount((prev) => prev + 1);
    } else if (mode === 'subtract' && rbcCount > 0) {
      setRbcCount((prev) => prev - 1);
    }
  };

  const calculations = calculate();

  return (
    <div className="embedded-counter parasite-counter">
      <div className="results-section">
        <div className="result-display">
          <span className="label">Parasitemia:</span>
          <span className="value">{calculations.percentParasitemia}%</span>
        </div>
      </div>

      <div className="counter-section">
        <div className="count-buttons two-button">
          <button className="count-btn parasite" onClick={handleParasiteClick}>
            <span>Parasite</span>
            <span className="count-value">{parasiteCount}</span>
            <span className="hint">Press 1</span>
          </button>
          <button className="count-btn rbc" onClick={handleRbcClick}>
            <span>RBC Only</span>
            <span className="count-value">{rbcCount}</span>
            <span className="hint">Press 3</span>
          </button>
        </div>

        <div className="counter-input">
          <input
            type="text"
            placeholder="Click here and use 1/3 keys to count"
            onKeyDown={handleKeyDown}
            readOnly
          />
        </div>

        <div className="counter-controls">
          <button className={`mode-btn ${mode}`} onClick={() => setMode((m) => (m === 'add' ? 'subtract' : 'add'))}>
            {mode === 'add' ? 'Add' : 'Subtract'}
          </button>
          <button className="reset-btn" onClick={() => { setParasiteCount(0); setRbcCount(0); }}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Fetal Counter for Amendment
// ============================================

function FetalAmendCounter({
  rawTallies,
  onChange,
}: {
  rawTallies: FetalData;
  onChange: (data: RawTalliesType) => void;
}) {
  const isInitialMount = useRef(true);
  const [fields, setFields] = useState<number[]>([...rawTallies.fields]);
  const [fetalCellCount, setFetalCellCount] = useState(rawTallies.fetalCellCount);
  const [activeField, setActiveField] = useState(1);
  const [mode, setMode] = useState<'add' | 'subtract'>('add');

  // Update parent when counts change (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    onChange({ fields: fields as [number, number, number, number, number], fetalCellCount });
  }, [fields, fetalCellCount]);

  const calculate = useCallback((): FetalCalculations => {
    const totalRbcIn5Fields = fields.reduce((sum, f) => sum + f, 0);
    const averageRbcPerField = totalRbcIn5Fields / 5;
    const rbcIn30Fields = Math.round(averageRbcPerField * 30);
    const percentFetal = rbcIn30Fields > 0 ? (fetalCellCount / rbcIn30Fields) * 100 : 0;

    return {
      totalRbcIn5Fields,
      averageRbcPerField: parseFloat(averageRbcPerField.toFixed(1)),
      rbcIn30Fields,
      percentFetal: parseFloat(percentFetal.toFixed(1)),
    };
  }, [fields, fetalCellCount]);

  const handleFieldKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === '3') {
        e.preventDefault();
        setFields((prev) => {
          const newFields = [...prev];
          if (mode === 'add') {
            newFields[activeField - 1] += 1;
          } else if (newFields[activeField - 1] > 0) {
            newFields[activeField - 1] -= 1;
          }
          return newFields;
        });
      }
    },
    [mode, activeField]
  );

  const handleFetalKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === '1') {
        e.preventDefault();
        if (mode === 'add') {
          setFetalCellCount((prev) => prev + 1);
        } else if (fetalCellCount > 0) {
          setFetalCellCount((prev) => prev - 1);
        }
      }
    },
    [mode, fetalCellCount]
  );

  const handleFieldClick = () => {
    setFields((prev) => {
      const newFields = [...prev];
      if (mode === 'add') {
        newFields[activeField - 1] += 1;
      } else if (newFields[activeField - 1] > 0) {
        newFields[activeField - 1] -= 1;
      }
      return newFields;
    });
  };

  const handleFetalClick = () => {
    if (mode === 'add') {
      setFetalCellCount((prev) => prev + 1);
    } else if (fetalCellCount > 0) {
      setFetalCellCount((prev) => prev - 1);
    }
  };

  const calculations = calculate();

  return (
    <div className="embedded-counter fetal-counter">
      <div className="results-section">
        <div className="result-display">
          <span className="label">Fetal Cells:</span>
          <span className="value">{calculations.percentFetal}%</span>
        </div>
      </div>

      {/* Step 1: RBC Fields */}
      <div className="fields-section">
        <h4>Step 1: RBC Counts in 5 Fields</h4>

        <div className="field-selector">
          {fields.map((value, index) => (
            <button
              key={index}
              className={`field-tab ${activeField === index + 1 ? 'active' : ''}`}
              onClick={() => setActiveField(index + 1)}
            >
              Field {index + 1}: {value}
            </button>
          ))}
        </div>

        <div className="count-buttons">
          <button className="count-btn rbc" onClick={handleFieldClick}>
            <span>Field {activeField} RBC</span>
            <span className="count-value">{fields[activeField - 1]}</span>
            <span className="hint">Press 3</span>
          </button>
        </div>

        <div className="counter-input">
          <input
            type="text"
            placeholder={`Click here to count Field ${activeField}`}
            onKeyDown={handleFieldKeyDown}
            readOnly
          />
        </div>

        <div className="calculations-grid">
          <div className="calc-item">
            <span className="label">Total in 5 Fields</span>
            <span className="value">{calculations.totalRbcIn5Fields}</span>
          </div>
          <div className="calc-item">
            <span className="label">Est. RBCs in 30 Fields</span>
            <span className="value">{calculations.rbcIn30Fields}</span>
          </div>
        </div>
      </div>

      {/* Step 2: Fetal Cells */}
      <div className="fetal-count-section">
        <h4>Step 2: Fetal Cells in 30 Fields</h4>

        <div className="count-buttons">
          <button className="count-btn parasite" onClick={handleFetalClick}>
            <span>Fetal Cell</span>
            <span className="count-value">{fetalCellCount}</span>
            <span className="hint">Press 1</span>
          </button>
        </div>

        <div className="counter-input">
          <input
            type="text"
            placeholder="Click here to count fetal cells"
            onKeyDown={handleFetalKeyDown}
            readOnly
          />
        </div>
      </div>

      <div className="counter-controls">
        <button className={`mode-btn ${mode}`} onClick={() => setMode((m) => (m === 'add' ? 'subtract' : 'add'))}>
          {mode === 'add' ? 'Add' : 'Subtract'}
        </button>
        <button className="reset-btn" onClick={() => { setFields([0, 0, 0, 0, 0]); setFetalCellCount(0); }}>
          Reset All
        </button>
      </div>
    </div>
  );
}
