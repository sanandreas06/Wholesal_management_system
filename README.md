# Wholesale Management System — Phase 1 Foundation

A clean, runnable foundation for the Wholesale Management System.

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

Demo:
- Email: admin@wholesale.local
- Password: Admin@12345

API: http://localhost:4000/api/health

Phase 1 is intentionally the foundation. Inventory, purchasing, sales workflows, finance, Excel synchronization, AI and production Azure infrastructure are later phases.
