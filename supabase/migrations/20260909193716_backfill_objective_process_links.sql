-- supabase/migrations/<timestamp>_backfill_objective_process_links.sql

update objectives o
set process_id = p.id
from processes p
join departments d on d.id = p.department_id
where o.department_id = d.id
  and d.code = 'IT'
  and p.name = 'Access Control'
  and o.title like 'Strengthen access control%';

update objectives o
set process_id = p.id
from processes p
join departments d on d.id = p.department_id
where o.department_id = d.id
  and d.code = 'IT'
  and p.name = 'Loging and Monitoring'
  and o.title like 'Improve security visibility%';

update objectives o
set process_id = p.id
from processes p
join departments d on d.id = p.department_id
where o.department_id = d.id
  and d.code = 'IT'
  and p.name = 'Patch Management'
  and o.title like 'Reduce security risk%';

-- SRD has exactly one process; all five objectives belong to it
update objectives o
set process_id = p.id
from processes p
join departments d on d.id = p.department_id
where o.department_id = d.id
  and d.code = 'SRD'
  and p.name = 'Software Development';