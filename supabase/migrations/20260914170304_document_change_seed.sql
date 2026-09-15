-- The four governing documents the quarterly reports name, one per IT
-- process that has one. 12 processes name none and get nothing. Owner is
-- the IT department's test manager; current_revision and document_number
-- stay NULL — the reports never state them.
insert into documents (department_id, process_id, name, owner_id)
select p.department_id,
       p.id,
       p.governing_document,
       (select ur.profile_id
          from user_roles ur
          join roles r on r.id = ur.role_id
         where r.key = 'department_manager'
           and ur.department_id = p.department_id
         limit 1)
from processes p
where p.governing_document is not null
  and p.status = 'active';
