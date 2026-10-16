#!/bin/sh
# Update the live server to the latest code. Run on the server from the deploy folder:  sh update.sh
# 1. takes a backup first  2. rebuilds  3. applies database changes (stops if one could lose data)  4. restarts
set -e
cd "$(dirname "$0")"
COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"
mkdir -p backups
echo "Backing up the database first..."
$COMPOSE up -d postgres
$COMPOSE exec -T postgres sh -c 'pg_dump -U wholesale -d wholesale_management -Fc' > "backups/before-update_$(date +%Y-%m-%d_%H%M).dump"
git -C .. pull --ff-only
$COMPOSE build
echo "Applying database changes..."
$COMPOSE run --rm --no-deps -w /app api npx prisma db push --schema database/prisma/schema.prisma
$COMPOSE up -d
echo "Done. Open your address and sign in."
