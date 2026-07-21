-- Rename the generic "other_deductions" column to a dedicated PF (Provident
-- Fund) deduction field, per HR request to label this line item explicitly
-- rather than leaving it as a vague catch-all.
ALTER TABLE public.salary_structures RENAME COLUMN other_deductions TO pf_deduction;
ALTER TABLE public.salary_history RENAME COLUMN other_deductions TO pf_deduction;

CREATE OR REPLACE FUNCTION public.archive_salary_on_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.basic_salary IS DISTINCT FROM NEW.basic_salary OR
     OLD.hra IS DISTINCT FROM NEW.hra OR
     OLD.transport_allowance IS DISTINCT FROM NEW.transport_allowance OR
     OLD.medical_allowance IS DISTINCT FROM NEW.medical_allowance OR
     OLD.other_allowances IS DISTINCT FROM NEW.other_allowances OR
     OLD.tax_deduction IS DISTINCT FROM NEW.tax_deduction OR
     OLD.pf_deduction IS DISTINCT FROM NEW.pf_deduction THEN

    INSERT INTO public.salary_history (
      employee_id,
      basic_salary,
      hra,
      transport_allowance,
      medical_allowance,
      other_allowances,
      tax_deduction,
      pf_deduction,
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
      OLD.pf_deduction,
      OLD.effective_from,
      NEW.effective_from - INTERVAL '1 day',
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
