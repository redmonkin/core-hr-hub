-- One onboarding flow: HR adds the employee and the invitation goes out with it.
--
-- Before, an invitation was marked "accepted" the moment the invite email was
-- sent (Supabase creates the auth user at that point), so HR couldn't tell who
-- had actually set up their account, and new hires were asked to submit a
-- separate onboarding request. Now:
--   * an invitation is tied to the employee record it was sent for,
--   * it counts as accepted only when the person confirms their email / signs
--     in for the first time,
--   * at that point their employee record moves from 'onboarding' to 'active',
--     leave balances are created, and whoever invited them is notified.

ALTER TABLE public.user_invitations
  ADD COLUMN employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN last_sent_at timestamptz,
  ADD COLUMN send_count integer NOT NULL DEFAULT 0;

CREATE INDEX user_invitations_employee_id_idx ON public.user_invitations (employee_id);

-- Link existing invitations to the employee record with the same email.
UPDATE public.user_invitations i
SET employee_id = e.id
FROM public.employees e
WHERE i.employee_id IS NULL
  AND lower(e.email) = lower(i.email)
  AND (SELECT count(*) FROM public.employees e2 WHERE lower(e2.email) = lower(i.email)) = 1;

-- Reopen invitations that were marked accepted when the email went out but
-- whose account was never used.
UPDATE public.user_invitations i
SET accepted_at = NULL
FROM auth.users u
WHERE u.id = i.accepted_user_id
  AND i.accepted_at IS NOT NULL
  AND i.revoked_at IS NULL
  AND u.email_confirmed_at IS NULL
  AND u.last_sign_in_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_invitations o
    WHERE lower(o.email) = lower(i.email) AND o.id <> i.id
      AND o.accepted_at IS NULL AND o.revoked_at IS NULL
  );

-- ---------------------------------------------------------------------------
-- Leave balances follow the employee becoming active, however that happens
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_leave_balances_on_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.leave_balances (employee_id, leave_type_id, year, total_days, used_days)
  SELECT NEW.id, lt.id, extract(year FROM now())::int, lt.days_per_year, 0
  FROM public.leave_types lt
  ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_leave_balances_on_insert
  AFTER INSERT ON public.employees
  FOR EACH ROW WHEN (NEW.status = 'active')
  EXECUTE FUNCTION public.create_leave_balances_on_activation();

CREATE TRIGGER create_leave_balances_on_activation
  AFTER UPDATE OF status ON public.employees
  FOR EACH ROW WHEN (NEW.status = 'active' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.create_leave_balances_on_activation();

-- ---------------------------------------------------------------------------
-- Accepting an invitation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_invitation(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation public.user_invitations%ROWTYPE;
  _name text;
BEGIN
  UPDATE public.user_invitations
  SET accepted_at = now()
  WHERE accepted_user_id = _user_id AND accepted_at IS NULL AND revoked_at IS NULL
  RETURNING * INTO _invitation;

  UPDATE public.employees
  SET status = 'active'
  WHERE user_id = _user_id AND status = 'onboarding'
  RETURNING first_name || ' ' || last_name INTO _name;

  IF _invitation.id IS NOT NULL AND _invitation.invited_by IS NOT NULL AND _invitation.invited_by <> _user_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      _invitation.invited_by,
      'New hire joined',
      format('%s has set up their account and is now active.', COALESCE(_name, _invitation.full_name, _invitation.email)),
      'success',
      '/employees'
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_invitation(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_user_activated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.complete_invitation(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_activated
  AFTER UPDATE OF email_confirmed_at, last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (
    (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
    OR (OLD.last_sign_in_at IS NULL AND NEW.last_sign_in_at IS NOT NULL)
  )
  EXECUTE FUNCTION public.handle_user_activated();

-- ---------------------------------------------------------------------------
-- Account creation: an invitation is used once, but accepted later
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_invite_only_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_invitations
    WHERE lower(email) = lower(NEW.email)
      AND accepted_at IS NULL
      AND accepted_user_id IS NULL
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RAISE EXCEPTION 'Sign-ups are invite-only. Ask your HR team for an invitation.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation public.user_invitations%ROWTYPE;
  _role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );

  SELECT * INTO _invitation
  FROM public.user_invitations
  WHERE lower(email) = lower(NEW.email)
    AND accepted_at IS NULL
    AND accepted_user_id IS NULL
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC
  LIMIT 1;

  FOREACH _role IN ARRAY COALESCE(_invitation.roles, ARRAY['employee']::public.app_role[]) LOOP
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  END LOOP;

  IF _invitation.id IS NOT NULL THEN
    UPDATE public.user_invitations
    SET accepted_user_id = NEW.id
    WHERE id = _invitation.id;
  END IF;

  -- Link the employee record the invitation was sent for, or else the single
  -- unlinked employee record with this email.
  IF _invitation.employee_id IS NOT NULL THEN
    UPDATE public.employees SET user_id = NEW.id
    WHERE id = _invitation.employee_id AND user_id IS NULL;
  ELSIF (SELECT count(*) FROM public.employees
         WHERE lower(email) = lower(NEW.email) AND user_id IS NULL) = 1 THEN
    UPDATE public.employees SET user_id = NEW.id
    WHERE lower(email) = lower(NEW.email) AND user_id IS NULL;
  END IF;

  -- Accounts created already confirmed (e.g. added from the Supabase
  -- dashboard) are accepted straight away.
  IF NEW.email_confirmed_at IS NOT NULL OR NEW.last_sign_in_at IS NOT NULL THEN
    PERFORM public.complete_invitation(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;
