-- Create organization settings table for domain whitelisting
CREATE TABLE public.organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings (needed for signup validation)
CREATE POLICY "Anyone can read organization settings"
ON public.organization_settings
FOR SELECT
USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can insert organization settings"
ON public.organization_settings
FOR INSERT
WITH CHECK (public.is_admin_or_hr(auth.uid()));

CREATE POLICY "Admins can update organization settings"
ON public.organization_settings
FOR UPDATE
USING (public.is_admin_or_hr(auth.uid()));

CREATE POLICY "Admins can delete organization settings"
ON public.organization_settings
FOR DELETE
USING (public.is_admin_or_hr(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_organization_settings_updated_at
BEFORE UPDATE ON public.organization_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default domain whitelist setting (disabled by default)
INSERT INTO public.organization_settings (setting_key, setting_value)
VALUES ('domain_whitelist', '{"enabled": false, "domains": []}'::jsonb);