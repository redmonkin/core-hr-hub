-- Fix 1: Remove hardcoded admin emails from handle_new_user function
-- All new users will get default 'employee' role
-- Admins must be assigned manually via Supabase dashboard or UserRolesManager UI

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  
  -- Assign default employee role only - admins must be assigned via UserRolesManager UI
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  
  RETURN NEW;
END;
$$;

-- Fix 2: Replace permissive employee update policy with column-restricted version
-- Drop the old overly permissive policy
DROP POLICY IF EXISTS "Employees can update own contact info" ON public.employees;

-- Create new restricted policy that only allows updating safe contact fields
-- This uses column comparison to ensure protected fields cannot be modified
CREATE POLICY "Employees can update own safe fields only"
ON public.employees
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  -- Ensure critical fields are not changed by comparing with existing values
  -- We use a subquery to get the original row and verify protected columns match
  AND id = (SELECT e.id FROM employees e WHERE e.user_id = auth.uid() LIMIT 1)
  AND employee_code = (SELECT e.employee_code FROM employees e WHERE e.id = employees.id)
  AND email = (SELECT e.email FROM employees e WHERE e.id = employees.id)
  AND first_name = (SELECT e.first_name FROM employees e WHERE e.id = employees.id)
  AND last_name = (SELECT e.last_name FROM employees e WHERE e.id = employees.id)
  AND designation = (SELECT e.designation FROM employees e WHERE e.id = employees.id)
  AND hire_date = (SELECT e.hire_date FROM employees e WHERE e.id = employees.id)
  AND status = (SELECT e.status FROM employees e WHERE e.id = employees.id)
  AND (department_id IS NOT DISTINCT FROM (SELECT e.department_id FROM employees e WHERE e.id = employees.id))
  AND (manager_id IS NOT DISTINCT FROM (SELECT e.manager_id FROM employees e WHERE e.id = employees.id))
  AND (employment_type IS NOT DISTINCT FROM (SELECT e.employment_type FROM employees e WHERE e.id = employees.id))
);