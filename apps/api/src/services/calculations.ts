import type {
  CountRecordType,
  HemocytometerData,
  HemocytometerCalculations,
  HemocytometerMethodParams,
  FetalData,
  FetalCalculations,
  FetalMethodParams,
  ReticData,
  ReticCalculations,
  ParasiteData,
  ParasiteCalculations,
  MethodConfigByType,
} from '@lab-counters/shared';
import { getDefaultMethodConfig } from '@lab-counters/shared';

/**
 * Calculate results based on counter type and data
 */
export function calculateResults<T extends CountRecordType>(
  type: T,
  data: unknown,
  methodConfig?: MethodConfigByType[T]
): unknown {
  const config = methodConfig ?? getDefaultMethodConfig(type);

  switch (type) {
    case 'hemocytometer':
      return calculateHemocytometer(data as HemocytometerData, config.params as HemocytometerMethodParams);
    case 'fetal':
      return calculateFetal(data as FetalData, config.params as FetalMethodParams);
    case 'retic':
      return calculateRetic(data as ReticData);
    case 'parasite':
      return calculateParasite(data as ParasiteData);
    default:
      throw new Error(`Unknown counter type: ${type}`);
  }
}

/**
 * Hemocytometer formula: (Count × Dilution × 10) / Squares
 * QC: Counts between sides must match within tolerance
 *
 * Original logic from main branch:
 * - Default: shared squares and dilution apply to both RBC and TNC
 * - When separateSettings is true: use rbcSquaresCounted/rbcDilution for RBC,
 *   and tncSquaresCounted/tncDilution for TNC
 */
function calculateHemocytometer(
  data: HemocytometerData,
  params: HemocytometerMethodParams
): HemocytometerCalculations {
  const { side1, side2 } = data;

  // Get effective settings - same for both sides (settings are shared across sides)
  const rbcSquares = side1.separateSettings
    ? (side1.rbcSquaresCounted ?? side1.squaresCounted)
    : side1.squaresCounted;
  const rbcDilution = side1.separateSettings
    ? (side1.rbcDilution ?? side1.dilutionFactor)
    : side1.dilutionFactor;
  const tncSquares = side1.separateSettings
    ? (side1.tncSquaresCounted ?? side1.squaresCounted)
    : side1.squaresCounted;
  const tncDilution = side1.separateSettings
    ? (side1.tncDilution ?? side1.dilutionFactor)
    : side1.dilutionFactor;

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

  // Round to whole numbers for final values
  const finalRbc = Math.round(averageRbc);
  const finalTnc = Math.round(averageTnc);

  // QC tolerance check on raw counts (matching original logic)
  // ±5 if either count < 10, otherwise ±20%
  const rbcWithinTolerance = isWithinTolerance(side1.rbcCount, side2.rbcCount, params);
  const tncWithinTolerance = isWithinTolerance(side1.tncCount, side2.tncCount, params);

  return {
    side1Rbc: Math.round(side1Rbc),
    side1Tnc: Math.round(side1Tnc),
    side2Rbc: Math.round(side2Rbc),
    side2Tnc: Math.round(side2Tnc),
    averageRbc,
    averageTnc,
    finalRbc,
    finalTnc,
    rbcWithinTolerance,
    tncWithinTolerance,
  };
}

function isWithinTolerance(
  value1: number,
  value2: number,
  params: HemocytometerMethodParams
): boolean {
  // Use configured low-count tolerance
  if (value1 < params.lowCountThreshold || value2 < params.lowCountThreshold) {
    return Math.abs(value1 - value2) <= params.lowCountTolerance;
  }
  // Otherwise use percent tolerance
  const average = (value1 + value2) / 2;
  const percentDiff = (100 * Math.abs(value1 - value2)) / average;
  return percentDiff <= params.tolerancePercent;
}

/**
 * Fetal (KB Test) calculations
 * Count RBCs in 5 fields, then count fetal cells in 30 fields
 * Percentage = (fetal cells / RBCs in 30 fields) × 100
 */
function calculateFetal(
  data: FetalData,
  params: FetalMethodParams
): FetalCalculations {
  const { fields, fetalCellCount } = data;

  const rbcFieldsCount = params.rbcFieldsCount || fields.length || 1;
  const fetalFieldsCount = params.fetalFieldsCount || 1;
  const totalRbcIn5Fields = fields.reduce((sum, count) => sum + count, 0);
  const averageRbcPerField = totalRbcIn5Fields / rbcFieldsCount;
  const rbcIn30Fields = averageRbcPerField * fetalFieldsCount;
  const percentFetal = rbcIn30Fields > 0
    ? (fetalCellCount / rbcIn30Fields) * 100
    : 0;

  return {
    totalRbcIn5Fields,
    averageRbcPerField,
    rbcIn30Fields,
    percentFetal: Math.round(percentFetal * 100) / 100, // 2 decimal places
  };
}

/**
 * Reticulocyte percentage
 * Percentage = (retic count / total RBC count) × 100
 */
function calculateRetic(data: ReticData): ReticCalculations {
  const { reticCount, rbcCount } = data;

  const percentRetic = rbcCount > 0
    ? (reticCount / rbcCount) * 100
    : 0;

  return {
    percentRetic: Math.round(percentRetic * 100) / 100, // 2 decimal places
  };
}

/**
 * Parasitemia percentage
 * Percentage = (parasite count / total RBC count) × 100
 */
function calculateParasite(data: ParasiteData): ParasiteCalculations {
  const { parasiteCount, rbcCount } = data;

  const percentParasitemia = rbcCount > 0
    ? (parasiteCount / rbcCount) * 100
    : 0;

  return {
    percentParasitemia: Math.round(percentParasitemia * 100) / 100, // 2 decimal places
  };
}
