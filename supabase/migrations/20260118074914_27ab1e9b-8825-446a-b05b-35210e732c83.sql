-- Create salary history table to track all salary revisions
CREATE TABLE public.salary_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  basic_salary NUMERIC NOT NULL,
  hra NUMERIC DEFAULT 0,
  transport_allowance NUMERIC DEFAULT 0,
  medical_allowance NUMERIC DEFAULT 0,
  other_allowances NUMERIC DEFAULT 0,
  tax_deduction NUMERIC DEFAULT 0,
  other_deductions NUMERIC DEFAULT 0,
  effective_from DATE NOT NULL,
  effective_to DATE,
  change_reason TEXT,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_salary_history_employee_id ON public.salary_history(employee_id);
CREATE INDEX idx_salary_history_effective_from ON public.salary_history(effective_from DESC);

-- Enable RLS
ALTER TABLE public.salary_history ENABLE ROW LEVEL SECURITY;

-- Admin/HR can manage all salary history
CREATE POLICY "Admin/HR manage salary history"
  ON public.salary_history
  FOR ALL
  USING (is_admin_or_hr(auth.uid()));

-- Employees can view their own salary history
CREATE POLICY "View own salary history"
  ON public.salary_history
  FOR SELECT
  USING (
    is_admin_or_hr(auth.uid()) OR 
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
  );

-- Create function to automatically archive salary when structure changes
CREATE OR REPLACE FUNCTION public.archive_salary_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only archive if there's an actual salary change
  IF OLD.basic_salary IS DISTINCT FROM NEW.basic_salary OR
     OLD.hra IS DISTINCT FROM NEW.hra OR
     OLD.transport_allowance IS DISTINCT FROM NEW.transport_allowance OR
     OLD.medical_allowance IS DISTINCT FROM NEW.medical_allowance OR
     OLD.other_allowances IS DISTINCT FROM NEW.other_allowances OR
     OLD.tax_deduction IS DISTINCT FROM NEW.tax_deduction OR
     OLD.other_deductions IS DISTINCT FROM NEW.other_deductions THEN
    
    -- Insert old salary into history with effective_to as new effective_from - 1 day
    INSERT INTO public.salary_history (
      employee_id,
      basic_salary,
      hra,
      transport_allowance,
      medical_allowance,
      other_allowances,
      tax_deduction,
      other_deductions,
      effective_from,
      effective_to,
      changed_by
    ) VALUES (
      OLD.employee_id,
      OLD.basic_salary,
      OLD.hra,
      OLD.transport_allowance,
      OLD.medical_allowance,
      OLD.other_allowances,
      OLD.tax_deduction,
      OLD.other_deductions,
      OLD.effective_from,
      NEW.effective_from - INTERVAL '1 day',
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for salary structure updates
CREATE TRIGGER archive_salary_history
  BEFORE UPDATE ON public.salary_structures
  FOR EACH ROW
  EXECUTE FUNCTION public.archive_salary_on_update();