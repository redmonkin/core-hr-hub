-- Directory-safe view over employees: exposes only fields needed for the
-- "Team Directory" (name, contact, designation, department, photo).
-- Views run with the creating role's privileges, so this bypasses the
-- row-level RLS on public.employees (which intentionally restricts full-row
-- visibility to admin/hr/managers) without exposing sensitive columns like
-- date_of_birth, gender, address, city, or country to every employee.
CREATE VIEW public.employee_directory AS
SELECT
  e.id,
  e.employee_code,
  e.first_name,
  e.last_name,
  e.email,
  e.phone,
  e.designation,
  e.hire_date,
  e.avatar_url,
  e.status,
  e.department_id,
  d.name AS department_name
FROM public.employees e
LEFT JOIN public.departments d ON d.id = e.department_id
WHERE public.is_not_blocked();

GRANT SELECT ON public.employee_directory TO authenticated;
