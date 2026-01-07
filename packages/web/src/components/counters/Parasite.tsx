import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';
import type { ParasiteData, ParasiteCalculations, ParasiteRecord } from '@lab-counters/shared';
import './Counter.css';

const MAX_COUNT = 1000;

export function Parasite() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getToken, user } = useAuth();

  // Specimen info
  const [specimenId, setSpecimenId] = useState('');
  const [isQC, setIsQC] = useState(false);

  // Counter state
  const [parasiteCount, setParasiteCount] = useState(0);
  const [rbcCount, setRbcCount] = useState(0);
  const [mode, setMode] = useState<'add' | 'subtract'>('add');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [performerAttestationChecked, setPerformerAttestationChecked] = useState(false);

  // Load existing record if editing
  useEffect(() => {
    if (!id) return;

    async function loadRecord() {
      try {
        const token = await getToken();
        if (!token) return;

        const record = await api.get<ParasiteRecord>(`/api/records/${id}`, token);
        setSpecimenId(record.specimenId);
        setParasiteCount(record.rawTallies.parasiteCount);
        setRbcCount(record.rawTallies.rbcCount);
      } catch (err) {
        console.error('Failed to load record:', err);
        setError('Failed to load record');
      }
    }

    loadRecord();
  }, [id, getToken]);

  // Calculate percentage
  const calculate = useCallback((): ParasiteCalculations => {
    const percentParasitemia = rbcCount > 0 ? (parasiteCount / rbcCount) * 100 : 0;
    return {
      percentParasitemia: parseFloat(percentParasitemia.toFixed(2)),
    };
  }, [parasiteCount, rbcCount]);

  // Keyboard handler - matches original logic
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === '1') {
        e.preventDefault();
        if (mode === 'add' && rbcCount < MAX_COUNT) {
          setParasiteCount((prev) => prev + 1);
          setRbcCount((prev) => prev + 1);
        } else if (mode === 'subtract' && parasiteCount > 0) {
          setParasiteCount((prev) => prev - 1);
          if (rbcCount > 0) {
            setRbcCount((prev) => prev - 1);
          }
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

  // Button click handlers
  const handleParasiteClick = () => {
    if (mode === 'add' && rbcCount < MAX_COUNT) {
      setParasiteCount((prev) => prev + 1);
      setRbcCount((prev) => prev + 1);
    } else if (mode === 'subtract' && parasiteCount > 0) {
      setParasiteCount((prev) => prev - 1);
      if (rbcCount > 0) {
        setRbcCount((prev) => prev - 1);
      }
    }
  };

  const handleRbcClick = () => {
    if (mode === 'add' && rbcCount < MAX_COUNT) {
      setRbcCount((prev) => prev + 1);
    } else if (mode === 'subtract' && rbcCount > 0) {
      setRbcCount((prev) => prev - 1);
    }
  };

  const handleReset = () => {
    setParasiteCount(0);
    setRbcCount(0);
  };

  const toggleMode = () => {
    setMode((prev) => (prev === 'add' ? 'subtract' : 'add'));
  };

  // Save record
  const handleSave = async (submit: boolean = false) => {
    if (!specimenId.trim()) {
      setError('Please enter a specimen ID');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const rawTallies: ParasiteData = {
        parasiteCount,
        rbcCount,
      };

      let recordId = id;

      if (id) {
        await api.patch(`/api/records/${id}`, { rawTallies }, token);
      } else {
        const record = await api.post<ParasiteRecord>(
          '/api/records',
          {
            type: 'parasite',
            specimenId: specimenId.trim(),
            fluidType: 'other',
            dilution: 1,
            squaresCounted: 1,
            isQC,
            rawTallies,
          },
          token
        );
        recordId = record.id;
      }

      if (submit && recordId) {
        const performerAttestation = `I, ${user?.name}, attest to having performed this count, verified the results for accuracy, and entered the data into the LIS pending verification by a second person.`;
        await api.post(`/api/records/${recordId}/submit`, { performerAttestation }, token);
      }

      navigate('/records');
    } catch (err) {
      console.error('Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const calculations = calculate();
  const canSubmit = rbcCount > 0 && (isQC || performerAttestationChecked);

  return (
    <div className="counter-page parasite-counter">
      <header className="counter-header">
        <h1>Parasite Counter</h1>
        <p className="counter-description">
          Count parasitized RBCs and total RBCs to calculate the percent parasitemia.
        </p>
        <div className="specimen-info">
          <div className="form-group">
            <label htmlFor="specimen-id">Specimen ID</label>
            <input
              type="text"
              id="specimen-id"
              value={specimenId}
              onChange={(e) => setSpecimenId(e.target.value)}
              placeholder="Enter specimen ID"
            />
          </div>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isQC}
                onChange={(e) => setIsQC(e.target.checked)}
              />
              QC Sample (no verification required)
            </label>
          </div>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {/* Results */}
      <div className="results-section">
        <div className="result-display">
          <span className="label">Parasitemia:</span>
          <span className="value">{calculations.percentParasitemia}%</span>
        </div>
      </div>

      {/* Counter Section */}
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
          <button className={`mode-btn ${mode}`} onClick={toggleMode}>
            {mode === 'add' ? 'Add' : 'Subtract'}
          </button>
          <button className="reset-btn" onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>

      {/* Formula Display */}
      {rbcCount > 0 && (
        <div className="formula-display">
          <div className="formula-row">
            <p>Parasitemia % = </p>
            <div className="fraction">
              <span className="numerator">Parasitized RBCs</span>
              <span className="denominator">Total RBCs</span>
            </div>
            <p> × 100 = </p>
            <div className="fraction">
              <span className="numerator">{parasiteCount}</span>
              <span className="denominator">{rbcCount}</span>
            </div>
            <p> × 100 = {calculations.percentParasitemia}%</p>
          </div>
        </div>
      )}

      {/* Performer Attestation */}
      {!isQC && rbcCount > 0 && (
        <div className="attestation-section">
          <label className="attestation-checkbox">
            <input
              type="checkbox"
              checked={performerAttestationChecked}
              onChange={(e) => setPerformerAttestationChecked(e.target.checked)}
            />
            <span>
              I, <strong>{user?.name}</strong>, attest to having performed this count, verified the results for accuracy, and entered the data into the LIS pending verification by a second person.
            </span>
          </label>
        </div>
      )}

      {/* Actions */}
      <div className="actions">
        <button className="btn secondary" onClick={() => navigate('/records')}>
          Cancel
        </button>
        <button
          className="btn primary"
          onClick={() => handleSave(false)}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Draft'}
        </button>
        <button
          className="btn success"
          onClick={() => handleSave(true)}
          disabled={saving || !canSubmit}
          title={!canSubmit ? 'Count some cells to submit' : ''}
        >
          {isQC ? 'Submit' : 'Submit for Verification'}
        </button>
      </div>
    </div>
  );
}
