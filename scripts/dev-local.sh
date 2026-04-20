#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Copy env files if they don't exist (for apps/ structure)
if [ ! -f "apps/api/.env" ] && [ -f "apps/api/.env.example" ]; then
  cp apps/api/.env.example apps/api/.env
  echo "Created apps/api/.env from example"
fi

if [ ! -f "apps/web/.env.local" ] && [ -f "apps/web/.env.example" ]; then
  cp apps/web/.env.example apps/web/.env.local
  # Enable dev auth by default for local development
  echo "VITE_DEV_AUTH=true" >> apps/web/.env.local
  echo "Created apps/web/.env.local with VITE_DEV_AUTH=true"
fi

# Start Docker containers (PostgreSQL)
echo "Starting Docker containers..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until docker-compose exec -T db pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL is ready!"

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run migrations (will seed automatically if needed)
# NOTE: This uses 'prisma migrate dev' which may prompt to reset if schema changed
npm run db:migrate

echo ""
echo "=========================================="
echo "Development environment ready!"
echo ""
echo "TIP: For subsequent restarts, just use:"
echo "  npm run dev"
echo ""
echo "Only use 'npm run dev:local' when:"
echo "  - First time setup"
echo "  - After pulling schema changes"
echo "  - Need to reset the database"
echo "=========================================="
echo ""

npm run dev
