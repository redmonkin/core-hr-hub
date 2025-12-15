-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Managers view direct reports" ON public.employees;
DROP POLICY IF EXISTS "Employees view own record" ON public.employees;
DROP POLICY IF EXISTS "Admin/HR manage employees" ON public.employees;

-- Create a security definer function to check if user is manager of an employee
CREATE OR REPLACE FUNCTION public.is_manager_of(_employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = _employee_id
      AND e.manager_id IN (
        SELECT id FROM public.employees WHERE user_id = auth.uid()
      )
  )
$$;

-- Create a security definer function to get current user's employee id
CREATE OR REPLACE FUNCTION public.get_my_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1
$$;

-- Recreate policies without recursion
CREATE POLICY "Employees view own record" 
ON public.employees 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admin/HR manage employees" 
ON public.employees 
FOR ALL 
USING (is_admin_or_hr(auth.uid()));

CREATE POLICY "Managers view direct reports" 
ON public.employees 
FOR SELECT 
USING (manager_id = get_my_employee_id());

-- Also fix the leave_requests policies that reference employees
DROP POLICY IF EXISTS "View leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Create own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Update leave requests" ON public.leave_requests;

CREATE POLICY "View leave requests" 
ON public.leave_requests 
FOR SELECT 
USING (
  is_admin_or_hr(auth.uid()) 
  OR employee_id = get_my_employee_id()
  OR is_manager_of(employee_id)
);

CREATE POLICY "Create own leave requests" 
ON public.leave_requests 
FOR INSERT 
WITH CHECK (employee_id = get_my_employee_id());

CREATE POLICY "Update leave requests" 
ON public.leave_requests 
FOR UPDATE 
USING (
  is_admin_or_hr(auth.uid()) 
  OR is_manager_of(employee_id)
);

-- Fix payroll_records policies
DROP POLICY IF EXISTS "View payroll records" ON public.payroll_records;

CREATE POLICY "View payroll records" 
ON public.payroll_records 
FOR SELECT 
USING (
  is_admin_or_hr(auth.uid()) 
  OR employee_id = get_my_employee_id()
);