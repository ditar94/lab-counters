-- Add username column for login if missing
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT;

-- Ensure username uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
