# Mine

A personal dashboard that brings schedule, tasks and time tracking together. It is a responsive PWA (a sidebar on desktop, a bottom tab bar on phones) built on the Cryst Design System.

[日本語](./README.ja.md)

## Layout

- `apps/web`: React 19, Vite, TanStack Router/Query, tRPC, Tailwind CSS, Cryst components (shadcn/ui names on Radix UI)
- `apps/server`: Hono on Cloudflare Workers, serving tRPC and Better Auth
- `packages/api`: tRPC procedures
- `packages/auth`: Better Auth (Google sign-in, restricted by `ALLOWED_EMAILS`)
- `packages/db`: Drizzle schema and migrations for Cloudflare D1

## Development

```sh
bun install --frozen-lockfile
cp apps/web/.env.example apps/web/.env.local
cp apps/server/.dev.vars.example apps/server/.dev.vars   # fill in the Google OAuth client and the rest
bun run db:migrate:local
bun run dev
```

The web app runs on `http://localhost:3001` and the API on `http://localhost:8787`.

Checks:

```sh
bun run check-types
bun run check
bun run test
bun run check:test-discovery
bun run build
```

See the [deployment guide](./docs/deploy.md) for Cloudflare and Google sign-in setup.
