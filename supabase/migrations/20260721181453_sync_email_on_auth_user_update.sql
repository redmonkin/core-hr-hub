-- Keep profiles.email and employees.email in sync whenever a user's
-- auth email changes (e.g. via self-service "Change Email" or an admin
-- calling the Admin API). Runs regardless of which browser/session
-- confirms the change, unlike a client-side onAuthStateChange listener.
CREATE OR REPLACE FUNCTION public.handle_user_email_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles
    SET email = NEW.email, updated_at = now()
    WHERE id = NEW.id;

    UPDATE public.employees
    SET email = NEW.email, updated_at = now()
    WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_update();
