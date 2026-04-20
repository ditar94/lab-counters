import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';
import type { FetalData, FetalCalculations, FetalRecord, MethodConfigByType } from '@lab-counters/shared';
import './Counter.css';

export function Fetal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getToken, user } = useAuth();

  // Specimen info
  const [specimenId, setSpecimenId] = useState('');
  const [isQC, setIsQC] = useState(false);

  // Fields for RBC counts (configurable)
  const [fields, setFields] = useState<number[]>([0, 0, 0, 0, 0]);

  // Fetal cell count (in configured fields)
  const [fetalCellCount, setFetalCellCount] = useState(0);
  const [fetalFieldsDone, setFetalFieldsDone] = useState(0);

  // Current active field for counting (1-N)
  const [activeField, setActiveField] = useState(1);
  const [mode, setMode] = useState<'add' | 'subtract'>('add');

  // Use counter vs manual input
  const [useCounter, setUseCounter] = useState(true);
  const [activeStep, setActiveStep] = useState<1 | 2>(1);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [performerAttestationChecked, setPerformerAttestationChecked] = useState(false);
  const [methodConfig, setMethodConfig] = useState<MethodConfigByType['fetal'] | null>(null);

  // Load method config (org defaults)
  useEffect(() => {
    async function loadMethodConfig() {
      try {
        const token = await getToken();
        if (!token) return;
        const configData = await api.get<{ config: MethodConfigByType['fetal'] }>(
          '/api/method-config/fetal',
          token
        );
        setMethodConfig(configData.config);
      } catch (err) {
        console.error('Failed to load method config:', err);
      }
    }

    loadMethodConfig();
  }, [getToken]);

  // Load existing record if editing
  useEffect(() => {
    if (!id) return;

    async function loadRecord() {
      try {
        const token = await getToken();
        if (!token) return;

        const record = await api.get<FetalRecord>(`/api/records/${id}`, token);
        setSpecimenId(record.specimenId);
        setFields(record.rawTallies.fields);
        setFetalCellCount(record.rawTallies.fetalCellCount);
        setFetalFieldsDone(record.rawTallies.fetalFieldsCounted ?? 0);
      } catch (err) {
        console.error('Failed to load record:', err);
        setError('Failed to load record');
      }
    }

    loadRecord();
  }, [id, getToken]);

  // Apply default field count for new records
  useEffect(() => {
    if (id || !methodConfig) return;
    const count = methodConfig.params.rbcFieldsCount;
    setFields(Array.from({ length: count }, () => 0));
    setActiveField(1);
  }, [id, methodConfig]);

  useEffect(() => {
    if (!methodConfig) return;
    setFetalFieldsDone((prev) => Math.min(prev, methodConfig.params.fetalFieldsCount));
  }, [methodConfig]);

  // Calculate results using configured field counts
  const calculate = useCallback((): FetalCalculations => {
    const rbcFieldsCount = (methodConfig?.params.rbcFieldsCount ?? fields.length) || 1;
    const fetalFieldsCount = methodConfig?.params.fetalFieldsCount ?? 30;
    const totalRbcIn5Fields = fields.reduce((sum, f) => sum + f, 0);
    const averageRbcPerField = totalRbcIn5Fields / rbcFieldsCount;
    const rbcIn30Fields = Math.round(averageRbcPerField * fetalFieldsCount);
    const percentFetal = rbcIn30Fields > 0 ? (fetalCellCount / rbcIn30Fields) * 100 : 0;

    return {
      totalRbcIn5Fields,
      averageRbcPerField: parseFloat(averageRbcPerField.toFixed(1)),
      rbcIn30Fields,
      percentFetal: parseFloat(percentFetal.toFixed(1)),
    };
  }, [fields, fetalCellCount, methodConfig]);

  const rbcFieldsCount = (methodConfig?.params.rbcFieldsCount ?? fields.length) || 1;
  const fetalFieldsCount = methodConfig?.params.fetalFieldsCount ?? 30;

  // Keyboard handler for RBC counting in active field
  const handleKeyDown = useCallback(
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

  // Keyboard handler for fetal cell counting
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
      if (e.key === '3') {
        e.preventDefault();
        if (mode === 'add') {
          setFetalFieldsDone((prev) => Math.min(fetalFieldsCount, prev + 1));
        } else if (fetalFieldsDone > 0) {
          setFetalFieldsDone((prev) => prev - 1);
        }
      }
    },
    [mode, fetalCellCount, fetalFieldsDone, fetalFieldsCount]
  );

  // Update field value (manual input)
  const handleFieldChange = (index: number, value: string) => {
    const numValue = parseInt(value) || 0;
    setFields((prev) => {
      const newFields = [...prev];
      newFields[index] = Math.max(0, numValue);
      return newFields;
    });
  };

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

  const handleFieldCountClick = () => {
    if (mode === 'add') {
      setFetalFieldsDone((prev) => Math.min(fetalFieldsCount, prev + 1));
    } else if (fetalFieldsDone > 0) {
      setFetalFieldsDone((prev) => prev - 1);
    }
  };

  const handleResetField = (index: number) => {
    setFields((prev) => {
      const newFields = [...prev];
      newFields[index] = 0;
      return newFields;
    });
  };

  const handleResetFetal = () => {
    setFetalCellCount(0);
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

      const rawTallies: FetalData = {
        fields,
        fetalCellCount,
        fetalFieldsCounted: fetalFieldsDone,
      };

      let recordId = id;

      if (id) {
        await api.patch(`/api/records/${id}`, { rawTallies }, token);
      } else {
        const record = await api.post<FetalRecord>(
          '/api/records',
          {
            type: 'fetal',
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
  const hasRbcCounts = calculations.totalRbcIn5Fields > 0;
  const hasAllFetalFields = fetalFieldsDone >= fetalFieldsCount;
  const canSubmit = hasRbcCounts && hasAllFetalFields && (isQC || performerAttestationChecked);

  return (
    <div className="counter-page fetal-counter">
      <header className="counter-header compact">
        <div className="title-row">
          <h1>Fetal Cell Counter (KB Test)</h1>
          <p className="counter-description">
            Kleihauer-Betke test for detecting fetal hemoglobin in maternal blood.
          </p>
        </div>
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
  <span>
    QC Sample <small>(no verification required)</small>
  </span>
</label>
          </div>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {/* Results */}
      <div className="results-section">
        <div className="result-display">
          <span className="label">Fetal Cells:</span>
          <span className="value">{calculations.percentFetal}%</span>
        </div>
      </div>

      <div className="stepper-card">
        <div className="stepper-header">
          <div>
            <span className="step-pill">Step {activeStep} of 2</span>
            <h3>
              {activeStep === 1
                ? `Count RBCs in ${rbcFieldsCount} Fields`
                : `Count Fetal Cells in ${fetalFieldsCount} Fields`}
            </h3>
          </div>
          <div className="stepper-actions">
            <button
              className="btn secondary small"
              onClick={() => setActiveStep(1)}
              disabled={activeStep === 1}
            >
              Back
            </button>
            <button
              className="btn primary small"
              onClick={() => setActiveStep(2)}
              disabled={activeStep === 2}
            >
              Next
            </button>
          </div>
        </div>

        <div className="stepper-progress">
          <span className={`step-dot ${activeStep === 1 ? 'active' : ''}`}>1</span>
          <span className="step-line" />
          <span className={`step-dot ${activeStep === 2 ? 'active' : ''}`}>2</span>
        </div>

        <div className="stepper-metrics">
          <div className="metric">
            <span className="label">Total ({rbcFieldsCount})</span>
            <span className="value">{calculations.totalRbcIn5Fields}</span>
          </div>
          <div className="metric">
            <span className="label">Avg / Field</span>
            <span className="value">{calculations.averageRbcPerField}</span>
          </div>
          <div className="metric">
            <span className="label">Est. RBCs ({fetalFieldsCount})</span>
            <span className="value">{calculations.rbcIn30Fields}</span>
          </div>
        </div>

        <div className="stepper-body">
          {activeStep === 1 ? (
            <div className="fields-section">
              <div className="input-mode-toggle">
                <label>
                  <input
                    type="radio"
                    checked={useCounter}
                    onChange={() => setUseCounter(true)}
                  />
                  Use Counter
                </label>
                <label>
                  <input
                    type="radio"
                    checked={!useCounter}
                    onChange={() => setUseCounter(false)}
                  />
                  Manual Input
                </label>
              </div>

              {!useCounter ? (
                <div className="fields-grid">
                  {fields.map((value, index) => (
                    <div key={index} className="field-input">
                      <label>Field {index + 1}</label>
                      <input
                        type="number"
                        min="0"
                        value={value}
                        onChange={(e) => handleFieldChange(index, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="counter-section">
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
                      onKeyDown={handleKeyDown}
                      readOnly
                    />
                  </div>

                  <div className="counter-controls">
                    <button className={`mode-btn ${mode}`} onClick={toggleMode}>
                      {mode === 'add' ? 'Add' : 'Subtract'}
                    </button>
                    <button className="reset-btn" onClick={() => handleResetField(activeField - 1)}>
                      Reset Field {activeField}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="fetal-count-section">
              <div className="count-buttons two-button">
                <button className="count-btn parasite" onClick={handleFetalClick}>
                  <span>Fetal Cells</span>
                  <span className="count-value">{fetalCellCount}</span>
                  <span className="hint">Press 1</span>
                </button>
                <button className="count-btn field" onClick={handleFieldCountClick}>
                  <span>Fields Counted</span>
                  <span className="count-value">{fetalFieldsDone} / {fetalFieldsCount}</span>
                  <span className="hint">Press 3</span>
                </button>
              </div>

              <div className="counter-input">
                <input
                  type="text"
                  placeholder="Click here then press 1 (cells) or 3 (fields)"
                  onKeyDown={handleFetalKeyDown}
                  readOnly
                />
              </div>

              <div className="counter-controls">
                <button className={`mode-btn ${mode}`} onClick={toggleMode}>
                  {mode === 'add' ? 'Add' : 'Subtract'}
                </button>
                <button className="reset-btn" onClick={handleResetFetal}>
                  Reset Fetal Count
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Formula Display */}
      {calculations.rbcIn30Fields > 0 && (
        <div className="formula-display">
          <div className="formula-row">
            <p>Fetal % = </p>
            <div className="fraction">
              <span className="numerator">Fetal Cells</span>
              <span className="denominator">RBCs in {fetalFieldsCount} Fields</span>
            </div>
            <p> × 100 = </p>
            <div className="fraction">
              <span className="numerator">{fetalCellCount}</span>
              <span className="denominator">{calculations.rbcIn30Fields}</span>
            </div>
            <p> × 100 = {calculations.percentFetal}%</p>
          </div>
        </div>
      )}

      {/* Performer Attestation */}
      {!isQC && calculations.totalRbcIn5Fields > 0 && (
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
          title={
            !canSubmit
              ? !hasRbcCounts
                ? 'Count RBCs in at least one field to submit'
                : !hasAllFetalFields
                  ? `Count fetal cells across all ${fetalFieldsCount} fields before submitting`
                  : 'Complete the attestation to submit'
              : ''
          }
        >
          {isQC ? 'Submit' : 'Submit for Verification'}
        </button>
      </div>
    </div>
  );
}
