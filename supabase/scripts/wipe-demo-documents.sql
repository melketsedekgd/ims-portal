-- Removes the document-workflow demo seed (20260929090200_demo_document_workflow),
-- children first. Keeps the four original seed documents.
begin;

delete from notifications where subject_id in (select id from document_change_requests);
delete from document_drafts;
delete from document_revisions;
delete from document_change_approvals;
delete from document_change_requests;

delete from documents
where name in ('Backup Management Procedure', 'Access Control Procedure',
               'Incident Management Procedure', 'Configuration Management Procedure',
               'Software Development Procedure', 'Help Desk and User Support Procedure',
               'Business Continuity Plan', 'IT Purchase Procedure');

update documents set status = 'active', current_revision = null
where name in ('Patch Management Work Instruction', 'Remote Office Monitoring Work Instruction',
               'Network Management Procedure', 'Email Threat Management Procedure');

commit;
