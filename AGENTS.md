# Mine agent guide

This file is the source of truth for every coding agent working in this repository.

## Stack

- Bun workspace with TypeScript
- React, Vite, TanStack Router and Query, tRPC, Tailwind CSS, Mine Design System components (shadcn/ui names on Radix UI), and PWA support
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
- `bun run check:design-tokens`: compare the app's tokens with the Mine Design System snapshot in `design/mine/`
- `bun run screens`: screenshot every screen with sample data into `test-results/screens/`
- `$better-t-app-setup`: use the bundled repository skill for template renaming and command-line Cloudflare deployment setup
- `$ui-design`: use the bundled repository skill to design on the Mine UI canvas and to apply canvas or design-system changes to `apps/web`

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

## UI rules (Mine Design System)

- Tokens live in `apps/web/src/index.css` with shadcn names plus the system's extensions (`primary-text`, `primary-soft`, `accent-pressed`, ...). Use their utilities, never hard-coded colors.
- Primitives live in `apps/web/src/components/ui/<name>/<name>.tsx`; import them by that path (no barrel files).
- The layout switches at the `desk` breakpoint (720px): sidebar and 13px desktop scale above it, bottom tab bar, `m-*` sizes and `xl` controls below it.
- Icons come from `@tabler/icons-react` only. No emoji. The one image is the Mine mark (`BrandMark`, `apps/web/public/logo.png`) in the sidebar, the mobile header and the sign-in screen.
- The accent is light, not a hue: `primary` is white in dark and ink in light. `glow` marks what is live or chosen (the running timer, the current nav item); project colors are the five `chart-*` prism hues.
- UI copy is Japanese, short and in plain form; sentence case for any English.

## Design workflow

- The Mine UI canvas (Claude Design) is the source of truth for the look; `apps/web` copies it. `docs/design-workflow.ja.md` describes the flow and `design/sources.json` links the canvas and Mine Design System (forked from Cryst on 2026-11-06; Cryst changes no longer flow in by themselves).
- Apply canvas or design-system changes with the `ui-design` skill, compare with `bun run screens`, and record deviations from the system in `docs/design/exceptions.md`.
- `design/canvas/` and `design/mine/` are verbatim snapshots: overwrite them from the source, never edit them by hand.
