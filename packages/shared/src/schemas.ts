import { z } from 'zod';

// ============================================
// Enums as Zod schemas
// ============================================

export const UserRoleSchema = z.enum(['admin', 'supervisor', 'technologist', 'readonly']);
export const UserStatusSchema = z.enum(['active', 'inactive', 'pending']);
export const CountRecordTypeSchema = z.enum(['hemocytometer', 'fetal', 'retic', 'parasite']);
export const RecordStatusSchema = z.enum(['draft', 'pending_verification', 'verified', 'corrected']);
export const SpecimenTypeSchema = z.enum(['csf', 'synovial', 'pleural', 'peritoneal', 'pericardial', 'other']);

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
  specimenType: SpecimenTypeSchema,
  data: CountRecordDataSchema,
});

export const UpdateRecordRequestSchema = z.object({
  data: CountRecordDataSchema.optional(),
  status: RecordStatusSchema.optional(),
});

export const VerifyRecordRequestSchema = z.object({
  comments: z.string().max(500).optional(),
});

export const CreateCorrectionRequestSchema = z.object({
  reason: z.string().min(1).max(500),
  data: CountRecordDataSchema,
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
  createdBy: z.string().uuid().optional(),
});

// ============================================
// User Schemas
// ============================================

export const CreateUserRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: UserRoleSchema,
  siteId: z.string().uuid(),
});

export const UpdateUserRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: UserRoleSchema.optional(),
  siteId: z.string().uuid().optional(),
  status: UserStatusSchema.optional(),
});
