-- =============================================================
-- ims_reviewer → folded into ims_admin
-- =============================================================
--
-- There are no layers inside IMS. Everyone in IMS has the same role and
-- sees the same thing, so a second IMS tier is a role that drifts out of
-- step with the one that is actually used. This is the same fold that
-- 20260916140100 performed on system_admin, for the same reason.
--
-- is_ims() keeps its name and every one of the 15 policies that call it
-- keeps its definition. Only the body changes, from two role keys to one,
-- which is what makes this a rename of a set rather than a permission
-- change: after this migration is_ims() and is_ims_admin() are the same
-- predicate, and the policies that distinguished a read tier from a write
-- tier inside IMS no longer distinguish anything.
--
-- The assignment moves before the role is deleted: user_roles.role_id is a
-- foreign key, and a reviewer left holding the row would either block the
-- delete or lose their access to the system entirely.

-- -------------------------------------------------------------
-- 1. The assignment
-- -------------------------------------------------------------

do $$
declare
  moved integer;
begin
  update user_roles ur
     set role_id = (select id from roles where key = 'ims_admin')
   where ur.role_id = (select id from roles where key = 'ims_reviewer');
  get diagnostics moved = row_count;

  -- Recorded rather than asserted: the count is data, not a rule. One row
  -- today (ims-reviewer@ex.com); zero is equally valid on an environment
  -- where nobody ever held the role.
  raise notice 'moved % ims_reviewer assignment(s) to ims_admin', moved;
end $$;

-- -------------------------------------------------------------
-- 2. The function
-- -------------------------------------------------------------

create or replace function is_ims()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_role(array['ims_admin']);
$$;

comment on function is_ims() is
  'Holds ims_admin. There is one IMS role and no read-only tier below it; '
  'is_ims_admin() is the same predicate, kept because the policies that '
  'call each one were written for different reasons.';

-- ims_reviewer is gone, so a comment excluding it describes nothing.
comment on function is_ims_admin() is
  'IMS admin only. The only IMS role — see is_ims().';

-- -------------------------------------------------------------
-- 3. The row
-- -------------------------------------------------------------

do $$
declare
  assigned integer;
  removed  integer;
begin
  select count(*) into assigned
    from user_roles ur join roles r on r.id = ur.role_id
   where r.key = 'ims_reviewer';
  if assigned > 0 then
    raise exception 'ims_reviewer is still assigned to % user(s); refusing to delete it', assigned;
  end if;

  delete from roles where key = 'ims_reviewer';
  get diagnostics removed = row_count;
  if removed <> 1 then
    raise exception 'expected to delete exactly one ims_reviewer role row, deleted %', removed;
  end if;
end $$;
