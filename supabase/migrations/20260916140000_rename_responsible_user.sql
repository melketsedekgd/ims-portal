-- =============================================================
-- responsible_user → department_contributor
-- =============================================================
--
-- A label change, not a permission change. The key appears in no policy
-- and no function: a contributor's access comes from holding any role in a
-- department (my_department_ids()), never from this key by name.
--
-- Renamed in place rather than deleted and re-inserted: user_roles
-- references roles.id, so the existing assignments carry over untouched.

update roles
   set key         = 'department_contributor',
       name        = 'Department Contributor',
       description = 'Records measurements and raises change requests within one department. Cannot create, edit, retire or delete definitions.'
 where key = 'responsible_user';
