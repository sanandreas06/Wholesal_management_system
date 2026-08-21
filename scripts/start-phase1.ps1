docker compose -f docker-compose.dev.yml up -d
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
