# IMS Portal — Agent Working Rules

This document defines the non-negotiable rules for every coding task on this repository.
Read this before touching any file.

## 1. Nothing Silent
Anything subjective — icon choices, color values, exact calculation formulas,
card content, dashboard metrics — must be **proposed and confirmed** before being built.
Do not guess at intent. Ask explicitly.

## 2. /department is Reference-Only
The route `/department` (the dashboard page) is the visual benchmark for the app.
Do **not** modify `src/app/department/page.tsx` or its child components unless
explicitly instructed. Study it to understand the target quality level.

## 3. Don't Break the Approval Workflow
The multi-step approval workflow in `src/lib/workflow.ts` is a core system.
If any feature touches `approval_requests`, `approval_actions`, or `notifications`,
stop and discuss before changing the underlying logic.

## 4. Report Before Commit
For every group of changes, produce a report in this format before committing:
1. What was understood.
2. What was built.
3. What was deferred, and why.
4. Assumptions made (flagged explicitly).
5. Proposed git commits (message + files).

## 5. Build Incrementally
Work one group at a time. Report after each group before starting the next.
Do not batch multiple groups into a single undiscussed commit.

## 6. Icon Set
The project uses **@phosphor-icons/react** exclusively. Never import from lucide-react.
Key mappings: Search→MagnifyingGlass, Trash2→Trash, AlertTriangle→Warning,
Building2→Buildings, Settings→Gear, ChevronDown→CaretDown, ChevronRight→CaretRight,
TrendingUp→TrendUp, Filter→Funnel, Eye→Eye, EyeOff→EyeSlash, Send→PaperPlaneRight.

## 7. Typography
- Body: Plus Jakarta Sans (CSS var: `--font-body`)
- Headings: Outfit (CSS var: `--font-heading`)
Use `font-sans` for body text, `font-heading` for page titles and card titles.

## 8. Confirmation Dialogs
Every destructive action (delete, bulk remove, status change that can't be undone)
**must** show a confirmation dialog before executing. No silent destructive operations.

## 9. Loading States
- Tables: Use `<TableSkeleton columns={N} rows={3} />` from `@/components/shared/TableSkeleton`.
- Cards: Use `<CardSkeleton />` from `@/components/shared/CardSkeleton`.

## 10. Tailwind v4 Notes
- No tailwind.config.ts — all config is in `src/app/globals.css`.
- Design tokens: `--coral: #E8624A`, `--ink: #1A1A2E`, `--coral-tint: #FEF0ED`.
- Font tokens: `--font-body`, `--font-heading`.
