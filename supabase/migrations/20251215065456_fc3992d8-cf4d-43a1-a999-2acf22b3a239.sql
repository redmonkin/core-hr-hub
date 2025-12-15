-- Create attendance records table
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in TIMESTAMP WITH TIME ZONE,
  clock_out TIMESTAMP WITH TIME ZONE,
  total_hours NUMERIC(5,2),
  status VARCHAR(20) NOT NULL DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- Enable RLS
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Employees can view their own attendance
CREATE POLICY "Employees view own attendance"
ON public.attendance_records
FOR SELECT
USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

-- Employees can insert/update their own attendance
CREATE POLICY "Employees manage own attendance"
ON public.attendance_records
FOR ALL
USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

-- Admin/HR can manage all attendance
CREATE POLICY "Admin/HR manage all attendance"
ON public.attendance_records
FOR ALL
USING (is_admin_or_hr(auth.uid()));

-- Managers can view team attendance
CREATE POLICY "Managers view team attendance"
ON public.attendance_records
FOR SELECT
USING (employee_id IN (
  SELECT id FROM public.employees 
  WHERE manager_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
));

-- Add trigger for updated_at
CREATE TRIGGER update_attendance_records_updated_at
BEFORE UPDATE ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();