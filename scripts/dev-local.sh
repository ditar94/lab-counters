#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f "packages/api/.env" ] && [ -f "packages/api/.env.example" ]; then
  cp packages/api/.env.example packages/api/.env
fi

if [ ! -f "packages/web/.env" ] && [ -f "packages/web/.env.example" ]; then
  cp packages/web/.env.example packages/web/.env
fi

docker-compose up -d

npm install
npm run db:generate
npm run db:migrate
npm run dev
