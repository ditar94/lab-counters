import type {
  CountRecordType,
  HemocytometerMethodParams,
  FetalMethodParams,
  ReticMethodParams,
  ParasiteMethodParams,
  MethodParamsByType,
} from './types';

/** Default hemocytometer method parameters */
export const HEMOCYTOMETER_DEFAULTS: HemocytometerMethodParams = {
  defaultDilution: 1,
  defaultSquaresCounted: 9,
  tolerancePercent: 20,
  lowCountTolerance: 5,
  lowCountThreshold: 10,
};

/** Default fetal (KB test) method parameters */
export const FETAL_DEFAULTS: FetalMethodParams = {};

/** Default reticulocyte method parameters */
export const RETIC_DEFAULTS: ReticMethodParams = {
  targetRbcCount: 1000,
};

/** Default parasite method parameters */
export const PARASITE_DEFAULTS: ParasiteMethodParams = {
  targetRbcCount: 1000,
};

/** All method defaults by counter type */
export const METHOD_DEFAULTS: MethodParamsByType = {
  hemocytometer: HEMOCYTOMETER_DEFAULTS,
  fetal: FETAL_DEFAULTS,
  retic: RETIC_DEFAULTS,
  parasite: PARASITE_DEFAULTS,
};

/**
 * Get default parameters for a counter type
 */
export function getDefaultParams<T extends CountRecordType>(
  counterType: T
): MethodParamsByType[T] {
  return METHOD_DEFAULTS[counterType];
}
