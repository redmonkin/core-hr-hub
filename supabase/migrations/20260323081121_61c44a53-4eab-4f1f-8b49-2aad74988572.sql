DROP POLICY "Anyone can read organization settings" ON public.organization_settings;

CREATE POLICY "Authenticated users can read organization settings"
ON public.organization_settings
FOR SELECT
TO authenticated
USING (true);