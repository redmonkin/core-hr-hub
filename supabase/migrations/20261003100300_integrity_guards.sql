-- Server-side integrity rules for self-service writes.
--
-- RLS decides which rows someone may write; these triggers decide which
-- values. They only constrain requests made by end users through the API
-- (auth.role() = 'authenticated'); the service role, cron jobs and the SQL
-- editor are unaffected. Holders of the module's "manage" permission are
-- exempt, since they're allowed to correct anything.

-- ---------------------------------------------------------------------------
-- Helper: did any column outside _allowed change?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.changed_outside(_old jsonb, _new jsonb, _allowed text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (_old - _allowed) IS DISTINCT FROM (_new - _allowed)
$$;

CREATE OR REPLACE FUNCTION public.is_end_user_request()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.role() = 'authenticated', false)
$$;

-- ---------------------------------------------------------------------------
-- Leave requests: employees can't submit pre-approved or negative requests
-- ---------------------------------------------------------------------------
ALTER TABLE public.leave_requests
  ADD CONSTRAINT leave_requests_days_positive CHECK (days_count > 0) NOT VALID,
  ADD CONSTRAINT leave_requests_dates_ordered CHECK (end_date >= start_date) NOT VALID;

CREATE OR REPLACE FUNCTION public.guard_leave_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_end_user_request() OR public.can('leaves', 'manage') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.review_notes := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE by a manager: decide on the request, don't rewrite it
  IF public.changed_outside(to_jsonb(OLD), to_jsonb(NEW),
       ARRAY['status', 'reviewed_by', 'reviewed_at', 'review_notes', 'updated_at']) THEN
    RAISE EXCEPTION 'Managers can only approve or reject leave requests.' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.reviewed_by := public.get_my_employee_id();
    NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_leave_request
  BEFORE INSERT OR UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_leave_request();

-- ---------------------------------------------------------------------------
-- Reimbursements: same idea; only finance (reimbursements:manage) marks paid
-- ---------------------------------------------------------------------------
ALTER TABLE public.reimbursement_requests
  ADD CONSTRAINT reimbursement_requests_amount_positive CHECK (amount > 0) NOT VALID;

CREATE OR REPLACE FUNCTION public.guard_reimbursement_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_end_user_request() OR public.can('reimbursements', 'manage') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.review_notes := NULL;
    NEW.paid_at := NULL;
    NEW.paid_by := NULL;
    RETURN NEW;
  END IF;

  IF public.changed_outside(to_jsonb(OLD), to_jsonb(NEW),
       ARRAY['status', 'reviewed_by', 'reviewed_at', 'review_notes', 'updated_at']) THEN
    RAISE EXCEPTION 'Managers can only approve or reject reimbursement requests.' USING ERRCODE = '42501';
  END IF;
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    RAISE EXCEPTION 'Only users who manage reimbursements can mark a request as paid.' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.reviewed_by := public.get_my_employee_id();
    NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_reimbursement_request
  BEFORE INSERT OR UPDATE ON public.reimbursement_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_reimbursement_request();

-- ---------------------------------------------------------------------------
-- Employees: self-service edits are limited to personal contact fields
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_employee_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_end_user_request()
     OR public.can('employees', 'manage')
     OR public.can('onboarding', 'manage') THEN
    RETURN NEW;
  END IF;

  IF public.changed_outside(to_jsonb(OLD), to_jsonb(NEW),
       ARRAY['phone', 'address', 'city', 'country', 'date_of_birth', 'gender', 'avatar_url', 'updated_at']) THEN
    RAISE EXCEPTION 'You can only update your personal contact details. Ask HR to change anything else.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_employee_self_update
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.guard_employee_self_update();

-- ---------------------------------------------------------------------------
-- Bank details move out of employees, so the many people who can read an
-- employee row (managers, module admins) no longer see account numbers.
-- Only the employee, payroll and employee managers can read them; only
-- HR/payroll can change them, and every change records who made it.
-- ---------------------------------------------------------------------------
CREATE TABLE public.employee_bank_details (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  bank_name text,
  bank_account_number text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.employee_bank_details (employee_id, bank_name, bank_account_number)
SELECT id, bank_name, bank_account_number
FROM public.employees
WHERE bank_name IS NOT NULL OR bank_account_number IS NOT NULL;

ALTER TABLE public.employees DROP COLUMN bank_name, DROP COLUMN bank_account_number;

CREATE OR REPLACE FUNCTION public.stamp_bank_details_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  RETURN NEW;
END;
$$;

CREATE TRIGGER stamp_bank_details_change
  BEFORE INSERT OR UPDATE ON public.employee_bank_details
  FOR EACH ROW EXECUTE FUNCTION public.stamp_bank_details_change();

ALTER TABLE public.employee_bank_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny blocked users" ON public.employee_bank_details AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_not_blocked()) WITH CHECK (public.is_not_blocked());
CREATE POLICY "View bank details" ON public.employee_bank_details FOR SELECT TO authenticated
  USING (
    employee_id = public.get_my_employee_id()
    OR public.can('payroll', 'view')
    OR public.can('employees', 'manage')
  );
CREATE POLICY "Manage bank details" ON public.employee_bank_details FOR ALL TO authenticated
  USING (public.can('payroll', 'manage') OR public.can('employees', 'manage'))
  WITH CHECK (public.can('payroll', 'manage') OR public.can('employees', 'manage'));

-- ---------------------------------------------------------------------------
-- Attendance: employees clock in/out now; they can't backdate or edit history
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_attendance_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _break_hours numeric;
BEGIN
  IF NOT public.is_end_user_request() OR public.can('attendance', 'manage') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.clock_in IS NULL OR abs(extract(epoch FROM (NEW.clock_in - now()))) > 600 THEN
      RAISE EXCEPTION 'Clock-in time must be the current time.' USING ERRCODE = '42501';
    END IF;
    -- the client sends its local date; allow for time zones either side of UTC
    IF NEW.date NOT BETWEEN current_date - 1 AND current_date + 1 THEN
      RAISE EXCEPTION 'You can only record attendance for today.' USING ERRCODE = '42501';
    END IF;
    NEW.status := 'present';
    NEW.clock_out := NULL;
    NEW.total_hours := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE: the only self-service change is clocking out, once
  IF OLD.clock_out IS NOT NULL THEN
    IF public.changed_outside(to_jsonb(OLD), to_jsonb(NEW), ARRAY['notes', 'updated_at']) THEN
      RAISE EXCEPTION 'This attendance record is closed. Ask HR to correct it.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF public.changed_outside(to_jsonb(OLD), to_jsonb(NEW), ARRAY[
       'clock_out', 'clock_out_latitude', 'clock_out_longitude', 'clock_out_location_name',
       'total_hours', 'notes', 'updated_at']) THEN
    RAISE EXCEPTION 'You can only clock out of an open attendance record.' USING ERRCODE = '42501';
  END IF;

  IF NEW.clock_out IS NOT NULL THEN
    -- clock-out may be in the past (forgotten clock-out closed at shift end)
    -- but never in the future or before clock-in
    IF NEW.clock_out <= NEW.clock_in OR NEW.clock_out > now() + interval '10 minutes' THEN
      RAISE EXCEPTION 'Clock-out time must be after clock-in and not in the future.' USING ERRCODE = '42501';
    END IF;
    SELECT COALESCE(sum(extract(epoch FROM (COALESCE(b.resume_time, NEW.clock_out) - b.pause_time))), 0) / 3600
      INTO _break_hours
      FROM public.attendance_breaks b
      WHERE b.attendance_record_id = NEW.id;
    NEW.total_hours := round(greatest(0, extract(epoch FROM (NEW.clock_out - NEW.clock_in)) / 3600 - _break_hours)::numeric, 2);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_attendance_record
  BEFORE INSERT OR UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_attendance_record();

CREATE OR REPLACE FUNCTION public.guard_attendance_break()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_end_user_request() OR public.can('attendance', 'manage') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF abs(extract(epoch FROM (NEW.pause_time - now()))) > 600 THEN
      RAISE EXCEPTION 'Break start must be the current time.' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (SELECT 1 FROM public.attendance_records WHERE id = NEW.attendance_record_id AND clock_out IS NOT NULL) THEN
      RAISE EXCEPTION 'You have already clocked out.' USING ERRCODE = '42501';
    END IF;
    NEW.resume_time := NULL;
    RETURN NEW;
  END IF;

  IF OLD.resume_time IS NOT NULL
     OR public.changed_outside(to_jsonb(OLD), to_jsonb(NEW), ARRAY[
          'resume_time', 'resume_latitude', 'resume_longitude', 'resume_location_name'])
  THEN
    RAISE EXCEPTION 'You can only end an open break.' USING ERRCODE = '42501';
  END IF;
  IF NEW.resume_time IS NOT NULL
     AND (NEW.resume_time < NEW.pause_time OR NEW.resume_time > now() + interval '10 minutes') THEN
    RAISE EXCEPTION 'Break end must be after the break started and not in the future.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_attendance_break
  BEFORE INSERT OR UPDATE ON public.attendance_breaks
  FOR EACH ROW EXECUTE FUNCTION public.guard_attendance_break();

-- ---------------------------------------------------------------------------
-- Performance: employees rate themselves, managers rate their reports
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_rating_ownership(
  _employee_id uuid,
  _old_employee_rating integer, _new_employee_rating integer,
  _old_manager_rating integer, _new_manager_rating integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_end_user_request() OR public.can('performance', 'manage') THEN
    RETURN;
  END IF;
  IF _new_manager_rating IS DISTINCT FROM _old_manager_rating
     AND NOT public.is_manager_of(_employee_id) THEN
    RAISE EXCEPTION 'Only the employee''s manager can set the manager rating.' USING ERRCODE = '42501';
  END IF;
  IF _new_employee_rating IS DISTINCT FROM _old_employee_rating
     AND _employee_id IS DISTINCT FROM public.get_my_employee_id() THEN
    RAISE EXCEPTION 'Only the employee can set their own rating.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_goal_ratings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.guard_rating_ownership(NEW.employee_id, NULL, NEW.employee_rating, NULL, NEW.manager_rating);
  ELSE
    IF NEW.employee_id IS DISTINCT FROM OLD.employee_id AND public.is_end_user_request()
       AND NOT public.can('performance', 'manage') THEN
      RAISE EXCEPTION 'Goals can''t be moved to another employee.' USING ERRCODE = '42501';
    END IF;
    PERFORM public.guard_rating_ownership(NEW.employee_id, OLD.employee_rating, NEW.employee_rating,
                                          OLD.manager_rating, NEW.manager_rating);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_goal_ratings
  BEFORE INSERT OR UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.guard_goal_ratings();

CREATE OR REPLACE FUNCTION public.guard_kpi_ratings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _employee_id uuid;
BEGIN
  SELECT employee_id INTO _employee_id FROM public.performance_reviews WHERE id = NEW.review_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.guard_rating_ownership(_employee_id, NULL, NEW.employee_rating, NULL, NEW.manager_rating);
  ELSE
    IF (NEW.review_id IS DISTINCT FROM OLD.review_id OR NEW.goal_id IS DISTINCT FROM OLD.goal_id)
       AND public.is_end_user_request() AND NOT public.can('performance', 'manage') THEN
      RAISE EXCEPTION 'KPI ratings can''t be moved to another review or goal.' USING ERRCODE = '42501';
    END IF;
    PERFORM public.guard_rating_ownership(_employee_id, OLD.employee_rating, NEW.employee_rating,
                                          OLD.manager_rating, NEW.manager_rating);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_kpi_ratings
  BEFORE INSERT OR UPDATE ON public.review_kpi_ratings
  FOR EACH ROW EXECUTE FUNCTION public.guard_kpi_ratings();

-- Employees can acknowledge their own review and nothing else; managers can't
-- acknowledge on the employee's behalf. (Acknowledging used to silently fail
-- because employees had no UPDATE policy at all.)
CREATE OR REPLACE FUNCTION public.guard_performance_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := public.get_my_employee_id();
BEGIN
  IF NOT public.is_end_user_request() OR public.can('performance', 'manage') THEN
    RETURN NEW;
  END IF;

  IF OLD.employee_id = _me THEN
    IF NEW.status <> 'acknowledged'
       OR OLD.status = 'draft'
       OR public.changed_outside(to_jsonb(OLD), to_jsonb(NEW),
            ARRAY['status', 'acknowledged_at', 'acknowledged_by', 'updated_at']) THEN
      RAISE EXCEPTION 'You can only acknowledge a submitted review.' USING ERRCODE = '42501';
    END IF;
    NEW.acknowledged_at := now();
    NEW.acknowledged_by := auth.uid();
    RETURN NEW;
  END IF;

  -- reviewer (manager) path
  IF NEW.employee_id IS DISTINCT FROM OLD.employee_id
     OR NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id
     OR NEW.acknowledged_at IS DISTINCT FROM OLD.acknowledged_at
     OR NEW.acknowledged_by IS DISTINCT FROM OLD.acknowledged_by
     OR (NEW.status = 'acknowledged' AND OLD.status IS DISTINCT FROM 'acknowledged') THEN
    RAISE EXCEPTION 'Reviewers can''t reassign or acknowledge reviews.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_performance_review
  BEFORE UPDATE ON public.performance_reviews
  FOR EACH ROW EXECUTE FUNCTION public.guard_performance_review();

-- Reviews created by managers must name them as the reviewer.
CREATE OR REPLACE FUNCTION public.guard_performance_review_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_end_user_request() AND NOT public.can('performance', 'manage') THEN
    NEW.reviewer_id := public.get_my_employee_id();
    NEW.acknowledged_at := NULL;
    NEW.acknowledged_by := NULL;
    IF NEW.status = 'acknowledged' THEN
      NEW.status := 'draft';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_performance_review_insert
  BEFORE INSERT ON public.performance_reviews
  FOR EACH ROW EXECUTE FUNCTION public.guard_performance_review_insert();

-- ---------------------------------------------------------------------------
-- Onboarding requests: documents must be the applicant's own uploads
-- (otherwise HR approval would copy someone else's ID proof to the attacker)
-- ---------------------------------------------------------------------------
ALTER TABLE public.onboarding_requests
  ADD COLUMN submission_notified_at timestamptz;

CREATE OR REPLACE FUNCTION public.guard_onboarding_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prefix text := NEW.user_id::text || '/';
BEGIN
  IF left(NEW.resume_url, length(_prefix)) <> _prefix
     OR left(NEW.offer_letter_url, length(_prefix)) <> _prefix
     OR left(NEW.id_proof_url, length(_prefix)) <> _prefix
     OR NEW.resume_url LIKE '%..%' OR NEW.offer_letter_url LIKE '%..%' OR NEW.id_proof_url LIKE '%..%'
  THEN
    RAISE EXCEPTION 'Onboarding documents must be uploaded by the applicant.' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' AND public.is_end_user_request() THEN
    NEW.status := 'pending';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.submission_notified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_onboarding_request
  BEFORE INSERT OR UPDATE ON public.onboarding_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_onboarding_request();

REVOKE EXECUTE ON FUNCTION public.guard_rating_ownership(uuid, integer, integer, integer, integer) FROM authenticated;
