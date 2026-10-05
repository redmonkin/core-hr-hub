-- Offboarding: HR starts it, or an employee resigns and HR approves.
--
--   employee_exits   one row per exit: reason, notice date, last working day,
--                    status requested -> in_progress -> completed
--                    (or declined / cancelled)
--   exit_tasks       the checklist: one "Return <asset>" per asset still
--                    assigned (ticked when the asset is returned), plus
--                    reimbursements, leave, final payroll, handover, exit
--                    interview, and anything HR adds
--
-- The person stays active during their notice period. The day after their
-- last working day, process_employee_exits() (pg_cron) completes the exit:
-- status 'offboarded', exit_date set, sign-in blocked, pending leave
-- cancelled, HR and the manager notified. HR can also complete it on or after
-- the last working day from the app.
--
-- Employee status is now driven by these workflows: end users can only mark
-- an onboarding (or old inactive) employee active; leaving goes through an
-- exit. 'inactive' is no longer used by the app.

-- ---------------------------------------------------------------------------
-- System actions: let a SECURITY DEFINER function run its updates without the
-- end-user guards (they still check permissions themselves first). The setting
-- is transaction-local and can only be set from inside the database.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_end_user_request()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.role() = 'authenticated', false)
    AND COALESCE(current_setting('peoplo.system_action', true), '') <> 'on'
$$;

-- ---------------------------------------------------------------------------
-- Exit date on the employee record: the last working day once an exit is under
-- way (payroll prorates the final month by it), kept after they leave
-- (reports count leavers by it).
-- ---------------------------------------------------------------------------
ALTER TABLE public.employees ADD COLUMN exit_date date;

UPDATE public.employees
SET exit_date = updated_at::date
WHERE status = 'offboarded' AND exit_date IS NULL;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TYPE public.exit_reason AS ENUM ('resignation', 'termination', 'end_of_contract', 'retirement', 'other');
CREATE TYPE public.exit_status AS ENUM ('requested', 'in_progress', 'completed', 'cancelled', 'declined');

CREATE TABLE public.employee_exits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reason public.exit_reason NOT NULL,
  status public.exit_status NOT NULL DEFAULT 'in_progress',
  notice_date date NOT NULL DEFAULT CURRENT_DATE,
  last_working_day date NOT NULL,
  notes text CHECK (notes IS NULL OR length(notes) <= 2000),
  decision_notes text CHECK (decision_notes IS NULL OR length(decision_notes) <= 2000),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_exits_dates CHECK (last_working_day >= notice_date)
);

-- One open exit per person
CREATE UNIQUE INDEX employee_exits_one_open
  ON public.employee_exits (employee_id)
  WHERE status IN ('requested', 'in_progress');
CREATE INDEX employee_exits_status_idx ON public.employee_exits (status, last_working_day);

CREATE TABLE public.exit_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exit_id uuid NOT NULL REFERENCES public.employee_exits(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  category text NOT NULL DEFAULT 'custom'
    CHECK (category IN ('asset', 'reimbursement', 'leave', 'payroll', 'handover', 'interview', 'custom')),
  asset_assignment_id uuid REFERENCES public.asset_assignments(id) ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 0,
  done_at timestamptz,
  done_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exit_tasks_exit_id_idx ON public.exit_tasks (exit_id);
CREATE INDEX exit_tasks_asset_assignment_idx ON public.exit_tasks (asset_assignment_id) WHERE asset_assignment_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.employee_exits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny blocked users" ON public.employee_exits AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_not_blocked()) WITH CHECK (public.is_not_blocked());
CREATE POLICY "View exits" ON public.employee_exits FOR SELECT TO authenticated
  USING (
    public.can('onboarding', 'view')
    OR employee_id = public.get_my_employee_id()
    OR public.is_manager_of(employee_id)
  );
-- Employees can file their own resignation; HR can start any exit. The guard
-- trigger decides what each of them may set.
CREATE POLICY "Start exits" ON public.employee_exits FOR INSERT TO authenticated
  WITH CHECK (public.can('onboarding', 'manage') OR employee_id = public.get_my_employee_id());
CREATE POLICY "Update exits" ON public.employee_exits FOR UPDATE TO authenticated
  USING (public.can('onboarding', 'manage') OR employee_id = public.get_my_employee_id())
  WITH CHECK (public.can('onboarding', 'manage') OR employee_id = public.get_my_employee_id());

ALTER TABLE public.exit_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny blocked users" ON public.exit_tasks AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_not_blocked()) WITH CHECK (public.is_not_blocked());
CREATE POLICY "View exit tasks" ON public.exit_tasks FOR SELECT TO authenticated
  USING (
    public.can('onboarding', 'view')
    OR EXISTS (
      SELECT 1 FROM public.employee_exits x
      WHERE x.id = exit_id AND public.is_manager_of(x.employee_id)
    )
  );
CREATE POLICY "Manage exit tasks" ON public.exit_tasks FOR ALL TO authenticated
  USING (public.can('onboarding', 'manage'))
  WITH CHECK (public.can('onboarding', 'manage'));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- True when the employee's account is the only admin that isn't blocked.
CREATE OR REPLACE FUNCTION public.is_last_admin_employee(_employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
      SELECT 1 FROM public.employees e
      JOIN public.user_roles r ON r.user_id = e.user_id AND r.role = 'admin'
      WHERE e.id = _employee_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles r
      JOIN public.profiles p ON p.id = r.user_id
      WHERE r.role = 'admin'
        AND NOT p.blocked
        AND r.user_id IS DISTINCT FROM (SELECT user_id FROM public.employees WHERE id = _employee_id)
    )
$$;

CREATE OR REPLACE FUNCTION public.notify_users(_user_ids uuid[], _title text, _message text, _type text, _link text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT DISTINCT u, _title, _message, _type, _link
  FROM unnest(_user_ids) AS u
  WHERE u IS NOT NULL
$$;

REVOKE EXECUTE ON FUNCTION public.is_last_admin_employee(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_users(uuid[], text, text, text, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Guard: who may do what with an exit
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

CREATE TRIGGER guard_employee_exit
  BEFORE INSERT OR UPDATE ON public.employee_exits
  FOR EACH ROW EXECUTE FUNCTION public.guard_employee_exit();

-- ---------------------------------------------------------------------------
-- Checklist and notifications when an exit starts, is requested or closes
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
    -- The checklist, once
    IF NOT EXISTS (SELECT 1 FROM public.exit_tasks WHERE exit_id = NEW.id) THEN
      INSERT INTO public.exit_tasks (exit_id, title, category, asset_assignment_id, position)
      SELECT NEW.id, 'Return ' || a.name || ' (' || a.asset_code || ')', 'asset', aa.id,
             row_number() OVER (ORDER BY aa.assigned_date, a.name)
      FROM public.asset_assignments aa
      JOIN public.assets a ON a.id = aa.asset_id
      WHERE aa.employee_id = NEW.employee_id AND aa.returned_date IS NULL;

      IF EXISTS (
        SELECT 1 FROM public.reimbursement_requests
        WHERE employee_id = NEW.employee_id AND status IN ('pending', 'approved')
      ) THEN
        INSERT INTO public.exit_tasks (exit_id, title, category, position)
        VALUES (NEW.id, 'Settle open reimbursement claims', 'reimbursement', 100);
      END IF;

      INSERT INTO public.exit_tasks (exit_id, title, category, position) VALUES
        (NEW.id, 'Review leave balance and encashment', 'leave', 110),
        (NEW.id, 'Check final payroll (paid up to the last working day)', 'payroll', 120),
        (NEW.id, 'Knowledge handover', 'handover', 130),
        (NEW.id, 'Exit interview', 'interview', 140);
    END IF;

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

CREATE TRIGGER on_employee_exit_change
  AFTER INSERT OR UPDATE OF status, last_working_day ON public.employee_exits
  FOR EACH ROW EXECUTE FUNCTION public.on_employee_exit_change();

-- Checklist items record who ticked them
CREATE OR REPLACE FUNCTION public.stamp_exit_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.done_at IS NULL THEN
    NEW.done_by := NULL;
  ELSIF TG_OP = 'INSERT' OR OLD.done_at IS NULL THEN
    NEW.done_at := now();
    NEW.done_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER stamp_exit_task
  BEFORE INSERT OR UPDATE ON public.exit_tasks
  FOR EACH ROW EXECUTE FUNCTION public.stamp_exit_task();

-- Returning an asset ticks its checklist item
CREATE OR REPLACE FUNCTION public.tick_exit_task_on_asset_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.exit_tasks
  SET done_at = now()
  WHERE asset_assignment_id = NEW.id AND done_at IS NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tick_exit_task_on_asset_return
  AFTER UPDATE OF returned_date ON public.asset_assignments
  FOR EACH ROW WHEN (OLD.returned_date IS NULL AND NEW.returned_date IS NOT NULL)
  EXECUTE FUNCTION public.tick_exit_task_on_asset_return();

-- ---------------------------------------------------------------------------
-- Employee status follows the workflows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_employee_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_end_user_request() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('onboarding', 'active') THEN
      RAISE EXCEPTION 'New employees start as onboarding or active.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (NEW.status = 'active' AND OLD.status IN ('onboarding', 'inactive')) THEN
    RAISE EXCEPTION 'Use Start offboarding to record someone leaving.' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.exit_date IS DISTINCT FROM OLD.exit_date THEN
    RAISE EXCEPTION 'The exit date comes from the offboarding.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_employee_status
  BEFORE INSERT OR UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.guard_employee_status();

-- ---------------------------------------------------------------------------
-- Completing an exit
-- ---------------------------------------------------------------------------
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
  _open integer;
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

  SELECT count(*) INTO _open FROM public.exit_tasks WHERE exit_id = _exit_id AND done_at IS NULL;
  SELECT user_id INTO _manager_user FROM public.employees WHERE id = _emp.manager_id;
  PERFORM public.notify_users(
    (SELECT array_agg(u) FROM public.users_with_module_access('onboarding', 'manage') AS u) || ARRAY[_manager_user],
    'Employee offboarded',
    format('%s %s has left (last working day %s). Their sign-in is blocked.%s',
      _emp.first_name, _emp.last_name, to_char(_exit.last_working_day, 'FMDD Mon YYYY'),
      CASE WHEN _open > 0 THEN format(' %s checklist item%s still open.', _open, CASE WHEN _open = 1 THEN ' is' ELSE 's are' END) ELSE '' END),
    CASE WHEN _open > 0 THEN 'warning' ELSE 'info' END,
    '/onboarding?tab=leaving');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_employee_exit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_employee_exit(uuid) TO authenticated, service_role;

-- Daily job (pg_cron): complete exits whose last working day has passed and
-- remind HR three days ahead when checklist items are still open.
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

  FOR _row IN
    SELECT x.id, x.last_working_day, e.first_name, e.last_name,
           (SELECT count(*) FROM public.exit_tasks t WHERE t.exit_id = x.id AND t.done_at IS NULL) AS open_tasks
    FROM public.employee_exits x
    JOIN public.employees e ON e.id = x.employee_id
    WHERE x.status = 'in_progress' AND x.last_working_day = CURRENT_DATE + 3
  LOOP
    IF _row.open_tasks > 0 THEN
      PERFORM public.notify_users(
        (SELECT array_agg(u) FROM public.users_with_module_access('onboarding', 'manage') AS u),
        'Offboarding checklist open',
        format('%s %s leaves on %s and %s checklist item%s still open.',
          _row.first_name, _row.last_name, to_char(_row.last_working_day, 'FMDD Mon YYYY'),
          _row.open_tasks, CASE WHEN _row.open_tasks = 1 THEN ' is' ELSE 's are' END),
        'reminder',
        '/onboarding?tab=leaving');
    END IF;
  END LOOP;

  RETURN _done;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_employee_exits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_employee_exits() TO service_role;
