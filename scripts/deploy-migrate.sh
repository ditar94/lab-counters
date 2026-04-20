#!/usr/bin/env bash
#
# Production Migration Script
#
# This script safely applies database migrations to production.
# It uses 'prisma migrate deploy' which ONLY applies pending migrations
# and NEVER resets or destroys data.
#
# Usage: ./scripts/deploy-migrate.sh
#
# Prerequisites:
#   - DATABASE_URL must be set to production database
#   - NODE_ENV must be 'production'
#
set -euo pipefail

echo "=============================================="
echo "PRODUCTION DATABASE MIGRATION"
echo "=============================================="
echo ""

# Safety check: Ensure we're in production mode
if [ "${NODE_ENV:-}" != "production" ]; then
  echo "ERROR: NODE_ENV must be 'production' to run this script"
  echo "Current NODE_ENV: ${NODE_ENV:-not set}"
  exit 1
fi

# Safety check: Ensure DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL must be set"
  exit 1
fi

# Safety check: Warn if DATABASE_URL looks like localhost
if echo "$DATABASE_URL" | grep -q "localhost\|127.0.0.1"; then
  echo "ERROR: DATABASE_URL appears to point to localhost"
  echo "This script is for production deployments only"
  exit 1
fi

echo "Target database: [REDACTED FOR SECURITY]"
echo ""
echo "This will apply any pending migrations to production."
echo "Data will NOT be deleted or reset."
echo ""

# Generate Prisma client (in case of version updates)
echo "Generating Prisma client..."
npx prisma generate

# Show pending migrations
echo ""
echo "Checking migration status..."
npx prisma migrate status

echo ""
echo "Applying migrations with 'prisma migrate deploy'..."
echo "(This command ONLY applies migrations, it cannot reset data)"
echo ""

# Deploy migrations - this is the safe production command
npx prisma migrate deploy

echo ""
echo "=============================================="
echo "Migration complete!"
echo "=============================================="
echo ""
echo "Verifying migration status..."
npx prisma migrate status
