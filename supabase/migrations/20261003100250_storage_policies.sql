-- Storage policies on top of module permissions, and function privileges.
--
-- Split from the previous migration (see its header). The old storage
-- policies call is_admin_or_hr(), so they're replaced here before that
-- function stops being callable by signed-in users.

DO $$
DECLARE
  _p record;
BEGIN
  FOR _p IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', _p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Deny blocked users" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_not_blocked()) WITH CHECK (public.is_not_blocked());

-- ---------------------------------------------------------------------------
-- 13. Storage
-- ---------------------------------------------------------------------------

-- Folder names are employee ids or user ids; compare as text so a malformed
-- path can never raise a cast error.
CREATE POLICY "View employee files" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (
      (storage.foldername(name))[1] = public.get_my_employee_id()::text
      OR public.can('employees', 'view')
      OR public.can('onboarding', 'view')
    )
  );
CREATE POLICY "Upload employee files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND (
      (storage.foldername(name))[1] = public.get_my_employee_id()::text
      OR public.can('employees', 'manage')
      OR public.can('onboarding', 'manage')
    )
  );
-- Only HR-side users can replace or delete files (employees used to be able
-- to delete documents HR had uploaded to their folder).
CREATE POLICY "Update employee files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'employee-documents' AND public.can('employees', 'manage'));
CREATE POLICY "Delete employee files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'employee-documents' AND public.can('employees', 'manage'));

CREATE POLICY "View onboarding files" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'onboarding-documents'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.can('onboarding', 'view'))
  );
CREATE POLICY "Upload own onboarding files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'onboarding-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Update onboarding files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'onboarding-documents' AND public.can('onboarding', 'manage'));
CREATE POLICY "Delete onboarding files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'onboarding-documents' AND public.can('onboarding', 'manage'));

CREATE POLICY "View receipts" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'reimbursement-receipts'
    AND (
      (storage.foldername(name))[1] = public.get_my_employee_id()::text
      OR public.can('reimbursements', 'view')
      OR (storage.foldername(name))[1] IN (
        SELECT e.id::text FROM public.employees e WHERE e.manager_id = public.get_my_employee_id()
      )
    )
  );
CREATE POLICY "Upload own receipts" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'reimbursement-receipts'
    AND (storage.foldername(name))[1] = public.get_my_employee_id()::text
  );
CREATE POLICY "Update receipts" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'reimbursement-receipts' AND public.can('reimbursements', 'manage'));
CREATE POLICY "Delete receipts" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'reimbursement-receipts' AND public.can('reimbursements', 'manage'));

CREATE POLICY "Anyone views branding" ON storage.objects FOR SELECT
  USING (bucket_id = 'company-branding');
CREATE POLICY "Upload branding" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-branding' AND public.can('settings', 'manage'));
CREATE POLICY "Update branding" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-branding' AND public.can('settings', 'manage'));
CREATE POLICY "Delete branding" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-branding' AND public.can('settings', 'manage'));

-- ---------------------------------------------------------------------------
-- 14. Function privileges
-- ---------------------------------------------------------------------------

-- Nothing in public should be callable without logging in, and the old
-- role helpers took an arbitrary user id, which let anyone check who is an
-- admin. No policy uses them any more.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_hr(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_hr(uuid) TO service_role;
