# Schema Decisions

Why the database looks the way it does. The SQL says *what*; this says *why*.
Every decision here was driven by the four real quarterly reports (Q1 and Q2,
IT and SRD) rather than by guesswork, and most of them exist because the naive
version broke against real data.

Read this before changing a table. Add to it when you make a call that a
future reader would otherwise have to reverse-engineer.

---

## Foundation

### `organization_settings` is a single-row table, not `organizations`

MMCY is one company and this is an internal tool. A real multi-tenant
`organizations` table means every table carries an `organization_id` that is
always the same value, and every RLS policy has to check it — cost with no
benefit.

The singleton is enforced structurally rather than by convention:

```sql
id boolean primary key default true,
constraint singleton check (id)
```

A primary key must be unique, a boolean has two possible values, and the check
rejects `false`. So `true` is the only insertable value and it can exist only
once. The table is incapable of holding a second row.

If MMCY ever needs real multi-tenancy, that's a migration — but it isn't
speculative work we're carrying now.

### The department code is `SRD`, not `R&D`

The design documents call it `R&D`. Every actual report and document code says
`SRD` (`MMCY-SRDD-F-008`). The reports win — they are what the organisation
actually uses. Seed data, imports and fixtures all use `SRD`; expect the design
docs to keep contradicting this.

### Departments use `effective_to`, not slowly-changing-dimension rows

The design doc says historical records must reflect the org structure that
existed when they were created. Two different situations hide in that sentence:

- **Reorg** — IT splits into Infrastructure and Security. Handled by
  `effective_to`: close the old row, create new ones, and risks logged before
  the split still point at the old row.
- **Rename** — "IT" becomes "Technology Services". Same team, same records.

Full SCD modelling (a rename creates a new row with a new id, plus a separate
stable identity to chain them) is the textbook answer and the wrong call for a
six-week build with three departments. `audit_logs` (Epic 10) already captures
renames with old value, new value, actor, timestamp — so "what was this called
in Q2 2026?" stays answerable without the extra machinery.

`effective_to is null` is the convention for "currently active" throughout the
schema. The partial unique index on `departments (code) where effective_to is
null` means a code can be reused years after a department is dissolved.

### `profiles`, not `users`

Supabase Auth owns `auth.users`. Naming ours `users` means every RLS policy
mentions both `auth.users` and `public.users`, which is an ambiguity you do not
want at 11pm.

`profiles.id` is both primary key and foreign key to `auth.users(id)` — they
share an id rather than joining. That means `auth.uid()` in a policy *is* a
profile id, no join needed. You will write that expression dozens of times.

### Department lives on `user_roles`, not `profiles`

A person can hold more than one role/department combination — Responsible User
in IT and Approver in SRD. Put `department_id` on the profile and each person
gets exactly one; the day someone needs two you're migrating populated tables.

The unique index uses a coalesce sentinel because Postgres treats nulls as
distinct in unique indexes — without it, "org-wide IMS Admin" could be inserted
five times:

```sql
coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid)
```

`department_id is null` means organization-wide (System Admin, IMS roles).

### The bootstrap trigger

Every write policy requires an existing admin, and `user_roles` is the only
table that grants roles. A fresh database therefore has no way to create its
first admin — you sign up, get a profile with no roles, and are locked out.

`bootstrap_first_admin()` resolves this: when a profile is created and *no*
role assignments exist anywhere, that person becomes System Admin. The `exists`
check means it can never fire again once one row exists, so it is a one-time
bootstrap and not an ongoing privilege path.

The alternative was doing it by hand with the secret key, which works but is
undocumented and leaves teammates stuck on their own projects.

Note the first profile still has to be inserted via the SQL Editor, which
connects as `postgres` and bypasses RLS. The trigger handles the role.

---

## Risks

### `threat`, `vulnerability` and `risk_statement` are nullable

**This is the single most important thing to know before you tighten a
constraint.**

IT's risk sheet has four columns: Affected Assets, Threat, Vulnerability, Risk
Statement. SRD's Q1 sheet has one merged column labelled `Asset (Risk
Statement)`. SRD's Q2 sheet has just `Affected Assets`.

The columns don't exist in SRD's form — the header row goes straight from the
asset column to Current State, and the data rows do the same. This is not
missing data in a shared form; it is a different form.

`not null` on any of those would have locked SRD out of the platform entirely.
Only `affected_assets` is universally present.

IMS has since confirmed all departments will converge on IT's format, so these
may become *practically* required for new entries — but historical SRD rows
still can't retroactively have them. Keep nullable; enforce at the form layer
if IMS wants it.

### `reference_number` has no unique constraint

IT's Q1 risks are grouped under procedure headers, and the numbering restarts
in each group:

```
Email Threat Management Procedure      1, 2, 3
Network Management Procedure           1, 2, 3
Patch Management Work Instruction      1
```

Risk ID 1 appears three times in one department. A unique constraint on
`(department_id, reference_number)` would reject legitimate rows. Scoping to
`(department_id, process_id, reference_number)` is closer but still fragile —
delete one and renumber, and every reference to "risk 2" now means something
else.

The real identity is `id` (uuid). `reference_number` is a display label carried
over so the platform's screens match the report people already know.

Note this makes DATA-02's acceptance criterion — *"a Risk ID is entered that
already exists for the department → prompt to update"* — wrong as written. It
would fire constantly.

### `risk_owner_title` is text, not a foreign key

The Risk Owner column contains `Network Admin`, `Cyber Security Analyst`,
`Engineering Manager`, `People Operations Team`, `IT Team`. Job titles, and two
are whole teams. There is no profile row for "People Operations Team", so a FK
rejects it and the import fails.

Second reason: job titles outlive people. If the Network Admin leaves, the role
still owns those risks. A title survives staff turnover in a way a person-FK
doesn't, which matters for a register meant to be auditable years later.

A nullable `risk_owner_profile_id` can be added alongside later for when a
specific person *is* assigned. Two columns, two jobs.

### `risk_assessments` is append-only, with `baseline` and `residual` types

Comparing the same patch-management risk across quarters:

| | Current State | Residual |
|---|---|---|
| Q1 | 3 / 2 / 6 | 3 / 2 / 6 |
| Q2 | 3 / 2 / 6 | 3 / 1 / 3 |

Current State doesn't move; Residual does. So it is not open-ended
reassessment — it is one baseline plus a residual per reporting period. Hence
the `assessment_type` enum with exactly those two values, and
`reporting_period_id` nullable (a baseline isn't tied to a quarter).

There are no update or delete policies on this table. A re-score is a new row,
never an edit — US-3.6. Even IMS cannot rewrite a past score.

`rpn` is `generated always as (severity * likelihood) stored`. It cannot be set
by hand and cannot drift from its inputs. The spreadsheet has it as a formula;
this is the database equivalent.

### `risk_treatment_reviews` is separate from `risk_treatments`

The treatment plan is stable — SRD risk 1 has identical treatment text in Q1
and Q2, running Feb–Dec 2026. The *commentary* changes every quarter:

- Q1: "The task has been started and still ongoing."
- Q2: "The task has been tested locally for HRMS, but application to
  development environment is ongoing…"

Two different lifespans. Put `reason_for_deviation` on `risk_treatments` and
Q2's entry overwrites Q1's, and the record of what was said three months ago is
gone. That is exactly the history-over-overwriting failure the platform exists
to fix, so it gets its own table with a unique index on
`(treatment_id, reporting_period_id)`.

### `rpn_improvement_level` is deliberately not stored

The reports have this column, but Q1 IT writes `-8, -5, -12` and Q2 IT writes
`3, 8` — the sign convention flipped between quarters because a human typed it.
It is `baseline_rpn − residual_rpn`, derivable from `risk_assessments`. Compute
it in a view; don't store a number already proven unreliable.

### `status` includes `retired`

IT's Q1 register has 11 risks across 5 procedure groups. Q2 has 4 across 2.
Seven risks are simply gone — no closure note, no reason, no decision-maker.
Were they resolved? Deprioritised? Forgotten?

In a spreadsheet, deleting a row leaves no trace. Here you set
`status = 'retired'` and the row, its assessments, and its treatment history
all remain. This is the clearest single demonstration of the platform's value
and it's worth showing IMS.

---

## KPIs

### Targets and actuals are stored three ways

`target_text` keeps what the department wrote (`<170ms`, `>99.9%`, `2 weeks`)
so the platform's screens match the report. `target_value` + `target_unit` are
the parsed pair the system computes with. Storing both makes the parse
auditable — anyone can see the original beside what the system understood.

Parsing happens in TypeScript **at entry time**, with the user confirming the
interpretation, not in Postgres on read. Regex on `2 hr 50mins` in plpgsql is
miserable, and parsing is ambiguous enough that a human should confirm it once.

Real values this has to survive, all from the reports:

```
targets:  <170ms  >99.9%  3 hours  10 Story points  <5 times per month  0.9  0
actuals:  98.6 ms  2 hr 50mins  9 incidents  0.9993  1.67E-3  N/A  15.5 days
```

### The `units` table exists because of the percent/ratio trap

Availability: target reads `>99.9%`, actual reads `0.9993`. Parse both naively
and you compare `0.9993 > 99.9` → false. The KPI reports as failed when it
passed.

Patch deployment: target `2 weeks`, actual `12 days`. Compare 2 to 12 and it
looks badly missed. It was met.

So each value needs a number *and* a unit, normalised to a common base before
comparison. `units.factor_to_base` does the conversion (`percent` = 0.01, `ms`
= 0.001, time base is seconds).

`units.dimension` is what makes comparison *safe*. Two values are comparable
only if they share a dimension. This catches Q1's packet loss, which reads
`1.133 ms` against a `<10%` target — time versus ratio. The function returns
null and the UI flags it rather than charting nonsense. That row is loaded
as-is, deliberately, as a live example of the guard working.

Units are data, not code: IMS adds `kg` with an insert, not a migration.

### `target_direction` is not optional

Latency `<170ms` is lower-is-better. Availability `>99.9%` is higher-is-better.
Both sit in the same sheet, three rows apart. Without this column, half of
every "is this KPI healthy" query is wrong.

### The achievement ratio caps at 1

```
higher_is_better -> min(actual / target, 1)
lower_is_better  -> min(target / actual, 1)
```

Verified against the reports' "Q_ Vs AT" column across 98 real measurements:

| KPI | Period | Sheet | Computed |
|---|---|---|---|
| Repeated incidents | Q1 | 0.7391 | 0.7391 |
| Response Time | Q1 | 0.6308 | 0.6308 |
| Ticket Backlog | Q2 | 0.2841 | 0.2841 |
| Timely execution on CMP | Q1 | 0.1133 | 0.1133 |
| Server failover rate | Q2 | 0.06 | 0.0600 |

**Why cap at 1:** SRD Q2 velocity is 10.8 against a target of 10. Uncapped that
is 1.08. The report says 1. Achievement is "did you meet the target", not "by
how much did you beat it" — otherwise one over-performing KPI inflates a
department's average and hides three that missed.

**Zero handling** was a real bug found by loading data. The original guarded
against division by zero with `actual_base > 0`, which swallowed the *best
possible outcome*: 0 days to resolve a security issue, 0 escalations, 0 access
violations all returned null instead of 1. Now handled explicitly per direction:

- `actual = 0`, lower-is-better → **1** (zero incidents against "<10" is perfect)
- `target = 0`, lower-is-better → **0** unless actual is also 0 (matches the
  sheet: internet failure rate, target 0, actual 8.33%, scored 0)
- `target = 0`, higher-is-better → **1** (any result clears a zero bar)

### `measurement_frequency` vs `reporting_frequency`

IT's KPIs say Analysis Frequency: Monthly, but the report is Quarterly. There
are three monthly numbers behind every figure in that sheet. Both columns reuse
the `period_type` enum.

`aggregation_method` is per-KPI because the rule differs by KPI, not by
department. Confirmed with IMS: `Number of total incident` reading 8 against
`<10` is the quarter's **sum**, while latency is a monthly **average**.

### Measurements snapshot the target

`kpi_measurements` copies `target_value`, `target_unit` and `target_direction`
from the KPI at entry time rather than reading them live.

If IMS tightens the latency target in 2027, every 2026 measurement would
silently re-score against the new target — a KPI that passed in Q2 2026
suddenly shows as failed. Snapshotting keeps each period scored against the
target that applied then. Same principle as `effective_to` on departments.

### `not_measured` is a column, not a null

The reports are full of `N/A`, and it means something specific: BCP tests are
Yearly and simply aren't measured in Q2; network backup restore couldn't run
because a switch was missing. That is different from "nobody filled this in".

A check constraint enforces it: a measurement is either explicitly
not-measured, or it has a value.

### `achievement_override` — settled with IMS

SRD Q1 sprint velocity: actual 6.5 against a 10-point capacity target,
justified as *"the current backlog only required 6.5 points. We successfully
delivered 100% of the prioritized user stories."* The sheet scores it 1; the
formula computes 0.65.

Two different measurements share one row — velocity (capacity) and commitment
completion (delivered ÷ committed).

**Decision: keep the computed value, and let IMS override with a written
reason.** The computed figure stays visible; the override sits beside it. A
check constraint rejects an override with no justification, so a number can
never be asserted silently — which is strictly more honest than the
spreadsheet, where every figure is asserted and none are marked as such.

`overridden_by` and `overridden_at` record who and when.

### Unique KPI name per active process

Added after a double-run of an insert created duplicate KPI definitions, which
then duplicated eight measurement rows. Scoped to `status = 'active'` so a
retired KPI's name can be reused. Uses `lower(name)` and the same coalesce
sentinel as `user_roles`.

---

## Objectives

### Achievement comes from activities, not a typed percentage

IT's Objective 3 reports 33.3% in Q1, and the deviation note explains why:
*"three activities scheduled across the full 2026 period, and Q1 reflects
completion of the Windows monitoring activity only."* Objective 4 hits 66.67%
in Q2 — two of three.

So percentage achievement is `completed / total`, which is why
`objective_activities` exists. Verified: all four IT objectives reproduce the
Q2 report exactly (100%, 33.33%, 33.33%, 66.67%) from activity rows.

`cancelled` is a separate status from `completed` so it can be excluded from
the denominator — a cancelled activity shouldn't count against you.

`objective_achievement()` returns **null** when an objective has no activities,
so the UI can show "not decomposed yet" rather than a misleading 0%. SRD's
objectives are single tasks (*"Perform security review of CMP ERP module"*)
and have no activities at all — that's the design working, not a gap.

### `objectives` has no `target_value` / `target_unit`

Unlike KPIs, the numeric targets are prose inside the title, and there are
often two in one objective — Objective 4 carries both ≥95% patch compliance
*and* ≥90% posture score. Parsing them into columns would fail on half the
rows.

### `objective_measurements.achievement` is stored, not computed

`objective_achievement()` tells you where an objective stands *now*. The stored
column records where it stood *when the period closed*.

IT's Objective 3 was 33.3% in Q1. The Linux activity finished later, making it
higher today. Recompute Q1 from live activity data and you rewrite history.
Same reasoning as the KPI target snapshot.

`activities_completed` and `activities_total` are stored alongside so the
number is explainable years later — "33.33%" is opaque, "1 of 3" is auditable.

### `reason_for_deviation` and `followup_action` are per-period

SRD's milestone objective has completely different deviation text in Q1
(*"projects in early phases or on hold"*) versus Q2 (*"configuration of GitHub
milestones was overlooked"*). On the objective row, Q2 overwrites Q1.
### `objectives.process_id` is context, not a measurement input

Objectives and KPIs overlap far more than the objectives sheet suggests. IT's
Q2 KPI sheet carries 14 processes and roughly 40 KPIs, and three of the four
objectives land on a process that already exists:

| Objective | Process | KPIs on that process |
|---|---|---|
| 1 — access control via Active Directory | Access Control | 3 |
| 3 — Windows/Linux monitoring integration | Logging and Monitoring | 2 |
| 4 — timely patching, ≥95% compliance | Patch Management | 2 |
| 2 — standardized endpoint security | *none* | — |

So the column is worth having and will mostly be populated. It is nullable
because of Objective 2: the capability is still being rolled out, so there is
no process to attach it to yet. That is the normal state for a new initiative,
not an edge case.

**What the column is for:** showing an objective beside the KPI trend for the
process it is trying to improve. Label it as process performance on screen. It
is not the objective's score.

### Achievement stays on activities even where KPIs exist

Objective 4 reports 0.6667 in Q2. Both Patch Management KPIs score 1 — average
deployment 12 days against a 2-week target, policy compliance 93% against
>90%. Roll the KPIs up and the objective reports 100%.

Both figures are correct. The KPIs say the process is healthy right now. The
objective says one of three planned improvements is still outstanding. A
rollup collapses two different questions into one number, and the outstanding
work is what disappears.

Objective 3 makes the same point from the other direction: its process,
Logging and Monitoring, reports N/A in the Q2 Vs AT column for both KPIs, so
there is nothing to aggregate at all — while the objective still has a real
33.33% from its activity rows.

**Do not derive `objective_measurements.achievement` from the KPIs reachable
through `process_id`.**

### No `objective_kpis` join table yet

Transitivity through `process_id` already yields small, on-topic sets — three
KPIs for Access Control, two for Patch Management. Explicit per-objective picks
would add a table and a maintenance burden for no gain against current data.

Revisit if a process accumulates enough KPIs that the transitive list stops
being useful on screen. Purely additive when that happens.

### The department guard is a trigger, not a check constraint

A check constraint cannot read another table, so an `objectives.process_id`
pointing at a different department's process has to be caught by
`guard_objective_process_department()`. Without it an IT objective can attach
to an SRD process, and the department filter on a dashboard silently disagrees
with the process filter.

It fires on insert and on update of `process_id` or `department_id`, so
reassigning either column is re-checked rather than trusted.---

## RLS

### Enabled in the same migration as the tables, never a follow-up

Enabling RLS on a populated table means there was a window where the data was
open, and you're reverse-engineering intent instead of stating it.

**RLS on with no policy denies everything.** There is no "deny" policy in
Postgres — omitting a policy *is* how you deny a command. A table with RLS
enabled and no select policy returns zero rows to everyone, silently, with no
error. This bit us once: three tables shipped without policies and looked
"empty" rather than broken.

Always verify after pushing:

```sql
select tablename, count(*) from pg_policies
where schemaname = 'public' group by tablename order by tablename;
```

### The helper functions are `security definer`

`has_role()`, `is_ims()` and `my_department_ids()` query `user_roles`, which
itself has RLS. Without `security definer`, checking "what roles do I have"
would be filtered by the policy asking the question — infinite recursion, and
Postgres errors out.

That's power, so it's fenced with `set search_path = public`. Without it,
someone who can create objects could shadow `user_roles` with their own table
and the function would read theirs. **Do not drop that line.**

`stable` lets Postgres call them once per statement rather than once per row.
On a 500-row query that's the difference between fast and unusable.

### Scoping pattern

- `is_ims()` (system_admin, ims_admin, ims_reviewer) → reads everything
- Everyone else → `department_id in (select my_department_ids())`
- Child tables have no `department_id`; they check their parent via
  `exists (select 1 from parent where ...)`. Reviews go two joins deep
  (review → treatment → risk → department).

A duplicated `department_id` on every child table would be faster but can drift
from its parent, which is a worse problem than a join.

**Writes on `processes` are narrower than reads** — `system_admin` and
`ims_admin` only, not `is_ims()`. A reviewer reviewing shouldn't be creating
IT's process list.

**`user_roles` is the narrowest table in the schema.** Write access there is
write access to everything, transitively, because every other policy calls
`has_role()`. Department Managers are excluded even for their own department:
assigning `ims_admin` scoped to a department still yields org-wide power.

### Department Managers can edit their department, but not its structure

RLS controls rows, not columns. `guard_department_structure()` is a trigger
that blocks non-IMS users from changing `parent_department_id`,
`effective_from`, `effective_to` or `status`.

A manager editing their own description is fine. A manager accidentally
dissolving their own department — which is what setting `effective_to` does to
every record attached to it — is a different category of accident.

Note the trigger compares with `is distinct from`, not `!=`. See below.

### RLS has not been verified as a real user

Every query run during schema build and data load went through the Supabase SQL
Editor, which connects as `postgres` and bypasses RLS entirely. The policies are
written but have never been exercised by an actual department-scoped session.

Verify before building any screen on top of them: sign in as a Responsible User
scoped to SRD and confirm IT's measurements are not visible. Until that is done,
treat "RLS is enabled" as meaning the switch is on, not that the rules work.

### `is_ims()` is broader on writes than it should be

Most tables allow writes to anyone `is_ims()` returns true for — which includes
`ims_reviewer`. Only `processes` was tightened to `system_admin` and `ims_admin`.
The same reasoning applies elsewhere: a reviewer reviewing should not be
authoring the records under review. Known inconsistency, not yet reconciled;
fix it deliberately in one migration rather than drifting table by table.

---

## Two Postgres traps worth knowing

### `is distinct from`, not `!=`

`id != null` evaluates to `null` — not true, not false — and a CHECK constraint
*passes* on null. So `check (id != parent_department_id)` silently does nothing
for every top-level department. `is distinct from` treats null as a comparable
value.

A constraint that quietly constrains nothing is worse than no constraint. Same
issue in the department guard trigger, where `parent_department_id` is null for
top-level rows.

### Nulls are distinct in unique indexes

`unique (profile_id, role_id, department_id)` would let you insert
"org-wide IMS Admin" five times, because `null ≠ null`. Hence the coalesce
sentinel in `user_roles` and `kpis`.

---

## Deferred, deliberately

### Per-department form configuration

The columns are all nullable, so a `department_form_fields` table controlling
visibility, labels and required-ness can be added later with no data migration.

Not built now because IMS confirmed all departments will converge on IT's
format after this development phase. Building a form builder speculatively
would eat the timeline.

If it does get built: the config must be **versioned**, with each record
stamped with the form version it was captured under. Otherwise a 2026 risk
renders with a 2027 form and displays fields that didn't exist when it was
written — the same traceability failure the platform exists to fix.

### `custom_fields` JSONB

Worth adding when convenient. "Same format now" and "no department will ever
need an extra field" are different claims. One nullable JSONB column costs
nothing.

The rule for column vs JSONB: **does the platform compute with it?** Anything
calculated, filtered, sorted, charted or constrained is a real column. Anything
captured and displayed but never computed on can be JSONB. Do not go fully
flexible — key/value rows for everything (EAV) loses type checking,
constraints, and makes "severity above 3" a nightmare query.

### Cycle detection on `parent_department_id`

`no_self_parent` only blocks a department being its own *direct* parent. A→B→A
still slips through and would need a recursive trigger. With three departments
that's over-engineering. Documented so it reads as a decision, not an oversight.

### `profiles_update_own` lets a user set their own status

Someone could technically mark themselves inactive. Harmless, and closing it
needs another column-guard trigger. Noted rather than built.

---

## Data-quality problems the Excel import will hit

Found while loading the four reports. The importer needs to handle these, and
`kpi_measurements.actual_text` / `not_measured` exist partly because of them.

- **Dates are broken three ways.** Q1 IT has `46023` (raw Excel serial for
  2026-01-01) *and* `02/30/26` — February 30th does not exist. Q1 SRD uses text:
  `February, 2026`. `risk_treatments.start_date` and `target_date` are nullable
  because of this: better to import with a null date and flag it than lose the
  risk.
- **Unit mismatches.** Q1 packet loss reads `1.133 ms` against a `<10%` target.
  Wrong unit entirely; Q2 reads `0.0035`. The dimension guard catches it.
- **Column headers drift between quarters.** `Reson for Deviation` in Q1 SRD,
  `Reason` in Q2. The mapper cannot assume stable headers.
- **Hand-calculated fields are unreliable.** RPN Improvement Level flips sign
  between quarters. Recompute rather than import.
- **Typos are preserved on import**, not silently corrected: `Availlability`,
  `Loging and Monitoring`, `Prcedure`, `dahboard`. The migration should be a
  faithful record; IMS fixes them in the platform.
- **The process column is sparse and the sheets are long.** Q2 IT reports a
  `max_row` of 1035 across 14 processes. A process name appears once per group
  and the rows beneath it are blank in that column, so the importer has to
  carry the last non-empty value forward. Reading only the first screenful
  gives 4 processes out of 14, which is enough to reach a confident and wrong
  conclusion — it cost a full round of design argument on whether objectives
  relate to KPIs at all.

---

## Scope, settled with IMS

### The "Changes" sheet — out of scope

Every report has a fourth sheet (Changes Initiated or Led, Rationale, Planned
Date, Communication Evidences, Resources Allocated, Remark), empty in all four
files. Confirmed out of scope. No table, no import path. Do not re-raise.

### Report-level approval — in scope, not yet built

The signature block on every report is a real three-stage workflow: Prepared by
(department, possibly several people) → Approved by (CTO / Director of
Technology) → Received by (IMS Manager), each with its own date. Q2 IT was
prepared 07/09, approved 07/22, and never received — a stall that is completely
invisible in the sheet itself.

The unit of approval is the whole quarterly report, not an individual KPI or
risk, so it attaches to `(department, reporting_period)`:

    performance_reports           department_id, reporting_period_id (unique),
                                  status, submitted_at, approved_at,
                                  received_at, approved_by, received_by
    performance_report_preparers  report_id, profile_id   -- IT Q2 had three

This gives "closed" a per-department meaning: a quarter is closed for a
department when its report is received. Distinct from the document change
workflow in Epic 7, which is about revising controlled ISO documents.

Still open: what happens when the CTO declines to approve.

---

## Open with IMS

- **Eleven IT processes have KPIs but no risks.** Only Network Management,
  Email Threat, Patch Management and Remote Office Monitoring have risk
  coverage. May be a genuine gap in the register.
- **`Remote Office Monitoring`** appears as a risk group header in Q1 IT with no
  matching KPI process. Loaded as process 15. Confirm whether it's a process or
  just a governing document reference.
- **`fiscal_year_start_month = 1`** is confirmed by all four reports (Q1 =
  January–March), but worth a sanity check that MMCY doesn't also report on an
  Ethiopian fiscal year anywhere.
- **Objective 2 has no process and therefore no KPI coverage.** The other three
  IT objectives each improve a process that is already measured. Ask whether
  endpoint security becomes a process in its own right once rolled out, so it
  picks up KPIs like the others — and whether that is the general pattern for a
  completed objective.

---

## Process notes

### Migrations are append-only

Once a migration is applied — to your database or anyone's — you never edit it.
You write a new one. Editing an applied migration puts your local history out
of sync with the remote, and teammates' databases diverge from yours.

### Merge, pull, then branch

Branching off `main` while a migration PR is still open means your branch is
missing that file, and `db push` fails with "remote migration versions not
found in local migrations directory". This cost three separate detours.

**Do not** run the CLI's suggested fix (`migration repair --status reverted`
plus `db pull`) in that situation — it would mark applied work as un-applied
and overwrite local files. Merge the PR instead.

### `db push` succeeding does not mean your tables exist

An empty migration file pushes successfully and gets recorded as applied,
because doing nothing is not an error. This happened once: VS Code autosave was
off, the file on disk was empty at push time, and the migration was recorded
with no tables created. Recovery needed `supabase migration repair --status
reverted <version>` and a re-push.

**Always verify after pushing**, don't trust the exit code:

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by tablename;
```

### Statement order matters within a migration

A migration runs top to bottom. Anything referenced by a foreign key must be
created above the table referencing it. `units` pasted below `kpis` fails with
`relation "units" does not exist`.

### Regenerate types after every migration and commit them

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

Postgres enums become TypeScript unions (`"active" | "inactive"`), so schema
drift surfaces as a compile error rather than a runtime surprise. `text` plus a
check constraint would generate plain `string` — which is why enums were chosen
for closed value sets.

Note `>` creates the file but not its directory, and the redirect is set up
*before* the command runs — so a failed generation leaves a plausible-looking
broken file. Check `wc -l` afterwards.