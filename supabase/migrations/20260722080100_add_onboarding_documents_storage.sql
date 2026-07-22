-- Storage for onboarding-request documents (resume, offer letter, ID proof).
-- Unlike employee-documents, no employees row exists yet at request time, so
-- folder ownership is keyed directly on auth.uid() instead of an employee id.
INSERT INTO storage.buckets (id, name, public)
VALUES ('onboarding-documents', 'onboarding-documents', false);

CREATE POLICY "Users can upload own onboarding documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'onboarding-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view own onboarding documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'onboarding-documents'
  AND (
    is_admin_or_hr(auth.uid())
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "Admin/HR can manage onboarding documents"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'onboarding-documents'
  AND is_admin_or_hr(auth.uid())
);
