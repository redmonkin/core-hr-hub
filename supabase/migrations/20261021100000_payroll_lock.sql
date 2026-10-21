-- Payroll records are final once processed: the payslip can be downloaded, so
-- its amounts can't change afterwards. To correct one, revert it to pending
-- (draft) first, edit it, then process it again. Status changes themselves
-- (processed -> paid, or back to draft) are still allowed.

CREATE OR REPLACE FUNCTION public.guard_payroll_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_end_user_request() OR OLD.status = 'draft' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'This payroll is % and can''t be deleted. Revert it to pending first.', OLD.status
      USING ERRCODE = '42501';
  END IF;

  IF public.changed_outside(to_jsonb(OLD), to_jsonb(NEW), ARRAY['status', 'paid_at']) THEN
    RAISE EXCEPTION 'This payroll is % and locked. Revert it to pending to edit it.', OLD.status
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_payroll_record
  BEFORE UPDATE OR DELETE ON public.payroll_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_payroll_record();
