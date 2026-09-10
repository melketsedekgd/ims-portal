@AGENTS.md
# CLAUDE.md

Context for Claude Code working in this repository.

## What this is

IMS (Integrated Management System) platform for MMCY Tech. Next.js 16 (App
Router) · TypeScript · Tailwind · shadcn/ui · Supabase/PostgreSQL.

Departments in the data are **IT** and **SRD**. Any reference to "R&D" is stale.

The database is finished and holds real Q1/Q2 2026 data from the actual
quarterly reports. Current work is swapping the UI off hardcoded `initialData`
arrays onto real queries, page by page. `/department/kpis` is done; the rest
still read `@/lib/mockData`.

## Structure

```
src/
├── app/(dashboard)/        routes only — thin, no business logic
├── features/<module>/
│   ├── components/         the UI for that module
│   ├── queries.ts          reads
│   ├── mutations.ts        writes / server actions
│   ├── schema.ts           zod
│   └── types.ts
├── components/ui/          shadcn — never hand-edit
├── lib/supabase/           browser + server clients
└── types/database.ts       generated from Supabase, committed
```

Database access goes in `src/features/<module>/`, never in `src/components/`.
The module is `action-items`, not `actions` — `actions` collides with Next.js
Server Actions. Same reason for `mutations.ts` over `actions.ts`.

## Rules that are easy to get wrong

**Never add a department filter to a query.** RLS applies department scoping in
the database based on the signed-in user. An empty list is a permissions result,
not a missing `.eq()`. Adding an explicit filter hides real permission bugs.

**Never use the Supabase secret key in application code.** It bypasses RLS.
Application code uses the publishable key only.

**Query from the parent table, filter on the embed.** For period-scoped lists,
query `kpis` / `risks` / `objectives` — not the measurement table. A row with no
measurement for the selected period must still render as "Pending".
`.eq("kpi_measurements.reporting_period_id", id)` filters the embedded resource,
which PostgREST treats as a left join, so unmatched parents survive. **Never add
`!inner`** — it silently drops them.

**Use `kpi_achievement_ratio()`, not `kpi_computed_ratio()`.** The second ignores
manager overrides. It's selected as if it were a column (PostgREST computed
column pattern); the generated types call it a function, so `.returns<T[]>()` is
required to override them.

**Generated types in `database.ts` are a starting point, not the truth.** They
type many-to-one nested joins as arrays and computed columns as functions. Use
`.returns<T>()` where they're wrong.

**The reporting period lives in the URL** (`?year=2026&quarter=Q2`), never in
component state. The fetch happens in a server component, and the URL is the only
thing it can react to. Period pickers call `router.push`, not `setState`.

**Client components taking `initialData` need a `key` prop.**
`useState(initialData)` reads its argument once, on mount. Without
``key={`${year}-${quarter}`}``, React reuses the instance across navigation and
the table keeps showing the previous period's rows.

**`import type` across the server/client boundary.** `queries.ts` creates a
server client and reads cookies. A value import from a `"use client"` file drags
that into the browser bundle; `import type` is erased at compile time.

**`display_order` is scoped per process.** Join `processes` and include it in
`ORDER BY`, or KPIs from unrelated processes interleave.

**Round in SQL, not in TypeScript.** `round(..., 4)` at the query layer keeps the
query and the UI in agreement.

## Data facts that look like bugs but aren't

- **`reference_number` is not an identifier.** Reports restart numbering per
  process every quarter and reuse numbers. Q1's "Email Threat 1" and Q2's "Email
  Threat 1" are different risks. Use `id`.
- **A `baseline` risk assessment has a null `reporting_period_id`.** Correct —
  baselines are pre-treatment and not tied to a period. `residual` assessments
  have one row per period.
- **`not_measured` is not zero.** Render as "N/A", exclude from averages.
- **Typos in the data are faithful to the source** (`Loging and Monitoring`,
  `Availlability`, `Prcedure`). Don't "fix" them.
- **`threat`, `vulnerability`, `risk_statement` are nullable on purpose** — SRD's
  historical form lacks those columns.
- **Objective achievement comes from counting completed activities**, never from
  KPIs. An objective can sit at 66% while its process's KPIs are all at 100%.
- **Measurements snapshot their target at entry time.** Changing a KPI's target
  never re-scores history.

## Permission model

| Role | Can |
|---|---|
| `responsible_user` | Read own department. Create/edit **measurements**. |
| `department_manager` | Above, plus edit **definitions** (KPIs, risks, objectives) in their department, and set `achievement_override`. |
| `ims_admin`, `system_admin` | Everything, all departments. |
| `ims_reviewer` | Read only. Deliberately excluded from writes. |

Role keys are exactly as above. `SUPER_ADMIN` does not exist — checking for it
makes a menu invisible to everyone.

`my_department_ids()` is for reads, `my_managed_department_ids()` for writes.
Using the first in a write policy was a real bug; don't reintroduce it.

## Workflow

**Never push to `main`.** Branch (`feat/`, `fix/`, `db/`, `chore/`, `docs/`) → PR
→ CI green → 1 approval → squash-merge → pull.

Commits are small and atomic. Unrelated concerns (CI/infra changes) go in their
own branches so feature diffs stay clean.

**No schema changes through the Supabase Studio UI.** Migrations in
`supabase/migrations/*.sql`, committed to git. Regenerate `src/types/database.ts`
after each one.

**Soft delete everywhere** — `status` fields and `effective_to`, not `DELETE`.

## Build and verify

CI runs: `npm ci` → `npx next typegen` → `npx tsc --noEmit` → `npm run lint` →
`npm run build`.

The `next typegen` step is required. Next.js 16 generates `LayoutProps`/
`PageProps` into gitignored `.next/types/`, so without it `tsc` fails on CI with
`TS2304` while passing locally.

**After moving or renaming routes, run `next build` before `tsc`.** `tsc` reads
the generated `.next/types/validator.ts`, which still points at old paths and
reports fake `TS2307` errors until the build regenerates it.

**A green build is not a correct build.** Typecheck, lint, and build have all
passed on a version that silently pinned a page to one quarter. Verify behaviour
against expected row counts, not just exit codes.

## Working style

One step at a time. Explain what a change does and why before making it.
Verify each stage before moving to the next. Don't write four files when the
first one hasn't been checked yet.

If a file is large, read all of it before drawing conclusions. Reading the first
screen of a 1,000-row spreadsheet produced a confident wrong conclusion once
already.