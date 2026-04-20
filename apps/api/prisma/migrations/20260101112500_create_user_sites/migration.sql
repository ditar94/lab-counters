-- Create user_sites join table if missing
CREATE TABLE IF NOT EXISTS "user_sites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_sites_pkey" PRIMARY KEY ("id")
);

-- Ensure unique assignments
CREATE UNIQUE INDEX IF NOT EXISTS "user_sites_user_id_site_id_key" ON "user_sites"("user_id", "site_id");

-- Add foreign key constraints (skip if already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_sites_user_id_fkey'
  ) THEN
    ALTER TABLE "user_sites" ADD CONSTRAINT "user_sites_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_sites_site_id_fkey'
  ) THEN
    ALTER TABLE "user_sites" ADD CONSTRAINT "user_sites_site_id_fkey"
      FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
