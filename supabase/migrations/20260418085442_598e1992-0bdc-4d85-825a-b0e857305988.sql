-- Create employee leave eligibility table (opt-in list)
CREATE TABLE public.employee_leave_eligibility (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL,
  leave_type_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE (employee_id, leave_type_id)
);

CREATE INDEX idx_ele_employee ON public.employee_leave_eligibility(employee_id);
CREATE INDEX idx_ele_leave_type ON public.employee_leave_eligibility(leave_type_id);

ALTER TABLE public.employee_leave_eligibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/HR manage leave eligibility"
ON public.employee_leave_eligibility
FOR ALL
TO authenticated
USING (public.is_admin_or_hr(auth.uid()))
WITH CHECK (public.is_admin_or_hr(auth.uid()));

CREATE POLICY "View leave eligibility"
ON public.employee_leave_eligibility
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_hr(auth.uid())
  OR employee_id = public.get_my_employee_id()
  OR public.is_manager_of(employee_id)
);