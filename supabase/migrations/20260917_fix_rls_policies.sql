-- =====================================================================
-- IMS Portal: Fix Missing RLS Policies
-- Run this in your Supabase Dashboard → SQL Editor
-- =====================================================================
-- Since the `employees` table was likely created via the dashboard, 
-- we need to ensure RLS is enabled and allows authenticated users 
-- to read the employee data.
-- =====================================================================

-- 1. Enable RLS on the tables we query heavily
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies just in case to prevent duplicates
DROP POLICY IF EXISTS "Allow all authenticated users to read employees" ON public.employees;
DROP POLICY IF EXISTS "Allow all authenticated users to read departments" ON public.departments;
DROP POLICY IF EXISTS "Allow authenticated users to read approval requests" ON public.approval_requests;

-- 3. Create permissive READ policies for authenticated users
-- (Our application handles the actual ABAC filtering in the queries)
CREATE POLICY "Allow all authenticated users to read employees" 
ON public.employees FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow all authenticated users to read departments" 
ON public.departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read approval requests" 
ON public.approval_requests FOR SELECT TO authenticated USING (true);

-- 4. Create permissive WRITE policies for authenticated users
-- (In a production app you would lock this down further based on roles)
CREATE POLICY "Allow authenticated to insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated to update employees" ON public.employees FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert departments" ON public.departments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated to update departments" ON public.departments FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert approval_requests" ON public.approval_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated to update approval_requests" ON public.approval_requests FOR UPDATE TO authenticated USING (true);

