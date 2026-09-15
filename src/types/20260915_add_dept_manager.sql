-- Add manager_id to departments
ALTER TABLE public.departments
ADD COLUMN manager_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

-- Comment for clarity
COMMENT ON COLUMN public.departments.manager_id IS 'The employee ID of the department head/manager. Used for delegated workflow routing.';
