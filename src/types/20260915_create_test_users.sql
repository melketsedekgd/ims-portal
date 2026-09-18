-- Run this in your Supabase SQL Editor to create auth users for testing

-- Create a temporary password hash (password: 'password123')
DO $$
DECLARE
    emp RECORD;
    new_user_id UUID;
    encrypted_pw TEXT;
BEGIN
    -- This is a bcrypt hash for 'password123'
    encrypted_pw := crypt('password123', gen_salt('bf'));

    FOR emp IN SELECT * FROM public.employees WHERE auth_user_id IS NULL
    LOOP
        new_user_id := gen_random_uuid();
        
        -- Insert into auth.users
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, 
            email_confirmed_at, recovery_sent_at, last_sign_in_at, 
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
            confirmation_token, email_change, email_change_token_new, recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', emp.email, encrypted_pw, 
            now(), now(), now(), 
            '{"provider":"email","providers":["email"]}', '{}', now(), now(), 
            '', '', '', ''
        );

        -- Insert into auth.identities
        INSERT INTO auth.identities (
            id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), new_user_id, format('{"sub":"%s","email":"%s"}', new_user_id::text, emp.email)::jsonb, 'email', now(), now(), now()
        );

        -- Update the employee record
        UPDATE public.employees SET auth_user_id = new_user_id WHERE id = emp.id;
    END LOOP;
END;
$$;
