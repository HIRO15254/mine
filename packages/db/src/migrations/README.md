# Database migrations

Tables live under `packages/db/src/schema/`. Migrations in this directory are applied to production D1 on every push to `master`, before the new Worker is deployed.

## Changing the schema

1. Edit the table in `packages/db/src/schema/`.
2. Run `bun run db:generate` from the repository root. It writes the next `NNNN_<name>.sql` and updates `meta/`. Rename the file to say what it does (and the `tag` in `meta/_journal.json` to match), as the existing ones do.
3. Read the generated SQL. drizzle-kit rebuilds a table (create new, copy, drop old) for changes SQLite cannot make in place; check that the copy keeps every row. Separate statements with `--> statement-breakpoint`.
4. When existing rows need fixing for a new constraint, write that `UPDATE` by hand before the statement that adds the constraint (`0008_single_running_timer.sql` does this).
5. Run `bun run db:migrate:local`, then `bun run verify`. The API tests apply every migration to a fresh SQLite database, so a broken migration fails them.
6. Commit the schema, the SQL and `meta/` together.

## Rules

- Never edit or delete a migration that has reached `master`: production has already applied it and records it by name. Fix a mistake with a new migration.
- A migration must work with the Worker that is live before the deploy, because migrations run first and a later deploy step can fail. Add columns (nullable or with a default) and tables first; drop or rename only in a later push, once no deployed code uses the old shape.
- D1 has no interactive transactions. In application code, writes that belong together go in one `db.batch([...])`; a constraint in the schema is the only guard against two requests racing.
- Days are `YYYY-MM-DD` text, instants are integer epoch milliseconds (`created_at` and `updated_at` are epoch seconds through Drizzle's `timestamp` mode), money is integer yen.
- Every table that holds user data has a `user_id` (or reaches one through its parent) with `on delete cascade`, and every query filters by it.
