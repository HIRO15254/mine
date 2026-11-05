# Mine agent guide

This file is the source of truth for every coding agent working in this repository.

## Stack

- Bun workspace with TypeScript
- React, Vite, TanStack Router and Query, tRPC, Tailwind CSS, Cryst Design System components (shadcn/ui names on Radix UI), and PWA support
- Hono Worker with tRPC and Better Auth (Google sign-in only)
- Cloudflare D1 through Drizzle ORM
- Vitest for all automated tests

## Commands

- `bun install --frozen-lockfile`: install the pinned workspace
- `bun run dev`: run all development servers
- `bun run check-types`: type-check every workspace
- `bun run check`: run formatting and lint checks
- `bun run test`: run every Vitest project
- `bun run test:coverage`: run the coverage suite
- `bun run check:test-discovery`: verify each test belongs to exactly one project
- `bun run build`: build all applications
- `bun run cf:typegen`: regenerate Cloudflare binding types after changing `wrangler.jsonc`
- `bun run db:generate`: generate a D1 migration after changing the schema
- `bun run db:migrate:local`: apply migrations to the local D1 database
- `$better-t-app-setup`: use the bundled repository skill for template renaming and command-line Cloudflare deployment setup

## Package boundaries

- `apps/web` owns browser UI and browser-only integration.
- `apps/server` owns the Hono Worker, HTTP concerns, CORS, and tRPC transport.
- `packages/api` owns tRPC procedures and context types. It may depend on `packages/db`.
- `packages/auth` owns the Better Auth configuration and the `ALLOWED_EMAILS` allowlist. It may depend on `packages/db`.
- `packages/db` owns the D1 `Database` type, schema, and migrations.
- `packages/env` owns public web environment validation.
- `packages/config` owns shared TypeScript configuration.
- Shared behavior belongs in a package only when at least two consumers need it.

## Tests

- Keep tests beside the source in `__tests__` directories.
- Use `.test.tsx` for DOM tests and `.test.ts` for non-DOM web tests.
- Server, API, DB, env, and script tests must remain in their corresponding Vitest projects.
- A new test directory or suffix must also be reflected in `vitest.config.ts` and the discovery check.

## Product

Mine is a single-user personal dashboard for schedule, tasks and time tracking. Google Calendar stays the source of truth for events; tasks and time entries live in D1.

## UI rules (Cryst Design System)

- Tokens live in `apps/web/src/index.css` with shadcn names plus Cryst extensions (`primary-text`, `primary-soft`, `accent-pressed`, ...). Use their utilities, never hard-coded colors.
- Primitives live in `apps/web/src/components/ui/<name>/<name>.tsx`; import them by that path (no barrel files).
- The layout switches at the `desk` breakpoint (720px): sidebar and 13px desktop scale above it, bottom tab bar, `m-*` sizes and `xl` controls below it.
- Icons come from `@tabler/icons-react` only. No emoji.
- UI copy is Japanese, short and in plain form; sentence case for any English.
