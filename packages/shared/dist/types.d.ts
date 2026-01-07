export type UserRole = 'superadmin' | 'admin' | 'supervisor' | 'technologist' | 'readonly';
export type UserStatus = 'active' | 'inactive' | 'pending' | 'archived';
export type OrgStatus = 'active' | 'inactive' | 'archived';
export type SiteStatus = 'active' | 'inactive' | 'archived';
export type CountRecordType = 'hemocytometer' | 'fetal' | 'retic' | 'parasite';
export type RecordStatus = 'draft' | 'pending_verification' | 'verified' | 'corrected';
export type FluidType = 'csf' | 'synovial' | 'pleural' | 'peritoneal' | 'pericardial' | 'other';
export type SpecimenType = FluidType;
export interface Organization {
    id: string;
    name: string;
    slug: string;
    status: OrgStatus;
    settings: OrganizationSettings;
    createdAt: Date;
    updatedAt: Date;
    archivedAt?: Date;
}
export interface OrganizationSettings {
    timezone: string;
    defaultDilution: number;
    requireVerification: boolean;
    allowSelfVerification: boolean;
}
export interface Site {
    id: string;
    orgId: string;
    name: string;
    location: string;
    status: SiteStatus;
    settings: SiteSettings;
    createdAt: Date;
    updatedAt: Date;
    archivedAt?: Date;
}
export interface SiteSettings {
    timezone?: string;
}
export interface User {
    id: string;
    cognitoId: string;
    email: string;
    name: string;
    orgId: string;
    siteId?: string;
    role: UserRole;
    status: UserStatus;
    createdAt: Date;
    updatedAt: Date;
    archivedAt?: Date;
}
export interface UserSite {
    id: string;
    userId: string;
    siteId: string;
    site: Site;
}
export interface UserWithOrg extends User {
    organization: Organization;
    site?: Site;
    sites?: UserSite[];
}
export interface ManualCountRecordBase {
    id: string;
    orgId: string;
    siteId: string;
    type: CountRecordType;
    specimenId: string;
    fluidType: FluidType;
    dilution: number;
    squaresCounted: number;
    isQC: boolean;
    status: RecordStatus;
    rawTallies: Record<string, unknown>;
    calculations: Record<string, unknown>;
    performedById: string;
    performedAt: Date;
    verifiedById?: string;
    verifiedAt?: Date;
    version: number;
    parentRecordId?: string;
    correctionReason?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface HemocytometerSideData {
    rbcCount: number;
    tncCount: number;
    squaresCounted: 0.2 | 4 | 9;
    dilutionFactor: number;
    separateSettings: boolean;
    rbcSquaresCounted?: 0.2 | 4 | 9;
    rbcDilution?: number;
    tncSquaresCounted?: 0.2 | 4 | 9;
    tncDilution?: number;
    isDone: boolean;
}
export interface HemocytometerData {
    side1: HemocytometerSideData;
    side2: HemocytometerSideData;
}
export interface HemocytometerCalculations {
    side1Rbc: number;
    side1Tnc: number;
    side2Rbc: number;
    side2Tnc: number;
    averageRbc: number;
    averageTnc: number;
    finalRbc: number;
    finalTnc: number;
    rbcWithinTolerance: boolean;
    tncWithinTolerance: boolean;
}
export interface HemocytometerRecord extends Omit<ManualCountRecordBase, 'rawTallies' | 'calculations' | 'type'> {
    type: 'hemocytometer';
    rawTallies: HemocytometerData;
    calculations: HemocytometerCalculations;
}
export interface FetalData {
    fields: number[];
    fetalCellCount: number;
}
export interface FetalCalculations {
    totalRbcIn5Fields: number;
    averageRbcPerField: number;
    rbcIn30Fields: number;
    percentFetal: number;
}
export interface FetalRecord extends Omit<ManualCountRecordBase, 'rawTallies' | 'calculations' | 'type'> {
    type: 'fetal';
    rawTallies: FetalData;
    calculations: FetalCalculations;
}
export interface ReticData {
    reticCount: number;
    rbcCount: number;
}
export interface ReticCalculations {
    percentRetic: number;
}
export interface ReticRecord extends Omit<ManualCountRecordBase, 'rawTallies' | 'calculations' | 'type'> {
    type: 'retic';
    rawTallies: ReticData;
    calculations: ReticCalculations;
}
export interface ParasiteData {
    parasiteCount: number;
    rbcCount: number;
}
export interface ParasiteCalculations {
    percentParasitemia: number;
}
export interface ParasiteRecord extends Omit<ManualCountRecordBase, 'rawTallies' | 'calculations' | 'type'> {
    type: 'parasite';
    rawTallies: ParasiteData;
    calculations: ParasiteCalculations;
}
export type ManualCountRecord = HemocytometerRecord | FetalRecord | ReticRecord | ParasiteRecord;
export interface AuditEvent {
    id: string;
    orgId: string;
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
    createdAt: Date;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, string[]>;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
/** Current method version - increment when formula/logic changes */
export declare const CURRENT_METHOD_VERSION = "1.0.0";
/** Hemocytometer method parameters */
export interface HemocytometerMethodParams {
    /** Default dilution factor (1-200) */
    defaultDilution: number;
    /** Default squares counted option */
    defaultSquaresCounted: 0.2 | 4 | 9;
    /** Tolerance percent for QC check (when count >= lowCountThreshold) */
    tolerancePercent: number;
    /** Absolute tolerance for low counts (when count < lowCountThreshold) */
    lowCountTolerance: number;
    /** Threshold below which lowCountTolerance applies */
    lowCountThreshold: number;
}
/** Fetal (KB Test) method parameters - placeholder for future */
export interface FetalMethodParams {
}
/** Reticulocyte method parameters */
export interface ReticMethodParams {
    /** Target RBC count to reach */
    targetRbcCount: number;
}
/** Parasite method parameters */
export interface ParasiteMethodParams {
    /** Target RBC count to reach */
    targetRbcCount: number;
}
/** Union type of all method params */
export type MethodParams = HemocytometerMethodParams | FetalMethodParams | ReticMethodParams | ParasiteMethodParams;
/** Map counter type to its params type */
export interface MethodParamsByType {
    hemocytometer: HemocytometerMethodParams;
    fetal: FetalMethodParams;
    retic: ReticMethodParams;
    parasite: ParasiteMethodParams;
}
/** Params snapshot stored on each record for historical accuracy */
export interface ParamsSnapshot {
    /** Method version used at count time */
    methodVersion: string;
    /** Counter-specific params that were applied */
    params: MethodParams;
    /** Source of params: 'org' | 'system_default' */
    source: 'org' | 'system_default';
    /** Org config version if source is 'org' */
    orgConfigVersion?: number;
}
/** Org method config record */
export interface OrgMethodConfig {
    id: string;
    orgId: string;
    counterType: CountRecordType;
    config: MethodParams;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateRecordRequest {
    type: CountRecordType;
    specimenId: string;
    fluidType: FluidType;
    dilution: number;
    squaresCounted: number;
    rawTallies: ManualCountRecord['rawTallies'];
}
export interface UpdateRecordRequest {
    rawTallies?: ManualCountRecord['rawTallies'];
    status?: RecordStatus;
}
export interface VerifyRecordRequest {
    comments?: string;
}
export interface CreateCorrectionRequest {
    reason: string;
    rawTallies: ManualCountRecord['rawTallies'];
}
export interface ResetPasswordRequest {
    temporaryPassword?: string;
    generateTemporaryPassword?: boolean;
}
export interface CreateUserRequest {
    username?: string;
    email: string;
    name: string;
    role: UserRole;
    siteId: string;
    siteIds?: string[];
    temporaryPassword?: string;
    generateTemporaryPassword?: boolean;
}
