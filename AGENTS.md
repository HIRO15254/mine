# Mine agent guide

This file is the source of truth for every coding agent working in this repository. `apps/web/AGENTS.md` adds the web app's conventions.

## Product

Mine is a single-user personal dashboard for schedule, tasks and time tracking. Google Calendar stays the source of truth for events and is only read; tasks and time entries live in D1. The same data is reached three ways: the web app, a small REST API for shortcuts (`/v1`) and an MCP server for Claude (`/mcp`).

## Stack

- Bun workspace with TypeScript
- React, Vite, TanStack Router and Query, tRPC, Tailwind CSS, Mine Design System components (shadcn/ui names on Radix UI), and PWA support
- Hono Worker with tRPC and Better Auth (Google sign-in only)
- Cloudflare D1 through Drizzle ORM
- Vitest for all automated tests

## Commands

- `bun install --frozen-lockfile`: install the pinned workspace
- `bun run dev`: run all development servers (web on 3001, API on 8787)
- `bun run verify`: run everything the deploy gate runs (binding types, types, lint, test discovery, coverage tests, builds); run it before pushing
- `bun run fix`: format and apply safe lint fixes
- `bun run check-types`, `bun run check`, `bun run test`, `bun run build`: the parts of `verify`, for a quicker loop
- `bun run check:test-discovery`: verify each test belongs to exactly one project
- `bun run cf:typegen`: regenerate Cloudflare binding types after changing `wrangler.jsonc` or updating wrangler, then run `bun run fix`
- `bun run db:generate`: generate a D1 migration after changing the schema
- `bun run db:migrate:local`: apply migrations to the local D1 database
- `bun run check:design-tokens`: compare the app's tokens with the Mine Design System snapshot in `design/mine/`
- `bun run screens`: screenshot every screen with sample data into `test-results/screens/`; it boots the real web app against a mocked API, so it also works as a boot smoke test
- `$ui-design`: use the bundled repository skill to design on the Mine UI canvas and to apply canvas or design-system changes to `apps/web`

## Shipping

- Work lands by pushing to `master`; there are no pull requests. Every push to `master` deploys production: checks, then D1 migrations, then the Worker, then the web app.
- Before pushing, run `bun run verify` (the pre-push hook runs it again on the working tree, so stash unrelated work) and `git fetch origin master` to rebase onto what other sessions pushed.
- After pushing, confirm the Production Deploy run succeeded. A change is done when it is on `master`, the deploy is green, and the docs and tests that describe it are updated in the same push.
- Migrations run before the new Worker is live, and a later step can fail and leave the old Worker running. A migration must therefore work with the previous Worker: add columns and tables first, and remove or rename only in a later push, after no deployed code reads the old shape.
- `docs/deploy.ja.md` covers setup, manual deploys and what to do when a deploy stops halfway.

## Package boundaries

- `apps/web` owns browser UI and browser-only integration.
- `apps/server` owns the Hono Worker, HTTP concerns, CORS, the OAuth pages and the transport for tRPC, `/v1` and `/mcp`.
- `packages/api` owns tRPC procedures and context types, plus the bodies of the REST endpoints (`rest/`), the MCP tools (`mcp/`) and the OAuth server (`oauth.ts`). It may depend on `packages/db`.
- `packages/auth` owns the Better Auth configuration and the `ALLOWED_EMAILS` allowlist. It may depend on `packages/db`.
- `packages/db` owns the D1 `Database` type, schema, and migrations.
- `packages/env` owns public web environment validation.
- `packages/config` owns shared TypeScript configuration.
- Shared behavior belongs in a package only when at least two consumers need it.

## Domain

`docs/domain.ja.md` is the full description. The parts that are easy to get wrong:

- A task has three optional days: `startDate` (earliest day it can be done), `scheduledDate` (the day planned) and `deadline`. Priority 1 is the most urgent and 4 the default. The label `next` puts a task on Today regardless of dates. A recurring task is one row: completing it logs a `task_completion` and moves its dates forward.
- Projects form a tree and are shared by tasks and time entries. Hourly rates are whole yen with an effective day, and a project without its own rate inherits its nearest ancestor's. A project with time entries is archived, never deleted.
- At most one time entry per user is running (`endedAt` null; a partial unique index enforces it). Starting a timer stops the running one in the same batch.

## Dates and time zones

- A day is a `YYYY-MM-DD` string in the user's local calendar; an instant is epoch milliseconds in UTC; money is whole yen.
- The server never guesses the user's day. Procedures that need one take it as input (`today`, `timeZone`). The web sends the browser's; the MCP server is fixed to `Asia/Tokyo` (`DEFAULT_TIME_ZONE`).
- Never derive a local day with `toISOString().slice(0, 10)`: that is the UTC day. Use `todayKey()` and the helpers in `apps/web/src/lib/tasks.ts` on the web, `localDay()` and `startOfDayIn()` in `packages/api/src/time/` on the server, and `packages/api/src/tasks/dates.ts` for day arithmetic.
- In the web app, read the current day with `useToday()` so open screens move to the next day at midnight.

## The three API surfaces

`docs/architecture.ja.md` has the picture. All three end in the same tRPC procedures, which hold validation and ownership checks.

- `/trpc`: the web app, with the session cookie (writes must carry the web app's `Origin`) or a personal API token.
- `/v1`: REST for shortcuts and other apps; personal API tokens only. Documented in `docs/app-api.ja.md`.
- `/mcp`: tools for Claude; an OAuth access token from Mine's own OAuth server, or a personal API token. Documented in `docs/claude-mcp.ja.md`.

A feature is not reachable from Claude until it has an MCP tool. When adding or changing a feature, go through this list:

1. Schema and migration in `packages/db` (see `packages/db/src/migrations/README.md`).
2. Procedure in `packages/api/src/routers/`, with tests beside it. Scope every query by `ctx.session.user.id`. D1 has no interactive transactions: writes that belong together go in one `db.batch([...])`.
3. Web: hook, component, route, and a fixture for `bun run screens` (see `apps/web/AGENTS.md`).
4. MCP tool in `packages/api/src/mcp/tools.ts` and its row in `docs/claude-mcp.ja.md`, when Claude should be able to use it.
5. `/v1` endpoint and `docs/app-api.ja.md`, only when a shortcut needs it.
6. `docs/domain.ja.md` when a rule of the domain changed.

## Tests

- Keep tests beside the source in `__tests__` directories.
- Use `.test.tsx` for DOM tests and `.test.ts` for non-DOM web tests.
- Server, API, DB, env, and script tests must remain in their corresponding Vitest projects.
- A new test directory or suffix must also be reflected in `vitest.config.ts` and the discovery check.
- API tests run procedures against a real SQLite database: `createTestDb()` from `packages/api/src/__tests__/d1.ts` applies every migration, and `appRouter.createCaller(await createContextFactory(db, session, { now })())` gives a caller with a fixed clock. Test through the caller, not by calling helpers with hand-built rows. `time-router.test.ts` shows the setup.
- Web DOM tests render with `renderWithQuery()` from `apps/web/src/__tests__/render.tsx` and replace the tRPC client with `vi.mock("@/utils/trpc", () => import("<path>/__tests__/trpc-mock"))`; set what queries return through `trpcMock.state` and assert on `trpcMock.calls`. Build data with `makeTask()` and `makeProject()` from `task-fixtures.ts`. Find elements by their Japanese label or role, as a user would.
- A bug fix comes with a test that fails without it.

## UI rules (Mine Design System)

- Tokens live in `apps/web/src/index.css` with shadcn names plus the system's extensions (`primary-text`, `primary-soft`, `accent-pressed`, ...). Use their utilities, never hard-coded colors.
- Primitives live in `apps/web/src/components/ui/<name>/<name>.tsx`; import them by that path (no barrel files).
- The layout switches at the `desk` breakpoint (720px): sidebar and 13px desktop scale above it, bottom tab bar, `m-*` sizes and `xl` controls below it.
- Icons come from `@tabler/icons-react` only. No emoji. The one image is the Mine mark (`BrandMark`, `apps/web/public/logo.png`) in the sidebar, the mobile header and the sign-in screen.
- The accent is light, not a hue: `primary` is white in dark and ink in light. `glow` marks what is live or chosen (the running timer, the current nav item); project colors are the five `chart-*` prism hues.
- UI copy is Japanese and short. Messages and descriptions use polite form (です・ます); labels on buttons, menus and fields are short noun or verb phrases. Sentence case for any English.

## Design workflow

- The Mine UI canvas (Claude Design) is the source of truth for the look; `apps/web` copies it. `docs/design-workflow.ja.md` describes the flow and `design/sources.json` links the canvas and Mine Design System (forked from Cryst on 2026-11-06; Cryst changes no longer flow in by themselves).
- Apply canvas or design-system changes with the `ui-design` skill, compare with `bun run screens`, and record deviations from the system in `docs/design/exceptions.md`.
- `design/canvas/` and `design/mine/` are verbatim snapshots: overwrite them from the source, never edit them by hand.

## Documents

Guides that agents keep and follow (`AGENTS.md` files, skills, READMEs beside code, `docs/design/exceptions.md`) are in English. Documents for the owner (`README.md` and `docs/*.ja.md`) are in Japanese, in one language only.

- `docs/domain.ja.md`: tasks, projects, time entries, rates, and the date and time rules
- `docs/architecture.ja.md`: packages, the three API surfaces, authentication, offline behavior
- `docs/decisions.ja.md`: decisions already made and why; read it before proposing to change one
- `docs/deploy.ja.md`: setup, deploy, and recovery
- `docs/app-api.ja.md`: the `/v1` REST API
- `docs/claude-mcp.ja.md`: the MCP server and its tools
- `docs/design-workflow.ja.md`: the design flow
- `packages/db/src/migrations/README.md`: how to change the schema
