import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';
import type {
  HemocytometerData,
  HemocytometerCalculations,
  HemocytometerRecord,
  SpecimenType,
} from '@lab-counters/shared';
import './Hemocytometer.css';

type SquaresCounted = 0.2 | 4 | 9;

interface SideState {
  rbcCount: number;
  tncCount: number;
  isDone: boolean;
  mode: 'add' | 'subtract';
}

interface CountSettings {
  squaresCounted: SquaresCounted;
  dilutionFactor: number;
}

const SPECIMEN_TYPES: { value: SpecimenType; label: string }[] = [
  { value: 'csf', label: 'CSF' },
  { value: 'synovial', label: 'Synovial' },
  { value: 'pleural', label: 'Pleural' },
  { value: 'peritoneal', label: 'Peritoneal' },
  { value: 'pericardial', label: 'Pericardial' },
  { value: 'other', label: 'Other' },
];

const SQUARES_OPTIONS: { value: SquaresCounted; label: string }[] = [
  { value: 0.2, label: '0.2 (i.e. 5 Small/RBC)' },
  { value: 4, label: '4' },
  { value: 9, label: '9' },
];

export function Hemocytometer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const inputRef1 = useRef<HTMLInputElement>(null);
  const inputRef2 = useRef<HTMLInputElement>(null);

  // Specimen info
  const [specimenId, setSpecimenId] = useState('');
  const [specimenType, setSpecimenType] = useState<SpecimenType>('csf');

  // Counter state for each side
  const [side1, setSide1] = useState<SideState>({
    rbcCount: 0,
    tncCount: 0,
    isDone: false,
    mode: 'add',
  });

  const [side2, setSide2] = useState<SideState>({
    rbcCount: 0,
    tncCount: 0,
    isDone: false,
    mode: 'add',
  });

  // Shared settings (applies to both RBC and TNC by default)
  const [sharedSettings, setSharedSettings] = useState<CountSettings>({
    squaresCounted: 9,
    dilutionFactor: 1,
  });

  // Separate settings mode
  const [separateSettings, setSeparateSettings] = useState(false);

  // RBC-specific settings (used when separateSettings is true)
  const [rbcSettings, setRbcSettings] = useState<CountSettings>({
    squaresCounted: 9,
    dilutionFactor: 1,
  });

  // TNC-specific settings (used when separateSettings is true)
  const [tncSettings, setTncSettings] = useState<CountSettings>({
    squaresCounted: 9,
    dilutionFactor: 1,
  });

  const [showPrelim, setShowPrelim] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When toggling to separate settings, copy shared to both
  useEffect(() => {
    if (separateSettings) {
      setRbcSettings({ ...sharedSettings });
      setTncSettings({ ...sharedSettings });
    }
  }, [separateSettings]);

  // Load existing record if editing
  useEffect(() => {
    if (!id) return;

    async function loadRecord() {
      try {
        const token = await getToken();
        if (!token) return;

        const record = await api.get<HemocytometerRecord>(`/api/records/${id}`, token);
        setSpecimenId(record.specimenId);
        setSpecimenType(record.specimenType as SpecimenType);

        const data = record.data;
        setSide1({
          rbcCount: data.side1.rbcCount,
          tncCount: data.side1.tncCount,
          isDone: data.side1.isDone,
          mode: 'add',
        });
        setSide2({
          rbcCount: data.side2.rbcCount,
          tncCount: data.side2.tncCount,
          isDone: data.side2.isDone,
          mode: 'add',
        });

        setSeparateSettings(data.side1.separateSettings);
        setSharedSettings({
          squaresCounted: data.side1.squaresCounted,
          dilutionFactor: data.side1.dilutionFactor,
        });

        if (data.side1.separateSettings) {
          setRbcSettings({
            squaresCounted: data.side1.rbcSquaresCounted ?? data.side1.squaresCounted,
            dilutionFactor: data.side1.rbcDilution ?? data.side1.dilutionFactor,
          });
          setTncSettings({
            squaresCounted: data.side1.tncSquaresCounted ?? data.side1.squaresCounted,
            dilutionFactor: data.side1.tncDilution ?? data.side1.dilutionFactor,
          });
        }
      } catch (err) {
        console.error('Failed to load record:', err);
        setError('Failed to load record');
      }
    }

    loadRecord();
  }, [id, getToken]);

  // Get effective settings for RBC and TNC
  const getEffectiveSettings = useCallback(() => {
    if (separateSettings) {
      return {
        rbcSquares: rbcSettings.squaresCounted,
        rbcDilution: rbcSettings.dilutionFactor,
        tncSquares: tncSettings.squaresCounted,
        tncDilution: tncSettings.dilutionFactor,
      };
    }
    return {
      rbcSquares: sharedSettings.squaresCounted,
      rbcDilution: sharedSettings.dilutionFactor,
      tncSquares: sharedSettings.squaresCounted,
      tncDilution: sharedSettings.dilutionFactor,
    };
  }, [separateSettings, sharedSettings, rbcSettings, tncSettings]);

  // Calculate results
  const calculate = useCallback((): HemocytometerCalculations => {
    const { rbcSquares, rbcDilution, tncSquares, tncDilution } = getEffectiveSettings();

    // Calculate preliminary values for each side
    const side1Rbc = (side1.rbcCount * rbcDilution * 10) / rbcSquares;
    const side1Tnc = (side1.tncCount * tncDilution * 10) / tncSquares;
    const side2Rbc = (side2.rbcCount * rbcDilution * 10) / rbcSquares;
    const side2Tnc = (side2.tncCount * tncDilution * 10) / tncSquares;

    // Average the raw counts first, then calculate (matching original logic)
    const rbcAvg = (side1.rbcCount + side2.rbcCount) / 2;
    const tncAvg = (side1.tncCount + side2.tncCount) / 2;
    const averageRbc = (rbcAvg * rbcDilution * 10) / rbcSquares;
    const averageTnc = (tncAvg * tncDilution * 10) / tncSquares;

    const rbcWithinTolerance = isWithinTolerance(side1.rbcCount, side2.rbcCount);
    const tncWithinTolerance = isWithinTolerance(side1.tncCount, side2.tncCount);

    return {
      side1Rbc: Math.round(side1Rbc),
      side1Tnc: Math.round(side1Tnc),
      side2Rbc: Math.round(side2Rbc),
      side2Tnc: Math.round(side2Tnc),
      averageRbc,
      averageTnc,
      finalRbc: Math.round(averageRbc),
      finalTnc: Math.round(averageTnc),
      rbcWithinTolerance,
      tncWithinTolerance,
    };
  }, [side1, side2, getEffectiveSettings]);

  function isWithinTolerance(value1: number, value2: number): boolean {
    // Original logic: if either count < 10, use ±5 tolerance
    if (value1 < 10 || value2 < 10) {
      return Math.abs(value1 - value2) <= 5;
    }
    // Otherwise use ±20% tolerance
    const average = (value1 + value2) / 2;
    const percentDiff = (100 * Math.abs(value1 - value2)) / average;
    return percentDiff <= 20;
  }

  // Keyboard handler
  const handleKeyDown = useCallback(
    (side: 1 | 2) => (e: React.KeyboardEvent) => {
      const setSide = side === 1 ? setSide1 : setSide2;
      const currentSide = side === 1 ? side1 : side2;

      if (currentSide.isDone) return;

      if (e.key === '1') {
        e.preventDefault();
        setSide((prev) => ({
          ...prev,
          rbcCount:
            prev.mode === 'add'
              ? prev.rbcCount + 1
              : Math.max(0, prev.rbcCount - 1),
        }));
      } else if (e.key === '3') {
        e.preventDefault();
        setSide((prev) => ({
          ...prev,
          tncCount:
            prev.mode === 'add'
              ? prev.tncCount + 1
              : Math.max(0, prev.tncCount - 1),
        }));
      }
    },
    [side1.isDone, side2.isDone]
  );

  // Button click handlers
  const handleCountClick = (side: 1 | 2, type: 'rbc' | 'tnc') => {
    const setSide = side === 1 ? setSide1 : setSide2;
    const currentSide = side === 1 ? side1 : side2;

    if (currentSide.isDone) return;

    const countKey = type === 'rbc' ? 'rbcCount' : 'tncCount';
    setSide((prev) => ({
      ...prev,
      [countKey]:
        prev.mode === 'add'
          ? prev[countKey] + 1
          : Math.max(0, prev[countKey] - 1),
    }));
  };

  const handleReset = (side: 1 | 2) => {
    const setSide = side === 1 ? setSide1 : setSide2;
    setSide((prev) => ({ ...prev, rbcCount: 0, tncCount: 0 }));
  };

  const toggleMode = (side: 1 | 2) => {
    const setSide = side === 1 ? setSide1 : setSide2;
    setSide((prev) => ({
      ...prev,
      mode: prev.mode === 'add' ? 'subtract' : 'add',
    }));
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

      const { rbcSquares, rbcDilution, tncSquares, tncDilution } = getEffectiveSettings();

      const sideData = {
        squaresCounted: sharedSettings.squaresCounted,
        dilutionFactor: sharedSettings.dilutionFactor,
        separateSettings,
        ...(separateSettings && {
          rbcSquaresCounted: rbcSquares,
          rbcDilution: rbcDilution,
          tncSquaresCounted: tncSquares,
          tncDilution: tncDilution,
        }),
      };

      const data: HemocytometerData = {
        side1: {
          rbcCount: side1.rbcCount,
          tncCount: side1.tncCount,
          isDone: side1.isDone,
          ...sideData,
        },
        side2: {
          rbcCount: side2.rbcCount,
          tncCount: side2.tncCount,
          isDone: side2.isDone,
          ...sideData,
        },
      };

      let recordId = id;

      if (id) {
        // Update existing
        await api.patch(`/api/records/${id}`, { data }, token);
      } else {
        // Create new
        const record = await api.post<HemocytometerRecord>(
          '/api/records',
          {
            type: 'hemocytometer',
            specimenId: specimenId.trim(),
            specimenType,
            data,
          },
          token
        );
        recordId = record.id;
      }

      if (submit && recordId) {
        await api.post(`/api/records/${recordId}/submit`, {}, token);
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
  const bothDone = side1.isDone && side2.isDone;
  const canSubmit = bothDone && calculations.rbcWithinTolerance && calculations.tncWithinTolerance;
  const { rbcSquares, rbcDilution, tncSquares, tncDilution } = getEffectiveSettings();

  return (
    <div className="hemocytometer">
      <header className="counter-header">
        <h1>Hemocytometer Counter</h1>
        <p className="counter-description">
          Cell counter for tallying the amount of red blood cells and white blood cells in a body fluid.
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
            <label htmlFor="specimen-type">Specimen Type</label>
            <select
              id="specimen-type"
              value={specimenType}
              onChange={(e) => setSpecimenType(e.target.value as SpecimenType)}
            >
              {SPECIMEN_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {/* Final Results - shown at top when both sides done */}
      {bothDone && (
        <div className="results-section">
          <div className="final-results">
            <div className={`result ${calculations.rbcWithinTolerance ? 'valid' : 'invalid'}`}>
              <span className="label">Final RBC Count:</span>
              <span className="value">{calculations.finalRbc}</span>
            </div>
            <div className={`result ${calculations.tncWithinTolerance ? 'valid' : 'invalid'}`}>
              <span className="label">Final TNC Count:</span>
              <span className="value">{calculations.finalTnc}</span>
            </div>
          </div>

          {(!calculations.rbcWithinTolerance || !calculations.tncWithinTolerance) && (
            <p className="warning">
              {!calculations.rbcWithinTolerance && !calculations.tncWithinTolerance
                ? 'Counts are too far apart!'
                : !calculations.rbcWithinTolerance
                ? 'RBC counts are too far apart!'
                : 'TNC counts are too far apart!'}
            </p>
          )}
        </div>
      )}

      {/* Count Settings - shared by default */}
      <div className="settings-section">
        {!separateSettings ? (
          <div className="settings-group">
            <div className="settings-row">
              <div className="form-group">
                <label htmlFor="squares">Squares Counted:</label>
                <select
                  id="squares"
                  value={sharedSettings.squaresCounted}
                  onChange={(e) =>
                    setSharedSettings((prev) => ({
                      ...prev,
                      squaresCounted: parseFloat(e.target.value) as SquaresCounted,
                    }))
                  }
                >
                  {SQUARES_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="dilution">Dilution Factor:</label>
                <input
                  id="dilution"
                  type="number"
                  min="1"
                  max="200"
                  value={sharedSettings.dilutionFactor}
                  onChange={(e) =>
                    setSharedSettings((prev) => ({
                      ...prev,
                      dilutionFactor: parseInt(e.target.value) || 1,
                    }))
                  }
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="settings-group">
              <h3>RBC Settings:</h3>
              <div className="settings-row">
                <div className="form-group">
                  <label htmlFor="rbc-squares">Squares Counted:</label>
                  <select
                    id="rbc-squares"
                    value={rbcSettings.squaresCounted}
                    onChange={(e) =>
                      setRbcSettings((prev) => ({
                        ...prev,
                        squaresCounted: parseFloat(e.target.value) as SquaresCounted,
                      }))
                    }
                  >
                    {SQUARES_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="rbc-dilution">Dilution Factor:</label>
                  <input
                    id="rbc-dilution"
                    type="number"
                    min="1"
                    max="200"
                    value={rbcSettings.dilutionFactor}
                    onChange={(e) =>
                      setRbcSettings((prev) => ({
                        ...prev,
                        dilutionFactor: parseInt(e.target.value) || 1,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="settings-group">
              <h3>TNC Settings:</h3>
              <div className="settings-row">
                <div className="form-group">
                  <label htmlFor="tnc-squares">Squares Counted:</label>
                  <select
                    id="tnc-squares"
                    value={tncSettings.squaresCounted}
                    onChange={(e) =>
                      setTncSettings((prev) => ({
                        ...prev,
                        squaresCounted: parseFloat(e.target.value) as SquaresCounted,
                      }))
                    }
                  >
                    {SQUARES_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="tnc-dilution">Dilution Factor:</label>
                  <input
                    id="tnc-dilution"
                    type="number"
                    min="1"
                    max="200"
                    value={tncSettings.dilutionFactor}
                    onChange={(e) =>
                      setTncSettings((prev) => ({
                        ...prev,
                        dilutionFactor: parseInt(e.target.value) || 1,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <label className="checkbox-label separate-toggle">
          <input
            type="checkbox"
            checked={separateSettings}
            onChange={(e) => setSeparateSettings(e.target.checked)}
          />
          Click here to use separate dilutions and square counts for RBC and TNC
        </label>

        <label className="checkbox-label show-prelim">
          <input
            type="checkbox"
            checked={showPrelim}
            onChange={(e) => setShowPrelim(e.target.checked)}
          />
          Click here to show preliminary calculations
        </label>
      </div>

      <div className="sides-container">
        {/* Side 1 */}
        <div className={`side ${side1.isDone ? 'done' : ''}`}>
          <div className="side-header">
            <h2>Side 1</h2>
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
              className={`count-btn rbc ${!calculations.rbcWithinTolerance && bothDone ? 'error' : ''} ${calculations.rbcWithinTolerance && bothDone ? 'success' : ''}`}
              onClick={() => handleCountClick(1, 'rbc')}
              disabled={side1.isDone}
            >
              <span>RBC</span>
              <span className="count-value">{side1.rbcCount}</span>
            </button>
            <button
              className={`count-btn tnc ${!calculations.tncWithinTolerance && bothDone ? 'error' : ''} ${calculations.tncWithinTolerance && bothDone ? 'success' : ''}`}
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
              placeholder={side1.isDone ? 'Counter Disabled' : 'Click here to count'}
              onKeyDown={handleKeyDown(1)}
              disabled={side1.isDone}
              readOnly
            />
          </div>

          <div className="side-controls">
            <button
              className={`mode-btn ${side1.mode}`}
              onClick={() => toggleMode(1)}
              disabled={side1.isDone}
            >
              {side1.mode === 'add' ? 'Add' : 'Subtract'}
            </button>
            <button
              className="reset-btn"
              onClick={() => handleReset(1)}
              disabled={side1.isDone}
            >
              Reset
            </button>
          </div>

          {showPrelim && (
            <div className="prelim-calcs">
              <p>RBC Count: {calculations.side1Rbc}</p>
              <p>TNC Count: {calculations.side1Tnc}</p>
            </div>
          )}
        </div>

        {/* Side 2 */}
        <div className={`side ${side2.isDone ? 'done' : ''}`}>
          <div className="side-header">
            <h2>Side 2</h2>
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
              className={`count-btn rbc ${!calculations.rbcWithinTolerance && bothDone ? 'error' : ''} ${calculations.rbcWithinTolerance && bothDone ? 'success' : ''}`}
              onClick={() => handleCountClick(2, 'rbc')}
              disabled={side2.isDone}
            >
              <span>RBC</span>
              <span className="count-value">{side2.rbcCount}</span>
            </button>
            <button
              className={`count-btn tnc ${!calculations.tncWithinTolerance && bothDone ? 'error' : ''} ${calculations.tncWithinTolerance && bothDone ? 'success' : ''}`}
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
              placeholder={side2.isDone ? 'Counter Disabled' : 'Click here to count'}
              onKeyDown={handleKeyDown(2)}
              disabled={side2.isDone}
              readOnly
            />
          </div>

          <div className="side-controls">
            <button
              className={`mode-btn ${side2.mode}`}
              onClick={() => toggleMode(2)}
              disabled={side2.isDone}
            >
              {side2.mode === 'add' ? 'Add' : 'Subtract'}
            </button>
            <button
              className="reset-btn"
              onClick={() => handleReset(2)}
              disabled={side2.isDone}
            >
              Reset
            </button>
          </div>

          {showPrelim && (
            <div className="prelim-calcs">
              <p>RBC Count: {calculations.side2Rbc}</p>
              <p>TNC Count: {calculations.side2Tnc}</p>
            </div>
          )}
        </div>
      </div>

      {/* Show Your Work - formula display */}
      {bothDone && (
        <div className="formula-display">
          <div className="formula-row">
            <p>RBC Count = </p>
            <div className="fraction">
              <span className="numerator">(RBC Average) x (dilution) x 10</span>
              <span className="denominator">(# of Squares Counted)</span>
            </div>
            <p> = </p>
            <div className="fraction">
              <span className="numerator">({(side1.rbcCount + side2.rbcCount) / 2}) x ({rbcDilution}) x 10</span>
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
              <span className="numerator">({(side1.tncCount + side2.tncCount) / 2}) x ({tncDilution}) x 10</span>
              <span className="denominator">({tncSquares})</span>
            </div>
            <p> ≈ {calculations.finalTnc}</p>
          </div>
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
          title={!canSubmit ? 'Complete both sides with matching counts to submit' : ''}
        >
          Submit for Verification
        </button>
      </div>
    </div>
  );
}
