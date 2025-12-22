-- Add OrgStatus enum if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrgStatus') THEN
    CREATE TYPE "OrgStatus" AS ENUM ('active', 'inactive', 'archived');
  END IF;
END $$;

-- Add SiteStatus enum if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SiteStatus') THEN
    CREATE TYPE "SiteStatus" AS ENUM ('active', 'inactive', 'archived');
  END IF;
END $$;

-- Extend UserStatus enum with archived if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'UserStatus' AND e.enumlabel = 'archived'
  ) THEN
    ALTER TYPE "UserStatus" ADD VALUE 'archived';
  END IF;
END $$;

-- Organizations status + archived_at
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "status" "OrgStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);
ALTER TABLE "organizations" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- Sites status + archived_at
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "status" "SiteStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);
ALTER TABLE "sites" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- Users archived_at
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- Ensure unique slug index exists
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_key" ON "organizations"("slug");
