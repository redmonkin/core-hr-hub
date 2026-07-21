-- Public bucket for company branding assets (logo/icon shown in-app and in
-- generated PDFs). Public read is fine since a logo isn't sensitive; write
-- access is restricted to admins/HR.
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-branding', 'company-branding', true);

CREATE POLICY "Anyone can view branding assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'company-branding');

CREATE POLICY "Admin/HR can upload branding assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-branding'
  AND is_admin_or_hr(auth.uid())
);

CREATE POLICY "Admin/HR can update branding assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-branding'
  AND is_admin_or_hr(auth.uid())
);

CREATE POLICY "Admin/HR can delete branding assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-branding'
  AND is_admin_or_hr(auth.uid())
);

INSERT INTO public.organization_settings (setting_key, setting_value)
VALUES ('company_branding', '{"company_name": "", "company_address": "", "logo_url": null, "icon_url": null}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;
