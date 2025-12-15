-- Clear all data from tables (respecting foreign key order)
TRUNCATE TABLE public.activity_logs CASCADE;
TRUNCATE TABLE public.notifications CASCADE;
TRUNCATE TABLE public.notification_preferences CASCADE;
TRUNCATE TABLE public.payroll_records CASCADE;
TRUNCATE TABLE public.salary_structures CASCADE;
TRUNCATE TABLE public.performance_reviews CASCADE;
TRUNCATE TABLE public.goals CASCADE;
TRUNCATE TABLE public.leave_requests CASCADE;
TRUNCATE TABLE public.leave_balances CASCADE;
TRUNCATE TABLE public.asset_assignments CASCADE;
TRUNCATE TABLE public.assets CASCADE;
TRUNCATE TABLE public.attendance_records CASCADE;
TRUNCATE TABLE public.employee_documents CASCADE;
TRUNCATE TABLE public.employees CASCADE;
TRUNCATE TABLE public.company_events CASCADE;
TRUNCATE TABLE public.departments CASCADE;
TRUNCATE TABLE public.leave_types CASCADE;
TRUNCATE TABLE public.user_roles CASCADE;
TRUNCATE TABLE public.profiles CASCADE;

-- Update the handle_new_user function to assign admin+hr role for specific email
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
  
  -- Assign admin and hr roles for the designated admin email
  IF NEW.email = 'work@redmonk.in' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'hr');
  ELSE
    -- Assign default employee role for other users
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;
  
  RETURN NEW;
END;
$$;