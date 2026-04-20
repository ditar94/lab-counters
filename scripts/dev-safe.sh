#!/usr/bin/env bash
#
# Safe Development Startup (preserves data)
#
# Use this script when you want to apply schema changes WITHOUT losing data.
# It uses 'prisma db push' which updates the schema in place.
#
# NOTE: This doesn't create migration files. When you're happy with your
# schema changes, run 'npm run db:migrate' to create the migration file
# for production.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=============================================="
echo "SAFE DEV MODE (data preserving)"
echo "=============================================="
echo ""

# Ensure Docker is running
if ! docker-compose ps db | grep -q "Up"; then
  echo "Starting Docker containers..."
  docker-compose up -d

  echo "Waiting for PostgreSQL..."
  until docker-compose exec -T db pg_isready -U postgres > /dev/null 2>&1; do
    sleep 1
  done
  echo "PostgreSQL ready!"
fi

# Generate Prisma client if schema changed
echo "Generating Prisma client..."
npm run db:generate

# Use db push instead of migrate - this preserves data when possible
echo ""
echo "Applying schema changes with 'prisma db push'..."
echo "(This preserves existing data when possible)"
echo ""
npx --workspace=@lab-counters/api prisma db push

echo ""
echo "=============================================="
echo "Starting dev servers..."
echo "=============================================="
echo ""
echo "Your existing data has been preserved!"
echo ""

npm run dev
