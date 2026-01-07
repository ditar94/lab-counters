import type { CountRecordType, HemocytometerMethodParams, FetalMethodParams, ReticMethodParams, ParasiteMethodParams, MethodParamsByType } from './types';
/** Default hemocytometer method parameters */
export declare const HEMOCYTOMETER_DEFAULTS: HemocytometerMethodParams;
/** Default fetal (KB test) method parameters */
export declare const FETAL_DEFAULTS: FetalMethodParams;
/** Default reticulocyte method parameters */
export declare const RETIC_DEFAULTS: ReticMethodParams;
/** Default parasite method parameters */
export declare const PARASITE_DEFAULTS: ParasiteMethodParams;
/** All method defaults by counter type */
export declare const METHOD_DEFAULTS: MethodParamsByType;
/**
 * Get default parameters for a counter type
 */
export declare function getDefaultParams<T extends CountRecordType>(counterType: T): MethodParamsByType[T];
