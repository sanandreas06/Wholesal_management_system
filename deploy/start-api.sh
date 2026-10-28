#!/bin/sh
# Starts the API on Render (or any Docker host).
# First it brings the database up to date with the code (prisma db push), so a new release never meets an old database.
# db push refuses anything that would delete data; in that case the server still starts and the log says what to do.
# Set AUTO_DB_PUSH=off to skip this step. If DIRECT_DATABASE_URL is set (Neon's non-pooled link), the update uses it.
cd /app
if [ "${AUTO_DB_PUSH:-on}" != "off" ] && [ -n "$DATABASE_URL" ]; then
  echo "[start] Updating the database to match this release..."
  if DATABASE_URL="${DIRECT_DATABASE_URL:-$DATABASE_URL}" pnpm exec prisma db push --schema database/prisma/schema.prisma --skip-generate; then
    echo "[start] Database is up to date."
  else
    echo "[start] WARNING: the database could not be updated automatically (a change may delete data). Run pnpm db:push by hand and read its warning."
  fi
fi
cd /app/apps/api
exec node dist/src/main.js
