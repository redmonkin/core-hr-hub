-- Offboarding by email: a department-wise checklist that HR emails to the
-- people they pick (employees and/or outside addresses) when an offboarding
-- starts, with a reminder on the last working day. Teams confirm by replying
-- to the email, so the in-app checklist (exit_tasks) is no longer created.
-- Resignations are emailed too: to HR and the reporting manager, with a
-- confirmation to the employee.

-- ---------------------------------------------------------------------------
-- The checklist template (organization_settings, key 'offboarding_checklist')
-- ---------------------------------------------------------------------------
INSERT INTO public.organization_settings (setting_key, setting_value)
VALUES ('offboarding_checklist', $json${
  "sections": [
    {
      "name": "IT Department",
      "items": [
        "Disable/deactivate email account (or set up auto-forward/out-of-office if needed)",
        "Remove access to internal systems/applications (ERP, CRM, project tools, etc.)",
        "Revoke access to cloud services (Google Workspace, Microsoft 365, AWS, etc.)",
        "Disable from Teams",
        "Reset/revoke shared account passwords the employee had access to",
        "Collect and wipe company-issued laptop/devices",
        "Revoke access to admin panels, servers, databases"
      ]
    },
    {
      "name": "HR Department",
      "items": [
        "Collect resignation letter/exit formalities",
        "Conduct exit interview",
        "Update employee status in HRMS",
        "Issue relieving/experience letter (after exit formalities are complete and company assets are submitted)",
        "Update health insurance/benefits termination"
      ]
    },
    {
      "name": "Finance Department",
      "items": [
        "Settle pending reimbursements/expenses and process full and final settlement (after exit formalities are complete and company assets are submitted)"
      ]
    },
    {
      "name": "Facilities/Admin",
      "items": [
        "Collect access card/ID badge",
        "Revoke building/office access",
        "Collect company assets"
      ]
    }
  ]
}$json$::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

-- People who run offboarding can edit the template without full settings access.
CREATE POLICY "Onboarding managers edit the offboarding checklist" ON public.organization_settings
  FOR ALL TO authenticated
  USING (setting_key = 'offboarding_checklist' AND public.can('onboarding', 'manage'))
  WITH CHECK (setting_key = 'offboarding_checklist' AND public.can('onboarding', 'manage'));

-- ---------------------------------------------------------------------------
-- Who each offboarding is emailed to, and when
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.are_valid_emails(_emails text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(bool_and(e ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(e) <= 254), true)
  FROM unnest(_emails) AS e
$$;

ALTER TABLE public.employee_exits
  ADD COLUMN notify_employee_ids uuid[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(notify_employee_ids) <= 100),
  ADD COLUMN notify_emails text[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(notify_emails) <= 20 AND public.are_valid_emails(notify_emails)),
  ADD COLUMN email_note text CHECK (email_note IS NULL OR length(email_note) <= 2000),
  ADD COLUMN notified_at timestamptz,
  ADD COLUMN reminder_sent_at timestamptz,
  ADD COLUMN checklist jsonb;

COMMENT ON COLUMN public.employee_exits.checklist IS
  'The department checklist as last emailed (snapshot of the offboarding_checklist template).';
COMMENT ON TABLE public.exit_tasks IS
  'No longer used: offboarding checklists are emailed (employee_exits.checklist). Kept for history.';

-- ---------------------------------------------------------------------------
-- Guard: an employee's resignation can't choose recipients or email stamps
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_employee_exit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mine boolean;
  _manage boolean;
BEGIN
  NEW.updated_at := now();

  IF NOT public.is_end_user_request() THEN
    RETURN NEW;
  END IF;

  _mine := NEW.employee_id = public.get_my_employee_id();
  _manage := public.can('onboarding', 'manage');

  IF TG_OP = 'INSERT' THEN
    IF _mine THEN
      -- Resignation: always a request that someone else approves
      NEW.status := 'requested';
      NEW.reason := 'resignation';
      NEW.notice_date := CURRENT_DATE;
      NEW.notify_employee_ids := '{}';
      NEW.notify_emails := '{}';
      NEW.email_note := NULL;
      IF NEW.last_working_day < CURRENT_DATE THEN
        RAISE EXCEPTION 'Your last working day can''t be in the past.' USING ERRCODE = 'P0001';
      END IF;
    ELSIF _manage THEN
      NEW.status := 'in_progress';
      NEW.decided_by := auth.uid();
      NEW.decided_at := now();
      IF public.is_last_admin_employee(NEW.employee_id) THEN
        RAISE EXCEPTION 'This person is the only admin. Make someone else an admin first.' USING ERRCODE = 'P0001';
      END IF;
    ELSE
      RAISE EXCEPTION 'You don''t have permission to offboard employees.' USING ERRCODE = '42501';
    END IF;
    NEW.requested_by := auth.uid();
    NEW.completed_at := NULL;
    NEW.notified_at := NULL;
    NEW.reminder_sent_at := NULL;
    NEW.checklist := NULL;
    IF NOT _manage OR _mine THEN
      NEW.decided_by := NULL;
      NEW.decided_at := NULL;
      NEW.decision_notes := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF OLD.status IN ('completed', 'cancelled', 'declined') THEN
    RAISE EXCEPTION 'This offboarding is already closed.' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.employee_id IS DISTINCT FROM OLD.employee_id
     OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'An offboarding can''t be moved to another person.' USING ERRCODE = '42501';
  END IF;
  IF NEW.status = 'completed' THEN
    RAISE EXCEPTION 'Offboarding is completed on the last working day, not edited directly.' USING ERRCODE = '42501';
  END IF;
  -- Email stamps are written by the email functions only
  IF NEW.notified_at IS DISTINCT FROM OLD.notified_at
     OR NEW.reminder_sent_at IS DISTINCT FROM OLD.reminder_sent_at
     OR NEW.checklist IS DISTINCT FROM OLD.checklist THEN
    RAISE EXCEPTION 'Email details are recorded automatically.' USING ERRCODE = '42501';
  END IF;

  IF _mine THEN
    -- Your own exit: you can only withdraw a resignation that hasn't been approved
    IF OLD.status = 'requested' AND NEW.status = 'cancelled'
       AND NOT public.changed_outside(to_jsonb(OLD), to_jsonb(NEW), ARRAY['status', 'updated_at']) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'You can withdraw your resignation until it''s approved. Ask HR for anything else.' USING ERRCODE = '42501';
  END IF;

  IF NOT _manage THEN
    RAISE EXCEPTION 'You don''t have permission to change this offboarding.' USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'requested' AND NEW.status IN ('in_progress', 'declined', 'cancelled'))
      OR (OLD.status = 'in_progress' AND NEW.status = 'cancelled')
    ) THEN
      RAISE EXCEPTION 'An offboarding can''t go from % to %.', OLD.status, NEW.status USING ERRCODE = 'P0001';
    END IF;
    IF OLD.status = 'requested' THEN
      NEW.decided_by := auth.uid();
      NEW.decided_at := now();
    END IF;
    IF NEW.status = 'in_progress' AND public.is_last_admin_employee(NEW.employee_id) THEN
      RAISE EXCEPTION 'This person is the only admin. Make someone else an admin first.' USING ERRCODE = 'P0001';
    END IF;
  ELSIF NEW.decided_by IS DISTINCT FROM OLD.decided_by OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
     OR NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    RAISE EXCEPTION 'Approval details are recorded automatically.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- In-app notifications stay; the in-app checklist is no longer created
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_employee_exit_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _emp public.employees%ROWTYPE;
  _manager_user uuid;
  _hr uuid[];
  _name text;
  _lwd text;
BEGIN
  -- Keep employees.exit_date in step with an exit that's under way
  IF NEW.status = 'in_progress'
     OR (TG_OP = 'UPDATE' AND OLD.status = 'in_progress' AND NEW.status = 'cancelled') THEN
    PERFORM set_config('peoplo.system_action', 'on', true);
    UPDATE public.employees
    SET exit_date = CASE WHEN NEW.status = 'in_progress' THEN NEW.last_working_day END
    WHERE id = NEW.employee_id;
    PERFORM set_config('peoplo.system_action', 'off', true);
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _emp FROM public.employees WHERE id = NEW.employee_id;
  SELECT user_id INTO _manager_user FROM public.employees WHERE id = _emp.manager_id;
  SELECT array_agg(u) INTO _hr FROM public.users_with_module_access('onboarding', 'manage') AS u
  WHERE u IS DISTINCT FROM auth.uid() AND u IS DISTINCT FROM _emp.user_id;
  _name := _emp.first_name || ' ' || _emp.last_name;
  _lwd := to_char(NEW.last_working_day, 'FMDD Mon YYYY');

  IF NEW.status = 'requested' THEN
    PERFORM public.notify_users(_hr, 'Resignation received',
      format('%s has resigned. Proposed last working day: %s.', _name, _lwd), 'info', '/onboarding?tab=leaving');
    PERFORM public.notify_users(ARRAY[_manager_user], 'Resignation received',
      format('%s has resigned. Proposed last working day: %s.', _name, _lwd), 'info', '/employees');

  ELSIF NEW.status = 'in_progress' THEN
    PERFORM public.notify_users(ARRAY[_emp.user_id], 'Last working day confirmed',
      format('Your last working day is %s.', _lwd), 'info', '/profile');
    PERFORM public.notify_users(_hr || ARRAY[_manager_user], 'Offboarding started',
      format('%s is leaving. Last working day: %s.', _name, _lwd), 'info', '/onboarding?tab=leaving');

  ELSIF NEW.status = 'declined' THEN
    PERFORM public.notify_users(ARRAY[_emp.user_id], 'Resignation not accepted',
      COALESCE('HR responded: ' || NEW.decision_notes, 'HR will talk to you about your resignation.'), 'warning', '/profile');

  ELSIF NEW.status = 'cancelled' THEN
    IF NEW.employee_id IS DISTINCT FROM public.get_my_employee_id() THEN
      PERFORM public.notify_users(ARRAY[_emp.user_id], 'Offboarding cancelled',
        'Your offboarding has been cancelled. You''re staying on.', 'success', '/profile');
    END IF;
    PERFORM public.notify_users(_hr, 'Offboarding cancelled',
      format('%s is no longer leaving.', _name), 'info', '/onboarding?tab=leaving');
  END IF;

  RETURN NEW;
END;
$$;

-- The completion notice no longer counts checklist items
CREATE OR REPLACE FUNCTION public.complete_employee_exit(_exit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _exit public.employee_exits%ROWTYPE;
  _emp public.employees%ROWTYPE;
  _manager_user uuid;
  _actor uuid := auth.uid();
BEGIN
  SELECT * INTO _exit FROM public.employee_exits WHERE id = _exit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offboarding not found.' USING ERRCODE = 'P0002';
  END IF;

  IF public.is_end_user_request() THEN
    IF NOT public.can('onboarding', 'manage') THEN
      RAISE EXCEPTION 'You don''t have permission to complete offboarding.' USING ERRCODE = '42501';
    END IF;
    IF _exit.employee_id = public.get_my_employee_id() THEN
      RAISE EXCEPTION 'Someone else has to complete your offboarding.' USING ERRCODE = '42501';
    END IF;
    IF _exit.last_working_day > CURRENT_DATE THEN
      RAISE EXCEPTION 'This can be completed on or after the last working day (%).',
        to_char(_exit.last_working_day, 'FMDD Mon YYYY') USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF _exit.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Only an offboarding in progress can be completed.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_last_admin_employee(_exit.employee_id) THEN
    RAISE EXCEPTION 'This person is the only admin. Make someone else an admin first.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('peoplo.system_action', 'on', true);

  UPDATE public.employee_exits
  SET status = 'completed', completed_at = now()
  WHERE id = _exit_id;

  UPDATE public.employees
  SET status = 'offboarded', exit_date = _exit.last_working_day
  WHERE id = _exit.employee_id
  RETURNING * INTO _emp;

  -- Leave that hasn't been taken yet won't be
  UPDATE public.leave_requests
  SET status = 'cancelled',
      review_notes = 'Cancelled automatically: employee left on ' || to_char(_exit.last_working_day, 'FMDD Mon YYYY'),
      reviewed_at = now()
  WHERE employee_id = _exit.employee_id
    AND status = 'pending';

  -- No more sign-in, and no stray invitation can bring the account back
  IF _emp.user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET blocked = true, blocked_at = now(), blocked_by = _actor
    WHERE id = _emp.user_id AND NOT blocked;
  END IF;
  UPDATE public.user_invitations
  SET revoked_at = now()
  WHERE lower(email) = lower(_emp.email) AND accepted_at IS NULL AND revoked_at IS NULL;

  PERFORM set_config('peoplo.system_action', 'off', true);

  SELECT user_id INTO _manager_user FROM public.employees WHERE id = _emp.manager_id;
  PERFORM public.notify_users(
    (SELECT array_agg(u) FROM public.users_with_module_access('onboarding', 'manage') AS u) || ARRAY[_manager_user],
    'Employee offboarded',
    format('%s %s has left (last working day %s). Their sign-in is blocked.',
      _emp.first_name, _emp.last_name, to_char(_exit.last_working_day, 'FMDD Mon YYYY')),
    'info',
    '/onboarding?tab=leaving');
END;
$$;

-- The daily job only completes exits now; the last-day reminder is an email
-- (offboarding-reminders function).
CREATE OR REPLACE FUNCTION public.process_employee_exits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row record;
  _done integer := 0;
BEGIN
  FOR _row IN
    SELECT id FROM public.employee_exits
    WHERE status = 'in_progress' AND last_working_day < CURRENT_DATE
    ORDER BY last_working_day
  LOOP
    BEGIN
      PERFORM public.complete_employee_exit(_row.id);
      _done := _done + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not complete exit %: %', _row.id, SQLERRM;
    END;
  END LOOP;
  RETURN _done;
END;
$$;
