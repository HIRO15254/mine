# Database migrations

Tables live under `packages/db/src/schema/`. Migrations in this directory are applied to production D1 on every push to `master`, before the new Worker is deployed.

## Changing the schema

1. Edit the table in `packages/db/src/schema/`.
2. Run `bun run db:generate` from the repository root. It writes the next `NNNN_<name>.sql` and updates `meta/`. Rename the file to say what it does (and the `tag` in `meta/_journal.json` to match), as the existing ones do.
3. Read the generated SQL. drizzle-kit rebuilds a table (create new, copy, drop old) for changes SQLite cannot make in place; check that the copy keeps every row. Separate statements with `--> statement-breakpoint`.
4. When existing rows need fixing for a new constraint, write that `UPDATE` by hand before the statement that adds the constraint (`0008_single_running_timer.sql` does this).
5. Run `bun run db:migrate:local`, then `bun run verify`. Every API and web test runs on a database built from the migrations (`createTestDb()` in `src/testing.ts`), so a broken migration fails them.
6. Commit the schema, the SQL and `meta/` together.

## Rules

- Never edit or delete a migration that has reached `master`: production has already applied it and records it by name. Fix a mistake with a new migration.
- A migration must work with the Worker that is live before the deploy, because migrations run first and a later deploy step can fail. Add columns (nullable or with a default) and tables first; drop or rename only in a later push, once no deployed code uses the old shape.
- D1 has no interactive transactions. In application code, writes that belong together go in one `db.batch([...])`; a constraint in the schema is the only guard against two requests racing.
- Every table that holds user data has a `user_id` (or reaches one through its parent) with `on delete cascade`, and every query filters by it.

## Conventions for new columns

The existing tables grew before these were written down, so a few columns differ (listed below). New columns follow the rule; the old ones are left alone, because converting one means rewriting a table that holds the user's data.

- **A day** is `text`, `YYYY-MM-DD`, in the user's calendar (`scheduled_date`, `effective_from`). A time of day is `text`, `HH:MM`.
- **An instant the app computes with or shows** is a plain `integer` of epoch milliseconds, a `number` in code (`time_entry.started_at`, `claude_thread.updated_at`). Older exceptions in epoch seconds through Drizzle's `timestamp` mode: `task.completed_at`, `task_completion.completed_at`, `api_token.last_used_at`.
- **Bookkeeping** `created_at` and `updated_at` come from `createdAt()` and `updatedAt()` in `schema/columns.ts` (epoch seconds, a `Date` in code). Nothing in the app's logic should depend on them, except that tasks are ordered by `created_at` last.
- **Money** is an `integer` of whole yen.
- **A fixed set of values** (`status`, `color`) is `text` with Drizzle's `enum` and a `check()` constraint, and **a bounded number** (`priority`) gets a `check()` too. The existing `task.priority`, `claude_thread.status` and `project.color` have no constraint in the database, because adding one rebuilds the table; the procedures' input schemas are their only guard, so keep those in `packages/api/src/*/schema.ts`.
- **A rule two requests could break by racing** is a constraint or a unique index (`time_entry_running_idx`), since D1 has no transaction to hold them apart.
- **A name people type** (`label.name`) is stored as typed and compared without regard to case, at save (`assertNameFree`) and at lookup. A unique index compares exactly, so it does not replace that check.
- **Structured values** are JSON in `text`, parsed through a schema when read (`task.recurrence`).
- `sort_order` orders siblings and is written on create (`project`, `label`). Tasks have no manual order.

## Dropping or renaming a column

Two pushes, because migrations run before the new Worker is live and the old Worker still names the column in its queries:

1. Stop using the column: remove it from the Drizzle table and from every query, and add `"<table>.<column>"` to `PENDING_DROPS` in `src/__tests__/schema-drift.test.ts`. Do not run `db:generate`. Push, and wait for the deploy to succeed. Drizzle names the columns it knows in each statement, so the Worker that is now live never mentions the column. The column must be nullable or have a default, or inserts will fail.
2. Run `bun run db:generate` (it writes the `ALTER TABLE ... DROP COLUMN`), take the entry off `PENDING_DROPS`, and push.

Between the two, any other `db:generate` also writes the drop; that is fine once step 1 is live.

For a rename, add the new column, write both, backfill, then drop the old one the same way.

## What the tests check

- `schema-drift.test.ts` applies every migration to an empty database and compares the result with the Drizzle tables: tables, columns (type, `NOT NULL`, primary key), indexes and foreign keys. It fails when the schema changed without a migration or a migration was written by hand and differs from the schema. Defaults and `check()` constraints are not compared.
- `migrations.test.ts` checks that the files and `meta/_journal.json` agree, and refuses `DROP TABLE`, `DELETE FROM` and `PRAGMA foreign_keys` unless the file is listed in `ALLOWED` with the reason it is safe. D1 applies migrations with foreign keys on, so dropping a table that others point at with `on delete cascade` deletes their rows; a rebuild that drizzle-kit generates must be read with that in mind.
