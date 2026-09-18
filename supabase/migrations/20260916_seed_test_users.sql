-- =====================================================================
-- IMS Portal: Test Seed Script
-- Run this in your Supabase Dashboard → SQL Editor
-- =====================================================================
-- This creates 2 departments + 5 test users with fixed credentials.
-- It is safe to run multiple times (uses ON CONFLICT).
-- =====================================================================

DO $$
DECLARE
  dept_a_id   UUID;
  dept_b_id   UUID;

  uid_admin     UUID := '00000000-0000-0001-0000-000000000001';
  uid_manager   UUID := '00000000-0000-0001-0000-000000000002';
  uid_writer    UUID := '00000000-0000-0001-0000-000000000003';
  uid_viewer    UUID := '00000000-0000-0001-0000-000000000004';
  uid_writer_b  UUID := '00000000-0000-0001-0000-000000000005';

  pw_hash TEXT;
BEGIN
  pw_hash := crypt('IMS@2026', gen_salt('bf'));

  -- ── Departments ──
  INSERT INTO public.departments (department_name)
  VALUES ('Engineering')
  ON CONFLICT DO NOTHING
  RETURNING id INTO dept_a_id;
  IF dept_a_id IS NULL THEN
    SELECT id INTO dept_a_id FROM public.departments WHERE department_name = 'Engineering' LIMIT 1;
  END IF;

  INSERT INTO public.departments (department_name)
  VALUES ('Operations')
  ON CONFLICT DO NOTHING
  RETURNING id INTO dept_b_id;
  IF dept_b_id IS NULL THEN
    SELECT id INTO dept_b_id FROM public.departments WHERE department_name = 'Operations' LIMIT 1;
  END IF;

  -- ── Auth users ──

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = uid_admin) THEN
    INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000',uid_admin,'authenticated','authenticated','admin@ims.test',pw_hash,now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','');
    INSERT INTO auth.identities (id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
    VALUES (gen_random_uuid(),uid_admin,uid_admin::text,format('{"sub":"%s","email":"admin@ims.test"}',uid_admin::text)::jsonb,'email',now(),now(),now());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = uid_manager) THEN
    INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000',uid_manager,'authenticated','authenticated','manager@ims.test',pw_hash,now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','');
    INSERT INTO auth.identities (id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
    VALUES (gen_random_uuid(),uid_manager,uid_manager::text,format('{"sub":"%s","email":"manager@ims.test"}',uid_manager::text)::jsonb,'email',now(),now(),now());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = uid_writer) THEN
    INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000',uid_writer,'authenticated','authenticated','writer@ims.test',pw_hash,now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','');
    INSERT INTO auth.identities (id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
    VALUES (gen_random_uuid(),uid_writer,uid_writer::text,format('{"sub":"%s","email":"writer@ims.test"}',uid_writer::text)::jsonb,'email',now(),now(),now());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = uid_viewer) THEN
    INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000',uid_viewer,'authenticated','authenticated','viewer@ims.test',pw_hash,now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','');
    INSERT INTO auth.identities (id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
    VALUES (gen_random_uuid(),uid_viewer,uid_viewer::text,format('{"sub":"%s","email":"viewer@ims.test"}',uid_viewer::text)::jsonb,'email',now(),now(),now());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = uid_writer_b) THEN
    INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000',uid_writer_b,'authenticated','authenticated','ops@ims.test',pw_hash,now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','');
    INSERT INTO auth.identities (id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
    VALUES (gen_random_uuid(),uid_writer_b,uid_writer_b::text,format('{"sub":"%s","email":"ops@ims.test"}',uid_writer_b::text)::jsonb,'email',now(),now(),now());
  END IF;

  -- ── Employees ──

  INSERT INTO public.employees (auth_user_id,firstname,lastname,email,role,department_id,is_active)
  VALUES (uid_admin,'Admin','User','admin@ims.test','SYSTEM_ADMIN',NULL,true)
  ON CONFLICT (email) DO UPDATE SET auth_user_id=uid_admin, role='SYSTEM_ADMIN';

  INSERT INTO public.employees (auth_user_id,firstname,lastname,email,role,department_id,is_active)
  VALUES (uid_manager,'Sarah','Manager','manager@ims.test','WRITER',dept_a_id,true)
  ON CONFLICT (email) DO UPDATE SET auth_user_id=uid_manager, department_id=dept_a_id;

  INSERT INTO public.employees (auth_user_id,firstname,lastname,email,role,department_id,is_active)
  VALUES (uid_writer,'John','Writer','writer@ims.test','WRITER',dept_a_id,true)
  ON CONFLICT (email) DO UPDATE SET auth_user_id=uid_writer, department_id=dept_a_id;

  INSERT INTO public.employees (auth_user_id,firstname,lastname,email,role,department_id,is_active)
  VALUES (uid_viewer,'Alex','Viewer','viewer@ims.test','VIEWER',dept_a_id,true)
  ON CONFLICT (email) DO UPDATE SET auth_user_id=uid_viewer, department_id=dept_a_id;

  INSERT INTO public.employees (auth_user_id,firstname,lastname,email,role,department_id,is_active)
  VALUES (uid_writer_b,'Mike','Ops','ops@ims.test','WRITER',dept_b_id,true)
  ON CONFLICT (email) DO UPDATE SET auth_user_id=uid_writer_b, department_id=dept_b_id;

  -- ── Set Sarah as Engineering manager ──
  UPDATE public.departments
  SET manager_id = (SELECT id FROM public.employees WHERE email = 'manager@ims.test')
  WHERE department_name = 'Engineering';

  RAISE NOTICE 'Done! 5 test users created.';
END;
$$;
