# Database migrations

Tables live under `packages/db/src/schema/`. After changing them, run
`bun run db:generate` from the repository root to create the next migration in
this directory.
