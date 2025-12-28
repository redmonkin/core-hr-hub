-- Insert profile for samita@redmonk.in
INSERT INTO public.profiles (id, email, full_name)
VALUES ('9cdc0b32-b176-4da9-a2bb-582d1b36f385', 'samita@redmonk.in', 'Samita Mondal')
ON CONFLICT (id) DO NOTHING;

-- Remove any existing roles for this user
DELETE FROM public.user_roles WHERE user_id = '9cdc0b32-b176-4da9-a2bb-582d1b36f385';

-- Insert admin and hr roles for samita@redmonk.in
INSERT INTO public.user_roles (user_id, role) VALUES ('9cdc0b32-b176-4da9-a2bb-582d1b36f385', 'admin');
INSERT INTO public.user_roles (user_id, role) VALUES ('9cdc0b32-b176-4da9-a2bb-582d1b36f385', 'hr');

-- Update the handle_new_user function to also include samita@redmonk.in as admin
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
  
  -- Assign admin and hr roles for designated admin emails
  IF NEW.email IN ('work@redmonk.in', 'samita@redmonk.in') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'hr');
  ELSE
    -- Assign default employee role for other users
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;
  
  RETURN NEW;
END;
$$;