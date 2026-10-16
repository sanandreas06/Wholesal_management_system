# WHOLESTRA — Phase 1 Foundation

WHOLESTRA is a multi-branch wholesale management system (stock, sales, purchasing, finance and a tamper-evident change log). This is its runnable foundation.

## Includes
- pnpm monorepo
- Next.js dashboard
- NestJS API
- PostgreSQL + Prisma
- Redis
- JWT login
- Seeded admin account
- Dashboard KPIs and charts
- Docker Compose
- Basic API test
- VS Code extension recommendations

## Requirements
Node.js LTS, pnpm 10+, Docker Desktop, Git.

## Start
```bash
docker compose -f docker-compose.dev.yml up -d
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

Open http://localhost:3000

First sign-in on a fresh database:
- Email: admin@wholesale.local
- Starting password: set with `SEED_ADMIN_PASSWORD` when seeding (the built-in one is in `database/prisma/seed/seed.ts`).
- You are asked to choose a new password straight away. Never leave the starting one in place on anything other people can reach.

API: http://localhost:4000/api/health

Phase 1 is intentionally the foundation. Inventory, purchasing, sales workflows, finance, Excel synchronization, AI and production Azure infrastructure are later phases.
