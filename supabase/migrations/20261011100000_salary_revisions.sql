-- Salary revisions: every pay change after the initial salary is a revision
-- with a type, reason and effective date (optionally linked to a performance
-- review). It takes effect on its date: future-dated revisions wait as
-- 'scheduled' and a daily job applies them; backdated ones add arrears to the
-- next payroll, and a revision part-way through a month that hasn't been run
-- yet prorates it. Revisions can require approval by someone else
-- (organization setting 'salary_revision_approval').
--
-- Payroll records now keep the salary components they were generated with, so
-- a later revision never changes an old payslip.

-- ---------------------------------------------------------------------------
-- Payroll records: components as generated, plus revision adjustments
-- ---------------------------------------------------------------------------
ALTER TABLE public.payroll_records
  ADD COLUMN hra numeric(12, 2),
  ADD COLUMN transport_allowance numeric(12, 2),
  ADD COLUMN medical_allowance numeric(12, 2),
  ADD COLUMN other_allowances numeric(12, 2),
  ADD COLUMN tax_deduction numeric(12, 2),
  ADD COLUMN pf_deduction numeric(12, 2),
  ADD COLUMN adjustment_amount numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN adjustment_note text;

COMMENT ON COLUMN public.payroll_records.adjustment_amount IS
  'Salary revision arrears (positive) or proration for a revision part-way through the month (negative); included in net_salary.';

-- ---------------------------------------------------------------------------
-- Approval switch (off by default; admins change it in Settings)
-- ---------------------------------------------------------------------------
INSERT INTO public.organization_settings (setting_key, setting_value)
VALUES ('salary_revision_approval', '{"enabled": false}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.salary_revision_approval_required()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (setting_value ->> 'enabled')::boolean FROM public.organization_settings
     WHERE setting_key = 'salary_revision_approval'),
    false)
$$;

-- Only admins turn approval on or off
CREATE OR REPLACE FUNCTION public.guard_salary_revision_approval_setting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_end_user_request() AND NOT public.is_admin()
     AND 'salary_revision_approval' IN (COALESCE(NEW.setting_key, ''), COALESCE(OLD.setting_key, '')) THEN
    RAISE EXCEPTION 'Only admins can change salary revision approval.' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER guard_salary_revision_approval_setting
  BEFORE INSERT OR UPDATE OR DELETE ON public.organization_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_salary_revision_approval_setting();

-- ---------------------------------------------------------------------------
-- Revisions
-- ---------------------------------------------------------------------------
CREATE TYPE public.salary_revision_type AS ENUM ('annual_appraisal', 'promotion', 'market_correction', 'adjustment', 'other');
CREATE TYPE public.salary_revision_status AS ENUM ('pending_approval', 'scheduled', 'applied', 'rejected', 'cancelled');

CREATE TABLE public.salary_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  revision_type public.salary_revision_type NOT NULL,
  status public.salary_revision_status NOT NULL DEFAULT 'scheduled',
  effective_from date NOT NULL,
  reason text CHECK (reason IS NULL OR length(reason) <= 2000),
  performance_review_id uuid REFERENCES public.performance_reviews(id) ON DELETE SET NULL,
  basic_salary numeric(12, 2) NOT NULL CHECK (basic_salary >= 0),
  hra numeric(12, 2) NOT NULL DEFAULT 0 CHECK (hra >= 0),
  transport_allowance numeric(12, 2) NOT NULL DEFAULT 0 CHECK (transport_allowance >= 0),
  medical_allowance numeric(12, 2) NOT NULL DEFAULT 0 CHECK (medical_allowance >= 0),
  other_allowances numeric(12, 2) NOT NULL DEFAULT 0 CHECK (other_allowances >= 0),
  tax_deduction numeric(12, 2) NOT NULL DEFAULT 0 CHECK (tax_deduction >= 0),
  pf_deduction numeric(12, 2) NOT NULL DEFAULT 0 CHECK (pf_deduction >= 0),
  previous jsonb,
  notify_employee boolean NOT NULL DEFAULT true,
  adjustment_amount numeric(12, 2) NOT NULL DEFAULT 0,
  adjustment_note text,
  adjustment_payroll_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_notes text CHECK (decision_notes IS NULL OR length(decision_notes) <= 2000),
  applied_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.salary_revisions.previous IS 'The salary structure when the revision was created (for the letter and % change).';

-- One open revision per person at a time
CREATE UNIQUE INDEX salary_revisions_one_open
  ON public.salary_revisions (employee_id) WHERE status IN ('pending_approval', 'scheduled');
CREATE INDEX salary_revisions_employee_idx ON public.salary_revisions (employee_id, effective_from DESC);
CREATE INDEX salary_revisions_due_idx ON public.salary_revisions (effective_from) WHERE status = 'scheduled';

ALTER TABLE public.salary_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny blocked users" ON public.salary_revisions AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_not_blocked()) WITH CHECK (public.is_not_blocked());
-- Employees see their own once it's agreed (scheduled or applied), not proposals
CREATE POLICY "View salary revisions" ON public.salary_revisions FOR SELECT TO authenticated
  USING (
    public.can('payroll', 'view')
    OR (employee_id = public.get_my_employee_id() AND status IN ('scheduled', 'applied'))
  );
CREATE POLICY "Propose salary revisions" ON public.salary_revisions FOR INSERT TO authenticated
  WITH CHECK (public.can('payroll', 'manage'));
CREATE POLICY "Decide salary revisions" ON public.salary_revisions FOR UPDATE TO authenticated
  USING (public.can('payroll', 'manage')) WITH CHECK (public.can('payroll', 'manage'));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Working days in [_from, _to] for an employee: their working weekdays, minus holidays.
CREATE OR REPLACE FUNCTION public.employee_working_days(_employee_id uuid, _from date, _to date)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM generate_series(_from, _to, interval '1 day') AS d(day)
  WHERE extract(dow FROM d.day)::int = ANY (
          COALESCE(NULLIF((SELECT working_days FROM public.employees WHERE id = _employee_id), '{}'), ARRAY[1, 2, 3, 4, 5]))
    AND NOT EXISTS (
      SELECT 1 FROM public.company_events h
      WHERE h.is_holiday AND d.day::date BETWEEN h.event_date AND COALESCE(h.end_date, h.event_date)
    )
$$;

-- Monthly net of a set of components (gross - deductions).
CREATE OR REPLACE FUNCTION public.salary_net(_s jsonb)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE((_s ->> 'basic_salary')::numeric, 0)
       + COALESCE((_s ->> 'hra')::numeric, 0)
       + COALESCE((_s ->> 'transport_allowance')::numeric, 0)
       + COALESCE((_s ->> 'medical_allowance')::numeric, 0)
       + COALESCE((_s ->> 'other_allowances')::numeric, 0)
       - COALESCE((_s ->> 'tax_deduction')::numeric, 0)
       - COALESCE((_s ->> 'pf_deduction')::numeric, 0)
$$;

CREATE OR REPLACE FUNCTION public.salary_components(_s jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'basic_salary', COALESCE((_s ->> 'basic_salary')::numeric, 0),
    'hra', COALESCE((_s ->> 'hra')::numeric, 0),
    'transport_allowance', COALESCE((_s ->> 'transport_allowance')::numeric, 0),
    'medical_allowance', COALESCE((_s ->> 'medical_allowance')::numeric, 0),
    'other_allowances', COALESCE((_s ->> 'other_allowances')::numeric, 0),
    'tax_deduction', COALESCE((_s ->> 'tax_deduction')::numeric, 0),
    'pf_deduction', COALESCE((_s ->> 'pf_deduction')::numeric, 0),
    'effective_from', _s ->> 'effective_from')
$$;

REVOKE EXECUTE ON FUNCTION public.employee_working_days(uuid, date, date) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Salary history records the reason and who made the change
-- ---------------------------------------------------------------------------
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
      employee_id, basic_salary, hra, transport_allowance, medical_allowance, other_allowances,
      tax_deduction, pf_deduction, effective_from, effective_to, change_reason, changed_by
    ) VALUES (
      OLD.employee_id, OLD.basic_salary, OLD.hra, OLD.transport_allowance, OLD.medical_allowance, OLD.other_allowances,
      OLD.tax_deduction, OLD.pf_deduction, OLD.effective_from,
      GREATEST(OLD.effective_from, NEW.effective_from - 1),
      NULLIF(current_setting('peoplo.salary_change_reason', true), ''),
      COALESCE(NULLIF(current_setting('peoplo.salary_changed_by', true), '')::uuid, auth.uid())
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------------------------------------------------------------------------
-- Pay can only change through a revision
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_salary_structure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_end_user_request() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Use Revise salary to change someone''s pay.' USING ERRCODE = '42501';
  END IF;
  -- Initial salary (INSERT) and removing a structure (DELETE)
  IF COALESCE(NEW.employee_id, OLD.employee_id) = public.get_my_employee_id() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'You can''t set your own salary. Ask another payroll admin.' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER guard_salary_structure
  BEFORE INSERT OR UPDATE OR DELETE ON public.salary_structures
  FOR EACH ROW EXECUTE FUNCTION public.guard_salary_structure();

-- ---------------------------------------------------------------------------
-- Applying a revision: structure, arrears / proration, notifications
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_salary_revision(_revision_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _r public.salary_revisions%ROWTYPE;
  _old jsonb;
  _diff numeric;
  _month date;
  _month_end date;
  _total integer;
  _part integer;
  _adj numeric := 0;
  _notes text[] := '{}';
  _user uuid;
  _label text;
BEGIN
  SELECT * INTO _r FROM public.salary_revisions WHERE id = _revision_id FOR UPDATE;
  IF NOT FOUND OR _r.status <> 'scheduled' OR _r.effective_from > CURRENT_DATE THEN
    RETURN false;
  END IF;

  SELECT to_jsonb(s) INTO _old FROM public.salary_structures s WHERE s.employee_id = _r.employee_id;
  _diff := public.salary_net(to_jsonb(_r)) - public.salary_net(_old);

  -- Months from the effective month up to this one
  _month := date_trunc('month', _r.effective_from)::date;
  WHILE _old IS NOT NULL AND _diff <> 0 AND _month <= date_trunc('month', CURRENT_DATE)::date LOOP
    _month_end := (_month + interval '1 month - 1 day')::date;
    _total := public.employee_working_days(_r.employee_id, _month, _month_end);
    IF _total > 0 THEN
      IF EXISTS (
        SELECT 1 FROM public.payroll_records p
        WHERE p.employee_id = _r.employee_id
          AND p.year = extract(year FROM _month)::int AND p.month = extract(month FROM _month)::int
      ) THEN
        -- Already paid at the old rate: arrears for the days from the effective date
        _part := public.employee_working_days(_r.employee_id, GREATEST(_r.effective_from, _month), _month_end);
        IF _part > 0 THEN
          _adj := _adj + round(_diff * _part / _total, 2);
          _notes := _notes || format('arrears for %s', to_char(_month, 'Mon YYYY'));
        END IF;
      ELSIF _month = date_trunc('month', _r.effective_from)::date AND _r.effective_from > _month THEN
        -- Not run yet: it will use the new salary for the whole month, so take
        -- back the difference for the days before the effective date
        _part := public.employee_working_days(_r.employee_id, _month, _r.effective_from - 1);
        IF _part > 0 THEN
          _adj := _adj - round(_diff * _part / _total, 2);
          _notes := _notes || format('%s prorated: new salary from %s',
            to_char(_month, 'Mon YYYY'), to_char(_r.effective_from, 'FMDD Mon'));
        END IF;
      END IF;
    END IF;
    _month := (_month + interval '1 month')::date;
  END LOOP;

  _label := CASE _r.revision_type
    WHEN 'annual_appraisal' THEN 'Annual appraisal'
    WHEN 'promotion' THEN 'Promotion'
    WHEN 'market_correction' THEN 'Market correction'
    WHEN 'adjustment' THEN 'Adjustment'
    ELSE 'Other' END;

  PERFORM set_config('peoplo.system_action', 'on', true);
  PERFORM set_config('peoplo.salary_change_reason', _label || COALESCE(': ' || _r.reason, ''), true);
  PERFORM set_config('peoplo.salary_changed_by', COALESCE(_r.created_by::text, ''), true);

  INSERT INTO public.salary_structures (employee_id, basic_salary, hra, transport_allowance, medical_allowance,
                                        other_allowances, tax_deduction, pf_deduction, effective_from)
  VALUES (_r.employee_id, _r.basic_salary, _r.hra, _r.transport_allowance, _r.medical_allowance,
          _r.other_allowances, _r.tax_deduction, _r.pf_deduction, _r.effective_from)
  ON CONFLICT (employee_id) DO UPDATE SET
    basic_salary = EXCLUDED.basic_salary, hra = EXCLUDED.hra,
    transport_allowance = EXCLUDED.transport_allowance, medical_allowance = EXCLUDED.medical_allowance,
    other_allowances = EXCLUDED.other_allowances, tax_deduction = EXCLUDED.tax_deduction,
    pf_deduction = EXCLUDED.pf_deduction, effective_from = EXCLUDED.effective_from,
    updated_at = now();

  UPDATE public.salary_revisions
  SET status = 'applied', applied_at = now(),
      adjustment_amount = _adj,
      adjustment_note = CASE WHEN _adj <> 0 THEN 'Salary revision: ' || array_to_string(_notes, ', ') END
  WHERE id = _r.id;

  PERFORM set_config('peoplo.system_action', 'off', true);
  PERFORM set_config('peoplo.salary_change_reason', '', true);
  PERFORM set_config('peoplo.salary_changed_by', '', true);

  IF _r.notify_employee THEN
    SELECT user_id INTO _user FROM public.employees WHERE id = _r.employee_id;
    PERFORM public.notify_users(ARRAY[_user], 'Your salary has been revised',
      format('Effective %s. Your revision letter is in your profile under Payslips.', to_char(_r.effective_from, 'FMDD Mon YYYY')),
      'success', '/profile?tab=payslips');
  END IF;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_salary_revision(uuid) FROM PUBLIC, anon, authenticated;

-- Daily job: apply revisions whose date has come. Returns the ids applied.
CREATE OR REPLACE FUNCTION public.apply_due_salary_revisions()
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  FOR _id IN
    SELECT id FROM public.salary_revisions
    WHERE status = 'scheduled' AND effective_from <= CURRENT_DATE
    ORDER BY effective_from
  LOOP
    BEGIN
      IF public.apply_salary_revision(_id) THEN
        RETURN NEXT _id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not apply salary revision %: %', _id, SQLERRM;
    END;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_due_salary_revisions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_due_salary_revisions() TO service_role;

-- ---------------------------------------------------------------------------
-- Guard: who may propose, approve, reject or cancel
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_salary_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _structure jsonb;
  _mine boolean;
BEGIN
  NEW.updated_at := now();

  IF TG_OP = 'INSERT' THEN
    SELECT to_jsonb(s) INTO _structure FROM public.salary_structures s WHERE s.employee_id = NEW.employee_id;
    IF _structure IS NULL THEN
      RAISE EXCEPTION 'Set up this person''s salary before revising it.' USING ERRCODE = 'P0001';
    END IF;
    NEW.previous := public.salary_components(_structure);
  END IF;

  IF NOT public.is_end_user_request() THEN
    RETURN NEW;
  END IF;

  _mine := NEW.employee_id = public.get_my_employee_id();

  IF TG_OP = 'INSERT' THEN
    IF NOT public.can('payroll', 'manage') THEN
      RAISE EXCEPTION 'You don''t have permission to revise salaries.' USING ERRCODE = '42501';
    END IF;
    IF _mine AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'You can''t revise your own salary. Ask another payroll admin.' USING ERRCODE = '42501';
    END IF;
    NEW.status := CASE WHEN public.salary_revision_approval_required() THEN 'pending_approval' ELSE 'scheduled' END;
    NEW.created_by := auth.uid();
    NEW.decided_by := NULL;
    NEW.decided_at := NULL;
    NEW.decision_notes := NULL;
    NEW.applied_at := NULL;
    NEW.emailed_at := NULL;
    NEW.adjustment_amount := 0;
    NEW.adjustment_note := NULL;
    NEW.adjustment_payroll_id := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE: decide or cancel; the revision itself can't be edited (create a new one)
  IF public.changed_outside(to_jsonb(OLD), to_jsonb(NEW), ARRAY['status', 'decision_notes', 'updated_at']) THEN
    RAISE EXCEPTION 'A salary revision can''t be edited. Cancel it and create a new one.' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF OLD.status NOT IN ('pending_approval', 'scheduled') THEN
    RAISE EXCEPTION 'This salary revision is already %.', replace(OLD.status::text, '_', ' ') USING ERRCODE = 'P0001';
  END IF;

  IF NEW.status IN ('scheduled', 'rejected') THEN
    IF OLD.status <> 'pending_approval' THEN
      RAISE EXCEPTION 'Only a revision awaiting approval can be approved or rejected.' USING ERRCODE = 'P0001';
    END IF;
    IF OLD.created_by = auth.uid() THEN
      RAISE EXCEPTION 'Someone else has to approve a revision you submitted.' USING ERRCODE = '42501';
    END IF;
    IF _mine THEN
      RAISE EXCEPTION 'You can''t approve your own salary revision.' USING ERRCODE = '42501';
    END IF;
    NEW.decided_by := auth.uid();
    NEW.decided_at := now();
    RETURN NEW;
  ELSIF NEW.status = 'cancelled' THEN
    IF _mine AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'You can''t cancel a revision of your own salary.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'A salary revision can''t be marked % by hand.', replace(NEW.status::text, '_', ' ') USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER guard_salary_revision
  BEFORE INSERT OR UPDATE ON public.salary_revisions
  FOR EACH ROW EXECUTE FUNCTION public.guard_salary_revision();

-- Apply as soon as a revision is agreed (if its date has come); tell approvers
-- and the proposer what's happening.
CREATE OR REPLACE FUNCTION public.on_salary_revision_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
  _subject uuid;
  _approvers uuid[];
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT first_name || ' ' || last_name, user_id INTO _name, _subject FROM public.employees WHERE id = NEW.employee_id;

  IF NEW.status = 'pending_approval' THEN
    SELECT array_agg(u) INTO _approvers FROM public.users_with_module_access('payroll', 'manage') AS u
    WHERE u IS DISTINCT FROM NEW.created_by AND u IS DISTINCT FROM _subject;
    PERFORM public.notify_users(_approvers, 'Salary revision to approve',
      format('%s''s salary revision (effective %s) is waiting for approval.', _name, to_char(NEW.effective_from, 'FMDD Mon YYYY')),
      'info', '/payroll');
  ELSIF NEW.status = 'scheduled' THEN
    IF TG_OP = 'UPDATE' THEN
      PERFORM public.notify_users(ARRAY[NEW.created_by], 'Salary revision approved',
        format('%s''s salary revision was approved.', _name), 'success', '/payroll');
    END IF;
    PERFORM public.apply_salary_revision(NEW.id);
  ELSIF NEW.status = 'rejected' THEN
    PERFORM public.notify_users(ARRAY[NEW.created_by], 'Salary revision rejected',
      format('%s''s salary revision was rejected.%s', _name, COALESCE(' ' || NEW.decision_notes, '')), 'warning', '/payroll');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_salary_revision_change
  AFTER INSERT OR UPDATE OF status ON public.salary_revisions
  FOR EACH ROW EXECUTE FUNCTION public.on_salary_revision_change();

-- ---------------------------------------------------------------------------
-- Payroll picks up arrears / proration from applied revisions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attach_salary_adjustments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _amount numeric;
  _notes text;
  _period date := make_date(NEW.year, NEW.month, 1);
BEGIN
  SELECT COALESCE(sum(adjustment_amount), 0), string_agg(adjustment_note, '; ' ORDER BY effective_from)
  INTO _amount, _notes
  FROM public.salary_revisions
  WHERE employee_id = NEW.employee_id
    AND status = 'applied'
    AND adjustment_amount <> 0
    AND adjustment_payroll_id IS NULL
    AND date_trunc('month', effective_from)::date <= _period;

  IF _amount <> 0 THEN
    NEW.adjustment_amount := COALESCE(NEW.adjustment_amount, 0) + _amount;
    NEW.adjustment_note := concat_ws('; ', NULLIF(NEW.adjustment_note, ''), _notes);
    NEW.net_salary := NEW.net_salary + _amount;
    PERFORM set_config('peoplo.system_action', 'on', true);
    UPDATE public.salary_revisions
    SET adjustment_payroll_id = NEW.id
    WHERE employee_id = NEW.employee_id
      AND status = 'applied'
      AND adjustment_amount <> 0
      AND adjustment_payroll_id IS NULL
      AND date_trunc('month', effective_from)::date <= _period;
    PERFORM set_config('peoplo.system_action', 'off', true);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER attach_salary_adjustments
  BEFORE INSERT ON public.payroll_records
  FOR EACH ROW EXECUTE FUNCTION public.attach_salary_adjustments();
