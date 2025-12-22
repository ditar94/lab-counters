-- Drop legacy corrections table
DROP TABLE IF EXISTS "corrections";

-- Allow users to have no active site assigned
ALTER TABLE "users" ALTER COLUMN "site_id" DROP NOT NULL;

-- Update count_records columns for manual count records
ALTER TABLE "count_records" RENAME COLUMN "specimen_type" TO "fluid_type";
ALTER TABLE "count_records" RENAME COLUMN "data" TO "raw_tallies";
ALTER TABLE "count_records" RENAME COLUMN "created_by_id" TO "performed_by_id";

ALTER TABLE "count_records" ADD COLUMN IF NOT EXISTS "dilution" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "count_records" ADD COLUMN IF NOT EXISTS "squares_counted" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "count_records" ADD COLUMN IF NOT EXISTS "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "count_records" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "count_records" ADD COLUMN IF NOT EXISTS "parent_record_id" TEXT;
ALTER TABLE "count_records" ADD COLUMN IF NOT EXISTS "correction_reason" TEXT;

ALTER TABLE "count_records" DROP COLUMN IF EXISTS "is_immutable";

-- Adjust foreign keys for performed_by and parent_record_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'count_records_created_by_id_fkey'
  ) THEN
    ALTER TABLE "count_records" DROP CONSTRAINT "count_records_created_by_id_fkey";
  END IF;
END $$;

ALTER TABLE "count_records" DROP CONSTRAINT IF EXISTS "count_records_performed_by_id_fkey";
ALTER TABLE "count_records" ADD CONSTRAINT "count_records_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "count_records" DROP CONSTRAINT IF EXISTS "count_records_parent_record_id_fkey";
ALTER TABLE "count_records" ADD CONSTRAINT "count_records_parent_record_id_fkey" FOREIGN KEY ("parent_record_id") REFERENCES "count_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "count_records_org_id_site_id_status_created_at_idx" ON "count_records"("org_id", "site_id", "status", "created_at");

-- Replace audit_logs table to match AuditEvent shape
DROP INDEX IF EXISTS "audit_logs_org_id_table_name_record_id_idx";
DROP INDEX IF EXISTS "audit_logs_timestamp_idx";
DROP TABLE IF EXISTS "audit_logs";
DROP TYPE IF EXISTS "AuditAction";

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_org_id_entity_type_entity_id_idx" ON "audit_logs"("org_id", "entity_type", "entity_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
