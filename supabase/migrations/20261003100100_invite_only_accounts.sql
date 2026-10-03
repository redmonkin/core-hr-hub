-- Invite-only accounts.
--
-- Public sign-up used to create a working account for anyone, and the very
-- first sign-up on an empty database became admin. Now an account can only be
-- created for an email address with a pending invitation, whatever the
-- Supabase "allow sign-ups" setting is. This covers email/password sign-up,
-- OAuth and magic links alike, because every path inserts into auth.users.
--
-- First admin on a fresh install (run once in the SQL editor):
--   INSERT INTO public.user_invitations (email, roles) VALUES ('you@company.com', '{admin}');
-- then Supabase Dashboard -> Authentication -> Users -> Invite user.

CREATE TABLE public.user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text,
  -- roles assigned when the invitation is accepted
  roles public.app_role[] NOT NULL DEFAULT '{employee}',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  accepted_at timestamptz,
  accepted_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  CONSTRAINT user_invitations_roles_not_empty CHECK (cardinality(roles) > 0)
);

-- At most one open invitation per address
CREATE UNIQUE INDEX user_invitations_open_email_idx
  ON public.user_invitations (lower(email))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Onboarding managers view invitations" ON public.user_invitations
  FOR SELECT TO authenticated USING (public.can('onboarding', 'view'));
CREATE POLICY "Onboarding managers create invitations" ON public.user_invitations
  FOR INSERT TO authenticated WITH CHECK (public.can('onboarding', 'manage'));
CREATE POLICY "Onboarding managers update invitations" ON public.user_invitations
  FOR UPDATE TO authenticated USING (public.can('onboarding', 'manage'))
  WITH CHECK (public.can('onboarding', 'manage'));

-- ---------------------------------------------------------------------------
-- Domain whitelist, enforced in the database
-- ---------------------------------------------------------------------------

-- organization_settings.domain_whitelist = {"enabled": bool, "domains": [..]}
CREATE OR REPLACE FUNCTION public.is_email_domain_allowed(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN s.setting_value IS NULL
      OR COALESCE((s.setting_value ->> 'enabled')::boolean, false) = false
      OR jsonb_array_length(COALESCE(s.setting_value -> 'domains', '[]'::jsonb)) = 0
      THEN true
    ELSE EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(s.setting_value -> 'domains') AS d(domain)
      WHERE lower(split_part(_email, '@', 2)) = lower(trim(d.domain))
        AND position('@' IN _email) > 0
    )
  END
  FROM (SELECT 1) one
  LEFT JOIN public.organization_settings s ON s.setting_key = 'domain_whitelist'
$$;

-- Validate invitations: allowed domain, normalised email, and no privilege
-- escalation (only admins may invite someone straight into a privileged role).
CREATE OR REPLACE FUNCTION public.validate_user_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));

  IF TG_OP = 'INSERT' AND NOT public.is_email_domain_allowed(NEW.email) THEN
    RAISE EXCEPTION 'Only email addresses from approved domains can be invited.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Requests from end users (not the service role or SQL editor) can only
  -- invite plain employees unless the caller is an admin.
  IF auth.role() = 'authenticated'
     AND NOT public.is_admin()
     AND (
       NEW.roles <> ARRAY['employee']::public.app_role[]
       OR (TG_OP = 'UPDATE' AND NEW.roles IS DISTINCT FROM OLD.roles)
     )
  THEN
    RAISE EXCEPTION 'Only admins can invite users with elevated roles.'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND auth.role() = 'authenticated' THEN
    -- end users can only revoke or extend an invitation, not re-point it
    IF NEW.email IS DISTINCT FROM OLD.email
       OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
       OR NEW.accepted_user_id IS DISTINCT FROM OLD.accepted_user_id
    THEN
      RAISE EXCEPTION 'Invitations can only be revoked or extended.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.invited_by IS NULL THEN
    NEW.invited_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_user_invitation
  BEFORE INSERT OR UPDATE ON public.user_invitations
  FOR EACH ROW EXECUTE FUNCTION public.validate_user_invitation();

-- ---------------------------------------------------------------------------
-- Gate account creation on a pending invitation
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
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RAISE EXCEPTION 'Sign-ups are invite-only. Ask your HR team for an invitation.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_invite_only_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invite_only_signup();

-- New accounts get the invitation's roles (no more "first sign-up becomes
-- admin"), and are linked to an existing, unlinked employee record with the
-- same email if there is exactly one.
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
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC
  LIMIT 1;

  FOREACH _role IN ARRAY COALESCE(_invitation.roles, ARRAY['employee']::public.app_role[]) LOOP
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  END LOOP;

  IF _invitation.id IS NOT NULL THEN
    UPDATE public.user_invitations
    SET accepted_at = now(), accepted_user_id = NEW.id
    WHERE id = _invitation.id;
  END IF;

  IF (SELECT count(*) FROM public.employees
      WHERE lower(email) = lower(NEW.email) AND user_id IS NULL) = 1 THEN
    UPDATE public.employees
    SET user_id = NEW.id
    WHERE lower(email) = lower(NEW.email) AND user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Email changes must also respect the domain whitelist (the client-side check
-- in the profile dialog can be bypassed by calling the auth API directly).
CREATE OR REPLACE FUNCTION public.enforce_email_domain_on_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email
     AND NEW.email IS NOT NULL
     AND NOT public.is_email_domain_allowed(NEW.email)
  THEN
    RAISE EXCEPTION 'Only email addresses from approved domains are allowed.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_email_domain_on_change
  BEFORE UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_email_domain_on_change();
