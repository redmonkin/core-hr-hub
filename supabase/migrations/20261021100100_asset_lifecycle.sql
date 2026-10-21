-- Asset lifecycle: repairs (with costs), damaged / lost / retired with reasons,
-- issues reported by employees, and a history of every status change.
--
--   assets.status        available | assigned | in_repair | damaged | lost | retired
--                        ('maintenance' is renamed to 'in_repair')
--   asset_repairs        one row per trip to a repair vendor: problem, vendor,
--                        expected return, estimated and actual cost, outcome
--   asset_issues         problems reported by the person holding the asset (or HR)
--   asset_events         who changed what, when and why
--
-- Status changes other than assigning and returning go through the asset_*
-- functions below, so each one records a reason and lands in the history.

ALTER TYPE public.asset_status RENAME VALUE 'maintenance' TO 'in_repair';
ALTER TYPE public.asset_status ADD VALUE IF NOT EXISTS 'damaged';
ALTER TYPE public.asset_status ADD VALUE IF NOT EXISTS 'lost';

ALTER TABLE public.assets
  ADD COLUMN retired_at date,
  ADD COLUMN retire_reason text CHECK (retire_reason IS NULL OR retire_reason IN
    ('end_of_life', 'beyond_repair', 'lost', 'sold', 'donated', 'other')),
  ADD COLUMN disposal_value numeric(12, 2) CHECK (disposal_value IS NULL OR disposal_value >= 0);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.asset_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('damage', 'not_working', 'lost', 'other')),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_repair', 'resolved', 'dismissed')),
  resolution_notes text CHECK (resolution_notes IS NULL OR length(resolution_notes) <= 2000),
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX asset_issues_asset_idx ON public.asset_issues (asset_id, created_at DESC);
CREATE INDEX asset_issues_open_idx ON public.asset_issues (status) WHERE status IN ('open', 'in_repair');

CREATE TABLE public.asset_repairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  issue_id uuid REFERENCES public.asset_issues(id) ON DELETE SET NULL,
  problem text NOT NULL CHECK (length(btrim(problem)) BETWEEN 1 AND 2000),
  vendor text CHECK (vendor IS NULL OR length(vendor) <= 200),
  sent_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_return date,
  estimated_cost numeric(12, 2) CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
  returned_date date,
  actual_cost numeric(12, 2) CHECK (actual_cost IS NULL OR actual_cost >= 0),
  outcome text CHECK (outcome IS NULL OR outcome IN ('repaired', 'beyond_repair')),
  notes text CHECK (notes IS NULL OR length(notes) <= 2000),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX asset_repairs_asset_idx ON public.asset_repairs (asset_id, sent_date DESC);
CREATE UNIQUE INDEX asset_repairs_one_open ON public.asset_repairs (asset_id) WHERE returned_date IS NULL;

CREATE TABLE public.asset_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  event text NOT NULL,
  from_status public.asset_status,
  to_status public.asset_status,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  reason text,
  amount numeric(12, 2),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX asset_events_asset_idx ON public.asset_events (asset_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS: people with assets access see everything; employees see the issues they
-- reported. Writes go through the functions below.
-- ---------------------------------------------------------------------------
ALTER TABLE public.asset_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny blocked users" ON public.asset_issues AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_not_blocked()) WITH CHECK (public.is_not_blocked());
CREATE POLICY "Deny blocked users" ON public.asset_repairs AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_not_blocked()) WITH CHECK (public.is_not_blocked());
CREATE POLICY "Deny blocked users" ON public.asset_events AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_not_blocked()) WITH CHECK (public.is_not_blocked());

CREATE POLICY "View asset issues" ON public.asset_issues FOR SELECT TO authenticated
  USING (public.can('assets', 'view') OR employee_id = public.get_my_employee_id());
CREATE POLICY "View asset repairs" ON public.asset_repairs FOR SELECT TO authenticated
  USING (public.can('assets', 'view'));
CREATE POLICY "View asset events" ON public.asset_events FOR SELECT TO authenticated
  USING (public.can('assets', 'view'));

-- ---------------------------------------------------------------------------
-- History: every status change is logged; the asset_* functions pass the
-- event name and reason through transaction-local settings.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_asset_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _holder uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.asset_events (asset_id, event, to_status)
    VALUES (NEW.id, 'created', NEW.status);
    RETURN NEW;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  SELECT employee_id INTO _holder FROM public.asset_assignments
  WHERE asset_id = NEW.id ORDER BY (returned_date IS NULL) DESC, assigned_date DESC, created_at DESC LIMIT 1;
  INSERT INTO public.asset_events (asset_id, event, from_status, to_status, employee_id, reason, amount)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(current_setting('peoplo.asset_event', true), ''),
      CASE WHEN NEW.status = 'assigned' THEN 'assigned'
           WHEN OLD.status = 'assigned' AND NEW.status = 'available' THEN 'returned'
           ELSE 'status_changed' END),
    OLD.status, NEW.status, _holder,
    NULLIF(current_setting('peoplo.asset_reason', true), ''),
    NULLIF(current_setting('peoplo.asset_amount', true), '')::numeric
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_asset_status_change
  AFTER INSERT OR UPDATE OF status ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.log_asset_status_change();

-- Existing assets start their history from today
INSERT INTO public.asset_events (asset_id, event, to_status, reason, created_by)
SELECT id, 'created', status, 'History starts here', NULL FROM public.assets;

-- End users can only assign (available -> assigned) and return (assigned ->
-- available) directly; everything else needs the action that records why.
CREATE OR REPLACE FUNCTION public.guard_asset_status()
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
    NEW.status := 'available';
    NEW.retired_at := NULL;
    NEW.retire_reason := NULL;
    NEW.disposal_value := NULL;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT ((OLD.status = 'available' AND NEW.status = 'assigned')
           OR (OLD.status = 'assigned' AND NEW.status = 'available')) THEN
    RAISE EXCEPTION 'Use the asset actions (repair, damaged, lost, retire) to change this asset''s status.'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.retired_at IS DISTINCT FROM OLD.retired_at OR NEW.retire_reason IS DISTINCT FROM OLD.retire_reason
     OR NEW.disposal_value IS DISTINCT FROM OLD.disposal_value THEN
    RAISE EXCEPTION 'Retirement details are recorded by Retire asset.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_asset_status
  BEFORE INSERT OR UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.guard_asset_status();

-- ---------------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------------

-- Internal: change status with an event name, reason and amount for the history.
CREATE OR REPLACE FUNCTION public.set_asset_status(_asset_id uuid, _status public.asset_status, _event text, _reason text, _amount numeric DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('peoplo.system_action', 'on', true);
  PERFORM set_config('peoplo.asset_event', _event, true);
  PERFORM set_config('peoplo.asset_reason', COALESCE(_reason, ''), true);
  PERFORM set_config('peoplo.asset_amount', COALESCE(_amount::text, ''), true);
  UPDATE public.assets SET status = _status, updated_at = now() WHERE id = _asset_id;
  PERFORM set_config('peoplo.system_action', 'off', true);
  PERFORM set_config('peoplo.asset_event', '', true);
  PERFORM set_config('peoplo.asset_reason', '', true);
  PERFORM set_config('peoplo.asset_amount', '', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_asset_status(uuid, public.asset_status, text, text, numeric) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.require_asset_manager()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_end_user_request() AND NOT public.can('assets', 'manage') THEN
    RAISE EXCEPTION 'You don''t have permission to manage assets.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.require_asset_manager() FROM PUBLIC, anon, authenticated;

-- Close the current assignment (lost, retired)
CREATE OR REPLACE FUNCTION public.end_asset_assignment(_asset_id uuid, _note text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.asset_assignments
  SET returned_date = CURRENT_DATE, notes = concat_ws(' · ', NULLIF(notes, ''), _note)
  WHERE asset_id = _asset_id AND returned_date IS NULL
$$;
REVOKE EXECUTE ON FUNCTION public.end_asset_assignment(uuid, text) FROM PUBLIC, anon, authenticated;

-- Send for repair. The person holding it keeps the assignment unless HR
-- returns it first; it comes back to them after the repair.
CREATE OR REPLACE FUNCTION public.asset_send_for_repair(
  _asset_id uuid, _problem text, _vendor text DEFAULT NULL, _expected_return date DEFAULT NULL,
  _estimated_cost numeric DEFAULT NULL, _issue_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _asset public.assets%ROWTYPE;
  _repair_id uuid;
BEGIN
  PERFORM public.require_asset_manager();
  SELECT * INTO _asset FROM public.assets WHERE id = _asset_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Asset not found.' USING ERRCODE = 'P0002'; END IF;
  IF _asset.status NOT IN ('available', 'assigned', 'damaged') THEN
    RAISE EXCEPTION 'An asset that is % can''t be sent for repair.', replace(_asset.status::text, '_', ' ') USING ERRCODE = 'P0001';
  END IF;
  IF _expected_return IS NOT NULL AND _expected_return < CURRENT_DATE THEN
    RAISE EXCEPTION 'The expected return date can''t be in the past.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.asset_repairs (asset_id, issue_id, problem, vendor, expected_return, estimated_cost, created_by)
  VALUES (_asset_id, _issue_id, btrim(_problem), NULLIF(btrim(_vendor), ''), _expected_return, _estimated_cost, auth.uid())
  RETURNING id INTO _repair_id;

  IF _issue_id IS NOT NULL THEN
    UPDATE public.asset_issues SET status = 'in_repair' WHERE id = _issue_id AND asset_id = _asset_id AND status = 'open';
  END IF;

  PERFORM public.set_asset_status(_asset_id, 'in_repair', 'sent_for_repair',
    btrim(_problem) || COALESCE(' (' || NULLIF(btrim(_vendor), '') || ')', ''), _estimated_cost);
  RETURN _repair_id;
END;
$$;

-- Back from repair: repaired (back to its holder, or available) or beyond repair (damaged)
CREATE OR REPLACE FUNCTION public.asset_complete_repair(
  _repair_id uuid, _outcome text, _actual_cost numeric DEFAULT NULL, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _repair public.asset_repairs%ROWTYPE;
  _next public.asset_status;
BEGIN
  PERFORM public.require_asset_manager();
  IF _outcome NOT IN ('repaired', 'beyond_repair') THEN
    RAISE EXCEPTION 'Choose whether it was repaired or is beyond repair.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO _repair FROM public.asset_repairs WHERE id = _repair_id FOR UPDATE;
  IF NOT FOUND OR _repair.returned_date IS NOT NULL THEN
    RAISE EXCEPTION 'This repair is already closed.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.asset_repairs
  SET returned_date = CURRENT_DATE, actual_cost = _actual_cost, outcome = _outcome,
      notes = NULLIF(btrim(_notes), ''), completed_by = auth.uid()
  WHERE id = _repair_id;

  IF _outcome = 'repaired' THEN
    _next := CASE WHEN EXISTS (SELECT 1 FROM public.asset_assignments
                               WHERE asset_id = _repair.asset_id AND returned_date IS NULL)
                  THEN 'assigned' ELSE 'available' END;
    UPDATE public.asset_issues SET status = 'resolved', resolved_at = now(), resolved_by = auth.uid(),
      resolution_notes = COALESCE(resolution_notes, 'Repaired')
    WHERE id = _repair.issue_id AND status IN ('open', 'in_repair');
  ELSE
    _next := 'damaged';
  END IF;

  PERFORM public.set_asset_status(_repair.asset_id, _next,
    CASE WHEN _outcome = 'repaired' THEN 'repaired' ELSE 'beyond_repair' END,
    NULLIF(btrim(_notes), ''), _actual_cost);
END;
$$;

-- Damaged, lost, or back in use (found / fixed without a repair)
CREATE OR REPLACE FUNCTION public.asset_set_condition(_asset_id uuid, _status public.asset_status, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _asset public.assets%ROWTYPE;
  _next public.asset_status := _status;
BEGIN
  PERFORM public.require_asset_manager();
  IF _status NOT IN ('damaged', 'lost', 'available') THEN
    RAISE EXCEPTION 'Use repair or retire for that.' USING ERRCODE = 'P0001';
  END IF;
  IF _reason IS NULL OR btrim(_reason) = '' THEN
    RAISE EXCEPTION 'Add a reason.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO _asset FROM public.assets WHERE id = _asset_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Asset not found.' USING ERRCODE = 'P0002'; END IF;
  IF _asset.status IN ('retired', 'in_repair') THEN
    RAISE EXCEPTION 'An asset that is % can''t be changed here.', replace(_asset.status::text, '_', ' ') USING ERRCODE = 'P0001';
  END IF;
  IF _status = 'available' AND _asset.status NOT IN ('damaged', 'lost') THEN
    RAISE EXCEPTION 'Only a damaged or lost asset can be put back in use.' USING ERRCODE = 'P0001';
  END IF;

  IF _status = 'lost' THEN
    PERFORM public.end_asset_assignment(_asset_id, 'Reported lost');
  ELSIF _status = 'available' AND EXISTS (SELECT 1 FROM public.asset_assignments
                                          WHERE asset_id = _asset_id AND returned_date IS NULL) THEN
    _next := 'assigned';
  END IF;

  PERFORM public.set_asset_status(_asset_id, _next,
    CASE _status WHEN 'damaged' THEN 'marked_damaged' WHEN 'lost' THEN 'marked_lost'
      ELSE CASE WHEN _asset.status = 'lost' THEN 'found' ELSE 'back_in_use' END END,
    btrim(_reason));
END;
$$;

CREATE OR REPLACE FUNCTION public.asset_retire(
  _asset_id uuid, _reason text, _notes text DEFAULT NULL, _retired_on date DEFAULT CURRENT_DATE,
  _disposal_value numeric DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _asset public.assets%ROWTYPE;
BEGIN
  PERFORM public.require_asset_manager();
  IF _reason NOT IN ('end_of_life', 'beyond_repair', 'lost', 'sold', 'donated', 'other') THEN
    RAISE EXCEPTION 'Choose a reason for retiring it.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO _asset FROM public.assets WHERE id = _asset_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Asset not found.' USING ERRCODE = 'P0002'; END IF;
  IF _asset.status IN ('retired', 'in_repair') THEN
    RAISE EXCEPTION 'An asset that is % can''t be retired.', replace(_asset.status::text, '_', ' ') USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.end_asset_assignment(_asset_id, 'Asset retired');
  PERFORM set_config('peoplo.system_action', 'on', true);
  UPDATE public.assets
  SET retired_at = COALESCE(_retired_on, CURRENT_DATE), retire_reason = _reason, disposal_value = _disposal_value
  WHERE id = _asset_id;
  PERFORM set_config('peoplo.system_action', 'off', true);
  PERFORM public.set_asset_status(_asset_id, 'retired', 'retired',
    concat_ws(': ', replace(_reason, '_', ' '), NULLIF(btrim(_notes), '')), _disposal_value);
END;
$$;

-- The person holding an asset (or anyone managing assets) reports a problem;
-- asset managers are notified.
CREATE OR REPLACE FUNCTION public.asset_report_issue(_asset_id uuid, _kind text, _description text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := public.get_my_employee_id();
  _issue_id uuid;
  _asset public.assets%ROWTYPE;
  _name text;
BEGIN
  SELECT * INTO _asset FROM public.assets WHERE id = _asset_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Asset not found.' USING ERRCODE = 'P0002'; END IF;
  IF public.is_end_user_request() AND NOT public.can('assets', 'manage') AND NOT EXISTS (
    SELECT 1 FROM public.asset_assignments
    WHERE asset_id = _asset_id AND employee_id = _me AND returned_date IS NULL
  ) THEN
    RAISE EXCEPTION 'You can only report problems with assets assigned to you.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.asset_issues WHERE asset_id = _asset_id AND status IN ('open', 'in_repair')
             AND employee_id IS NOT DISTINCT FROM _me) THEN
    RAISE EXCEPTION 'You''ve already reported a problem with this asset. HR will be in touch.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.asset_issues (asset_id, employee_id, kind, description, created_by)
  VALUES (_asset_id, _me, _kind, btrim(_description), auth.uid())
  RETURNING id INTO _issue_id;

  INSERT INTO public.asset_events (asset_id, event, employee_id, reason)
  VALUES (_asset_id, 'issue_reported', _me, replace(_kind, '_', ' ') || ': ' || btrim(_description));

  SELECT first_name || ' ' || last_name INTO _name FROM public.employees WHERE id = _me;
  PERFORM public.notify_users(
    (SELECT array_agg(u) FROM public.users_with_module_access('assets', 'manage') AS u WHERE u IS DISTINCT FROM auth.uid()),
    'Asset problem reported',
    format('%s reported a problem with %s (%s): %s', COALESCE(_name, 'Someone'), _asset.name, _asset.asset_code,
      replace(_kind, '_', ' ')),
    'warning', '/assets?tab=issues');
  RETURN _issue_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.asset_close_issue(_issue_id uuid, _status text, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _issue public.asset_issues%ROWTYPE;
  _reporter uuid;
BEGIN
  PERFORM public.require_asset_manager();
  IF _status NOT IN ('resolved', 'dismissed') THEN
    RAISE EXCEPTION 'An issue is closed as resolved or dismissed.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO _issue FROM public.asset_issues WHERE id = _issue_id FOR UPDATE;
  IF NOT FOUND OR _issue.status NOT IN ('open', 'in_repair') THEN
    RAISE EXCEPTION 'This issue is already closed.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.asset_issues
  SET status = _status, resolution_notes = NULLIF(btrim(_notes), ''), resolved_by = auth.uid(), resolved_at = now()
  WHERE id = _issue_id;

  SELECT user_id INTO _reporter FROM public.employees WHERE id = _issue.employee_id;
  PERFORM public.notify_users(ARRAY[_reporter],
    CASE WHEN _status = 'resolved' THEN 'Asset problem resolved' ELSE 'Asset problem closed' END,
    COALESCE(NULLIF(btrim(_notes), ''), 'HR has closed the problem you reported.'),
    'info', '/profile?tab=assets');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.asset_send_for_repair(uuid, text, text, date, numeric, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.asset_complete_repair(uuid, text, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.asset_set_condition(uuid, public.asset_status, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.asset_retire(uuid, text, text, date, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.asset_report_issue(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.asset_close_issue(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.asset_send_for_repair(uuid, text, text, date, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asset_complete_repair(uuid, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asset_set_condition(uuid, public.asset_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asset_retire(uuid, text, text, date, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asset_report_issue(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asset_close_issue(uuid, text, text) TO authenticated;
