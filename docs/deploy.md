# Cloudflare deployment

## One-time setup

Create these resources in the Cloudflare account that will run the application:

1. A production D1 database named `mine-db`.
2. A Pages project named `mine`.
3. A Worker API named `mine-api` (the first production deploy can create it).

Copy the production D1 UUID into `apps/server/wrangler.jsonc`; never commit the all-zero placeholder for a deployable project. Configure these GitHub repository variables:

- `CLOUDFLARE_ACCOUNT_ID`
- `PRODUCTION_WEB_URL` (the exact allowed CORS origin)
- `PRODUCTION_API_URL` (the Worker base URL embedded in the web build)

Configure `CLOUDFLARE_API_TOKEN` as a GitHub Actions secret. The token needs the account permissions required to manage Workers Scripts, Pages, and D1.

After changing `wrangler.jsonc`, run `bun run cf:typegen` and commit the generated binding declarations.

## Authentication (Google sign-in)

Sign-in is Better Auth with Google only. Only the addresses listed in `ALLOWED_EMAILS` can create an account; when it is empty nobody can sign in.

1. In Google Cloud Console, create an OAuth client (web application) and add these authorized redirect URIs:
   - Local: `http://localhost:8787/api/auth/callback/google`
   - Production: `<PRODUCTION_API_URL>/api/auth/callback/google`
2. Set the OAuth consent screen's publishing status to "In production". In "Testing", the refresh tokens used for the calendar integration expire after 7 days.
   - Enable the "Google Calendar API" in the same project (APIs & Services → Library).
   - Sign-in requests `https://www.googleapis.com/auth/calendar.readonly` and offline access. Because the app is not verified, Google shows a "Google hasn't verified this app" screen; for a personal app you can continue from "Advanced".
   - If you signed in before the scope was added, use "カレンダーを連携" in the app once to grant it.
3. Set the production Worker secrets (they persist across deploys):

   ```sh
   cd apps/server
   bunx wrangler secret put BETTER_AUTH_SECRET    # e.g. openssl rand -base64 32
   bunx wrangler secret put GOOGLE_CLIENT_ID
   bunx wrangler secret put GOOGLE_CLIENT_SECRET
   bunx wrangler secret put ALLOWED_EMAILS        # comma-separated
   ```

`BETTER_AUTH_URL` is set from `PRODUCTION_API_URL` at deploy time. Locally, copy `apps/server/.dev.vars.example` to `.dev.vars` and fill it in.

The web app (Pages) and the API (Worker) live on different domains, so the session cookie is a third-party `SameSite=None; Secure` cookie. If a browser such as Safari blocks it, serve both from subdomains of one custom domain. Preview Workers have no secrets, so sign-in does not work on PR previews.

## Production

A push to `master` runs CI, applies D1 migrations, deploys the Worker, then builds and deploys Pages. Deployment stops if the production D1 UUID is still the placeholder.

Migrations live in `packages/db/src/migrations` and are applied to production D1 before each deploy.

## Pull request previews

Pull requests from branches in this repository receive stable per-PR resources:

- Worker: `<slug>-api-pr-<number>`
- Pages deployment: branch `pr-<number>` in the `<slug>` project
- D1 database: `<slug>-db-pr-<number>`

Fork pull requests do not receive previews because repository secrets are unavailable and untrusted code must not receive production data.

When the PR database is first created, the workflow applies the production migration level, exports all production D1 data, imports it into the preview database while temporarily removing and then restoring triggers, and finally applies migrations that exist only on the PR branch. Empty schemas, no migrations, and empty dumps are accepted. Later pushes reuse the same preview database and apply only pending migrations. Closing the PR deletes its Worker, Pages deployment, and D1 database idempotently.

> **Data exposure warning:** the first preview snapshot is a complete, non-anonymized copy of production D1. Anyone who can create a branch in this repository must therefore be trusted to access production data. If that assumption is unsuitable, disable the snapshot step or replace it with a sanitized fixture process before enabling preview deployment.

Export temporarily blocks other requests to the source D1 database, so schedule unusually large snapshots with care.

## Required local acceptance checks

```sh
bun install --frozen-lockfile
bun run cf:typegen:check
bun run check-types
bun run check
bun run test:ci
bun run test:coverage
bun run check:test-discovery
bun run build
bunx wrangler deploy --dry-run -c apps/server/wrangler.jsonc
bun run db:migrate:local
```
