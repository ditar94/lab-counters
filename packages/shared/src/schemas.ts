import { z } from 'zod';

// ============================================
// Enums as Zod schemas
// ============================================

export const UserRoleSchema = z.enum(['superadmin', 'admin', 'supervisor', 'technologist', 'readonly']);
export const OrgUserRoleSchema = z.enum(['admin', 'supervisor', 'technologist', 'readonly']); // Roles that org admins can assign
export const UserStatusSchema = z.enum(['active', 'inactive', 'pending', 'archived']);
export const OrgStatusSchema = z.enum(['active', 'inactive', 'archived']);
export const SiteStatusSchema = z.enum(['active', 'inactive', 'archived']);
export const CountRecordTypeSchema = z.enum(['hemocytometer', 'fetal', 'retic', 'parasite']);
export const RecordStatusSchema = z.enum(['draft', 'pending_verification', 'verified', 'corrected']);
export const FluidTypeSchema = z.enum(['csf', 'synovial', 'pleural', 'peritoneal', 'pericardial', 'other']);

// ============================================
// Hemocytometer Schemas
// ============================================

const SquaresCountedSchema = z.union([z.literal(0.2), z.literal(4), z.literal(9)]);

export const HemocytometerSideDataSchema = z.object({
  rbcCount: z.number().min(0),
  tncCount: z.number().min(0),
  squaresCounted: SquaresCountedSchema,
  dilutionFactor: z.number().min(1).max(200),
  separateSettings: z.boolean(),
  // Separate RBC settings (when separateSettings is true)
  rbcSquaresCounted: SquaresCountedSchema.optional(),
  rbcDilution: z.number().min(1).max(200).optional(),
  // Separate TNC settings (when separateSettings is true)
  tncSquaresCounted: SquaresCountedSchema.optional(),
  tncDilution: z.number().min(1).max(200).optional(),
  isDone: z.boolean(),
});

export const HemocytometerDataSchema = z.object({
  side1: HemocytometerSideDataSchema,
  side2: HemocytometerSideDataSchema,
});

// ============================================
// Fetal Schemas
// ============================================

export const FetalDataSchema = z.object({
  fields: z.array(z.number().min(0)).length(5),
  fetalCellCount: z.number().min(0),
});

// ============================================
// Retic Schemas
// ============================================

export const ReticDataSchema = z.object({
  reticCount: z.number().min(0),
  rbcCount: z.number().min(0).max(1000),
});

// ============================================
// Parasite Schemas
// ============================================

export const ParasiteDataSchema = z.object({
  parasiteCount: z.number().min(0),
  rbcCount: z.number().min(0).max(1000),
});

// ============================================
// Combined Data Schema
// ============================================

export const CountRecordDataSchema = z.union([
  HemocytometerDataSchema,
  FetalDataSchema,
  ReticDataSchema,
  ParasiteDataSchema,
]);

// ============================================
// Request Schemas
// ============================================

export const CreateRecordRequestSchema = z.object({
  type: CountRecordTypeSchema,
  specimenId: z.string().min(1).max(100),
  fluidType: FluidTypeSchema,
  dilution: z.number().min(0.1).max(1000),
  squaresCounted: z.number().min(0.1).max(1000),
  isQC: z.boolean().optional().default(false), // QC samples auto-verify on submit
  rawTallies: CountRecordDataSchema,
});

export const UpdateRecordRequestSchema = z.object({
  rawTallies: CountRecordDataSchema.optional(),
  status: RecordStatusSchema.optional(),
});

export const VerifyRecordRequestSchema = z.object({
  comments: z.string().max(500).optional(),
});

export const CreateCorrectionRequestSchema = z.object({
  reason: z.string().min(1).max(500),
  rawTallies: CountRecordDataSchema,
});

export const ResetPasswordRequestSchema = z.object({
  temporaryPassword: z.string().min(8).max(50).optional(),
  generateTemporaryPassword: z.boolean().optional(),
});

// ============================================
// Query Schemas
// ============================================

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export const RecordFilterSchema = PaginationQuerySchema.extend({
  type: CountRecordTypeSchema.optional(),
  status: RecordStatusSchema.optional(),
  specimenId: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  performedBy: z.string().uuid().optional(),
  siteId: z.string().min(1).optional(),
  month: z.coerce.number().min(1).max(12).optional(),
  year: z.coerce.number().min(2000).max(2100).optional(),
});

// ============================================
// User Schemas
// ============================================

export const CreateUserRequestSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Username must be alphanumeric with underscores or hyphens').optional(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: OrgUserRoleSchema,
  siteId: z.string().min(1), // Primary/current site
  siteIds: z.array(z.string().min(1)).min(1).optional(), // All assigned sites (if not provided, uses siteId)
  temporaryPassword: z.string().min(8).max(50).optional(),
  generateTemporaryPassword: z.boolean().optional(),
});

export const UpdateUserRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: OrgUserRoleSchema.optional(),
  siteId: z.string().min(1).optional(), // Change current site
  siteIds: z.array(z.string().min(1)).min(1).optional(), // Update assigned sites
  status: UserStatusSchema.optional(),
});

// ============================================
// Organization Schemas (Superadmin)
// ============================================

export const OrganizationSettingsSchema = z.object({
  timezone: z.string().default('America/New_York'),
  defaultDilution: z.number().min(1).max(200).default(10),
  requireVerification: z.boolean().default(true),
  allowSelfVerification: z.boolean().default(false),
});

export const CreateOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  settings: OrganizationSettingsSchema.partial().optional(),
});

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  settings: OrganizationSettingsSchema.partial().optional(),
});

// ============================================
// Site Schemas (Superadmin)
// ============================================

export const SiteSettingsSchema = z.object({
  timezone: z.string().optional(),
});

export const CreateSiteSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().max(255).optional(),
  settings: SiteSettingsSchema.optional(),
});

export const UpdateSiteSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  location: z.string().max(255).optional(),
  settings: SiteSettingsSchema.optional(),
});

// ============================================
// Org Admin User Creation Schema
// ============================================

export const CreateOrgAdminSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Username must be alphanumeric with underscores or hyphens').optional(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  siteId: z.string().min(1),
  siteIds: z.array(z.string().min(1)).min(1).optional(),
  temporaryPassword: z.string().min(8).max(50).optional(),
  generateTemporaryPassword: z.boolean().optional(),
});
