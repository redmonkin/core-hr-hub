-- Restore a "first admin" bootstrap, without hardcoding any specific email.
--
-- Since 20260116034305, every new signup gets only the default 'employee' role,
-- on the assumption an admin already exists to promote them via the UserRolesManager
-- UI. That assumption breaks on a freshly initialized (or fully reset) database:
-- with zero admins, the first signup is routed into the "request access from HR"
-- flow, and nobody has permission to approve it - a bootstrap deadlock.
--
-- Fix: if no admin role exists yet anywhere in the system, the next person to sign
-- up becomes admin + hr. Every subsequent signup still gets the plain 'employee'
-- role as before.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'hr');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;

  RETURN NEW;
END;
$$;
