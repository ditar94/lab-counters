import type {
  CountRecordType,
  HemocytometerMethodParams,
  FetalMethodParams,
  ReticMethodParams,
  ParasiteMethodParams,
  MethodParamsByType,
  MethodConfigByType,
  MethodIdByType,
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
export const FETAL_DEFAULTS: FetalMethodParams = {
  rbcFieldsCount: 5,
  fetalFieldsCount: 30,
};

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

/** Default method IDs by counter type */
export const METHOD_IDS: MethodIdByType = {
  hemocytometer: 'standard_v1',
  fetal: 'kb_fields_v1',
  retic: 'standard_v1',
  parasite: 'standard_v1',
};

/** Default method configs by counter type */
export const METHOD_CONFIG_DEFAULTS: MethodConfigByType = {
  hemocytometer: { method: METHOD_IDS.hemocytometer, params: HEMOCYTOMETER_DEFAULTS },
  fetal: { method: METHOD_IDS.fetal, params: FETAL_DEFAULTS },
  retic: { method: METHOD_IDS.retic, params: RETIC_DEFAULTS },
  parasite: { method: METHOD_IDS.parasite, params: PARASITE_DEFAULTS },
};

/**
 * Get default parameters for a counter type
 */
export function getDefaultParams<T extends CountRecordType>(
  counterType: T
): MethodParamsByType[T] {
  return METHOD_DEFAULTS[counterType];
}

/**
 * Get default method config for a counter type
 */
export function getDefaultMethodConfig<T extends CountRecordType>(
  counterType: T
): MethodConfigByType[T] {
  return METHOD_CONFIG_DEFAULTS[counterType];
}
