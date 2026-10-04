-- Module-wise permissions.
--
-- Access is now granted per module at one of two levels:
--   view   - read the module's data across the whole organisation
--   manage - create/update/delete across the organisation, approve requests
--
-- Effective access = admin (everything) OR the highest level from any of the
-- user's roles (role_permissions, editable by admins) OR a direct per-user
-- grant (user_permissions). Grants are additive.
--
-- Self-service access (your own leave, attendance, payslips...) and
-- manager-of-team access are separate and unchanged: they don't need a grant.

CREATE TYPE public.app_module AS ENUM (
  'employees',      -- employee records, departments, employee documents
  'onboarding',     -- invitations, onboarding requests, new joiners
  'attendance',
  'leaves',         -- leave requests, types, balances, eligibility
  'reimbursements',
  'performance',    -- reviews, goals, KPI ratings, team analytics
  'assets',
  'payroll',        -- salary structures, payroll runs, bank details
  'calendar',       -- company events and holidays
  'settings'        -- organisation settings (branding, whitelist, office, codes)
);

-- Declaration order matters: 'view' < 'manage', so levels compare with >=.
CREATE TYPE public.permission_level AS ENUM ('view', 'manage');

CREATE TABLE public.role_permissions (
  role public.app_role NOT NULL,
  module public.app_module NOT NULL,
  level public.permission_level NOT NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, module),
  -- admins always have full access; it isn't configurable
  CONSTRAINT role_permissions_not_admin CHECK (role <> 'admin')
);

CREATE TABLE public.user_permissions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module public.app_module NOT NULL,
  level public.permission_level NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module)
);

CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- HR keeps exactly the access it had before (manage everything except
-- role/permission administration, which stays admin-only).
INSERT INTO public.role_permissions (role, module, level)
SELECT 'hr', m, 'manage'
FROM unnest(enum_range(NULL::public.app_module)) AS m;

-- ---------------------------------------------------------------------------
-- Permission functions
-- ---------------------------------------------------------------------------

-- Internal: a user's effective level on a module, or NULL for no access.
CREATE OR REPLACE FUNCTION public.module_level_for(_user_id uuid, _module public.app_module)
RETURNS public.permission_level
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
      THEN 'manage'::public.permission_level
    ELSE (
      SELECT max(level) FROM (
        SELECT up.level FROM public.user_permissions up
        WHERE up.user_id = _user_id AND up.module = _module
        UNION ALL
        SELECT rp.level FROM public.role_permissions rp
        JOIN public.user_roles ur ON ur.role = rp.role
        WHERE ur.user_id = _user_id AND rp.module = _module
      ) levels
    )
  END
$$;

-- Does the current user have at least _level on _module? Used by RLS.
CREATE OR REPLACE FUNCTION public.can(_module public.app_module, _level public.permission_level DEFAULT 'view')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.is_not_blocked()
    AND COALESCE(public.module_level_for(auth.uid(), _module) >= _level, false)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.is_not_blocked()
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
$$;

-- Has the current user been granted view or manage on at least one module?
CREATE OR REPLACE FUNCTION public.has_any_module_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.is_not_blocked()
    AND (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
      OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.role_permissions rp
        JOIN public.user_roles ur ON ur.role = rp.role
        WHERE ur.user_id = auth.uid()
      )
    )
$$;

-- A real member of the organisation: has a current employee record, or has
-- been given module access. Invited users who haven't been onboarded yet, and
-- offboarded staff, are not members and can't read organisation-wide data.
CREATE OR REPLACE FUNCTION public.is_active_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.is_not_blocked()
    AND (
      EXISTS (
        SELECT 1 FROM public.employees
        WHERE user_id = auth.uid() AND status <> 'offboarded'
      )
      OR public.has_any_module_access()
    )
$$;

-- Everything the front end needs to decide what to show, in one call.
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'is_admin', public.is_admin(),
    'is_blocked', NOT public.is_not_blocked(),
    'roles', COALESCE(
      (SELECT jsonb_agg(DISTINCT role) FROM public.user_roles WHERE user_id = auth.uid()),
      '[]'::jsonb
    ),
    'modules', COALESCE(
      (
        SELECT jsonb_object_agg(m, lvl)
        FROM (
          SELECT m, public.module_level_for(auth.uid(), m) AS lvl
          FROM unnest(enum_range(NULL::public.app_module)) AS m
        ) x
        WHERE lvl IS NOT NULL AND public.is_not_blocked()
      ),
      '{}'::jsonb
    )
  )
  WHERE auth.uid() IS NOT NULL
$$;

-- Service-role helpers for edge functions (never callable by end users, so
-- nobody can probe other people's access).
CREATE OR REPLACE FUNCTION public.user_can(_user_id uuid, _module public.app_module, _level public.permission_level DEFAULT 'view')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT COALESCE((SELECT blocked FROM public.profiles WHERE id = _user_id), false)
    AND COALESCE(public.module_level_for(_user_id, _module) >= _level, false)
$$;

CREATE OR REPLACE FUNCTION public.users_with_module_access(_module public.app_module, _level public.permission_level DEFAULT 'manage')
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT u.user_id
  FROM (
    SELECT user_id FROM public.user_roles
    UNION
    SELECT user_id FROM public.user_permissions
  ) u
  WHERE public.user_can(u.user_id, _module, _level)
$$;

REVOKE EXECUTE ON FUNCTION public.module_level_for(uuid, public.app_module) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_can(uuid, public.app_module, public.permission_level) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.users_with_module_access(public.app_module, public.permission_level) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_can(uuid, public.app_module, public.permission_level) TO service_role;
GRANT EXECUTE ON FUNCTION public.users_with_module_access(public.app_module, public.permission_level) TO service_role;

-- ---------------------------------------------------------------------------
-- RLS on the permission tables: admins manage, users can see their own grants
-- ---------------------------------------------------------------------------

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view role permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins manage role permissions" ON public.role_permissions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "View own or all (admin) user permissions" ON public.user_permissions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins manage user permissions" ON public.user_permissions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- Never leave the organisation without an admin
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_removing_last_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'admin'
     AND (TG_OP = 'DELETE' OR NEW.role IS DISTINCT FROM 'admin')
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles
       WHERE role = 'admin' AND id <> OLD.id
     )
  THEN
    RAISE EXCEPTION 'Cannot remove the last admin. Make someone else an admin first.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER prevent_removing_last_admin
  BEFORE UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_removing_last_admin();
