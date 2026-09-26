-- Enums for Excel import of KPI results. On their own, ahead of the tables
-- that use them.

-- draft → committed (via commit_import) or cancelled (by its creator).
create type import_batch_status as enum ('draft', 'committed', 'cancelled');

-- ready / check / excluded are set while reviewing a draft; imported and
-- skipped only by commit_import.
create type import_row_status as enum ('ready', 'check', 'excluded', 'imported', 'skipped');
