-- Rebuild every RLS policy on top of module permissions.
--
-- Policies were accumulated across ~50 migrations, so rather than patch them
-- this drops all policies on the affected tables and recreates the complete,
-- final set in one place. The three kinds of access are:
--   self     - your own rows (employee_id = get_my_employee_id() / user_id = auth.uid())
--   team     - rows of your direct reports (is_manager_of)
--   module   - organisation-wide, via public.can(module, level)
-- Blocked users are denied everything by one restrictive policy per table.

-- ---------------------------------------------------------------------------
-- 1. Drop all existing policies on the tables we redefine
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  _p record;
BEGIN
  FOR _p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE (schemaname = 'public' AND tablename IN (
        'activity_logs', 'asset_assignments', 'assets', 'attendance_breaks',
        'attendance_records', 'company_events', 'departments', 'employee_documents',
        'employee_leave_eligibility', 'employees', 'goals', 'leave_balances',
        'leave_requests', 'leave_types', 'notification_preferences', 'notifications',
        'onboarding_requests', 'organization_settings', 'payroll_records',
        'performance_reviews', 'profiles', 'push_subscriptions',
        'reimbursement_requests', 'review_kpi_ratings', 'salary_history',
        'salary_structures', 'system_settings', 'user_roles'))
       OR (schemaname = 'storage' AND tablename = 'objects')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', _p.policyname, _p.schemaname, _p.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Blocked users: one restrictive policy on every table (including the new
--    permission/invitation tables and storage)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  _t text;
BEGIN
  FOREACH _t IN ARRAY ARRAY[
    'activity_logs', 'asset_assignments', 'assets', 'attendance_breaks',
    'attendance_records', 'company_events', 'departments', 'employee_documents',
    'employee_leave_eligibility', 'employees', 'goals', 'leave_balances',
    'leave_requests', 'leave_types', 'notification_preferences', 'notifications',
    'onboarding_requests', 'organization_settings', 'payroll_records',
    'performance_reviews', 'profiles', 'push_subscriptions',
    'reimbursement_requests', 'review_kpi_ratings', 'salary_history',
    'salary_structures', 'system_settings', 'user_roles',
    'role_permissions', 'user_permissions', 'user_invitations']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', _t);
    EXECUTE format(
      'CREATE POLICY "Deny blocked users" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (public.is_not_blocked()) WITH CHECK (public.is_not_blocked())', _t);
  END LOOP;
END $$;

CREATE POLICY "Deny blocked users" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_not_blocked()) WITH CHECK (public.is_not_blocked());

-- ---------------------------------------------------------------------------
-- 3. People
-- ---------------------------------------------------------------------------

-- employees: anyone with module access can read employee records, because
-- every module screen shows employee names/codes. Bank details live in a
-- separate table (see the integrity migration) and salary in payroll tables.
CREATE POLICY "View employees" ON public.employees FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR manager_id = public.get_my_employee_id()
    OR public.can('employees', 'view')
    OR public.has_any_module_access()
  );
CREATE POLICY "Create employees" ON public.employees FOR INSERT TO authenticated
  WITH CHECK (public.can('employees', 'manage') OR public.can('onboarding', 'manage'));
-- Self-updates are limited to personal fields by a trigger.
CREATE POLICY "Update employees" ON public.employees FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.can('employees', 'manage') OR public.can('onboarding', 'manage'))
  WITH CHECK (user_id = auth.uid() OR public.can('employees', 'manage') OR public.can('onboarding', 'manage'));
CREATE POLICY "Delete employees" ON public.employees FOR DELETE TO authenticated
  USING (public.can('employees', 'manage'));

CREATE POLICY "Members view departments" ON public.departments FOR SELECT TO authenticated
  USING (public.is_active_member());
CREATE POLICY "Manage departments" ON public.departments FOR ALL TO authenticated
  USING (public.can('employees', 'manage')) WITH CHECK (public.can('employees', 'manage'));

CREATE POLICY "View employee documents" ON public.employee_documents FOR SELECT TO authenticated
  USING (employee_id = public.get_my_employee_id() OR public.can('employees', 'view'));
CREATE POLICY "Add employee documents" ON public.employee_documents FOR INSERT TO authenticated
  WITH CHECK (public.can('employees', 'manage') OR public.can('onboarding', 'manage'));
CREATE POLICY "Update employee documents" ON public.employee_documents FOR UPDATE TO authenticated
  USING (public.can('employees', 'manage')) WITH CHECK (public.can('employees', 'manage'));
CREATE POLICY "Delete employee documents" ON public.employee_documents FOR DELETE TO authenticated
  USING (public.can('employees', 'manage'));

CREATE POLICY "View profiles" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.can('employees', 'view') OR public.is_admin());
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Admins update any profile" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "View own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "View activity logs" ON public.activity_logs FOR SELECT TO authenticated
  USING (public.can('employees', 'view'));
CREATE POLICY "Service role inserts activity logs" ON public.activity_logs FOR INSERT TO service_role
  WITH CHECK (true);

-- Directory: only real members see it (it used to be readable without
-- logging in, because is_not_blocked() is true when auth.uid() is NULL).
CREATE OR REPLACE VIEW public.employee_directory AS
SELECT
  e.id,
  e.employee_code,
  e.first_name,
  e.last_name,
  e.email,
  e.phone,
  e.designation,
  e.hire_date,
  e.avatar_url,
  e.status,
  e.department_id,
  d.name AS department_name
FROM public.employees e
LEFT JOIN public.departments d ON d.id = e.department_id
WHERE public.is_active_member();

REVOKE ALL ON public.employee_directory FROM PUBLIC, anon;
GRANT SELECT ON public.employee_directory TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Onboarding
-- ---------------------------------------------------------------------------
CREATE POLICY "View onboarding requests" ON public.onboarding_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can('onboarding', 'view'));
CREATE POLICY "Submit own onboarding request" ON public.onboarding_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Review onboarding requests" ON public.onboarding_requests FOR UPDATE TO authenticated
  USING (public.can('onboarding', 'manage')) WITH CHECK (public.can('onboarding', 'manage'));

-- ---------------------------------------------------------------------------
-- 5. Attendance (self-service writes are constrained by triggers)
-- ---------------------------------------------------------------------------
CREATE POLICY "View attendance" ON public.attendance_records FOR SELECT TO authenticated
  USING (
    employee_id = public.get_my_employee_id()
    OR public.is_manager_of(employee_id)
    OR public.can('attendance', 'view')
  );
CREATE POLICY "Record attendance" ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.get_my_employee_id() OR public.can('attendance', 'manage'));
CREATE POLICY "Update attendance" ON public.attendance_records FOR UPDATE TO authenticated
  USING (employee_id = public.get_my_employee_id() OR public.can('attendance', 'manage'))
  WITH CHECK (employee_id = public.get_my_employee_id() OR public.can('attendance', 'manage'));
CREATE POLICY "Delete attendance" ON public.attendance_records FOR DELETE TO authenticated
  USING (public.can('attendance', 'manage'));

CREATE POLICY "View breaks" ON public.attendance_breaks FOR SELECT TO authenticated
  USING (
    public.can('attendance', 'view')
    OR attendance_record_id IN (
      SELECT ar.id FROM public.attendance_records ar
      WHERE ar.employee_id = public.get_my_employee_id() OR public.is_manager_of(ar.employee_id)
    )
  );
CREATE POLICY "Record breaks" ON public.attendance_breaks FOR INSERT TO authenticated
  WITH CHECK (
    public.can('attendance', 'manage')
    OR attendance_record_id IN (
      SELECT ar.id FROM public.attendance_records ar WHERE ar.employee_id = public.get_my_employee_id()
    )
  );
CREATE POLICY "Update breaks" ON public.attendance_breaks FOR UPDATE TO authenticated
  USING (
    public.can('attendance', 'manage')
    OR attendance_record_id IN (
      SELECT ar.id FROM public.attendance_records ar WHERE ar.employee_id = public.get_my_employee_id()
    )
  );
CREATE POLICY "Delete breaks" ON public.attendance_breaks FOR DELETE TO authenticated
  USING (public.can('attendance', 'manage'));

-- ---------------------------------------------------------------------------
-- 6. Leave
-- ---------------------------------------------------------------------------
CREATE POLICY "View leave requests" ON public.leave_requests FOR SELECT TO authenticated
  USING (
    employee_id = public.get_my_employee_id()
    OR public.is_manager_of(employee_id)
    OR public.can('leaves', 'view')
  );
-- Status and review fields are forced to "pending" by a trigger.
CREATE POLICY "Request leave" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.get_my_employee_id() OR public.can('leaves', 'manage'));
CREATE POLICY "Review leave requests" ON public.leave_requests FOR UPDATE TO authenticated
  USING (public.is_manager_of(employee_id) OR public.can('leaves', 'manage'))
  WITH CHECK (public.is_manager_of(employee_id) OR public.can('leaves', 'manage'));
CREATE POLICY "Delete leave requests" ON public.leave_requests FOR DELETE TO authenticated
  USING (public.can('leaves', 'manage'));

CREATE POLICY "Members view leave types" ON public.leave_types FOR SELECT TO authenticated
  USING (public.is_active_member());
CREATE POLICY "Manage leave types" ON public.leave_types FOR ALL TO authenticated
  USING (public.can('leaves', 'manage')) WITH CHECK (public.can('leaves', 'manage'));

CREATE POLICY "View leave balances" ON public.leave_balances FOR SELECT TO authenticated
  USING (employee_id = public.get_my_employee_id() OR public.can('leaves', 'view'));
CREATE POLICY "Manage leave balances" ON public.leave_balances FOR ALL TO authenticated
  USING (public.can('leaves', 'manage')) WITH CHECK (public.can('leaves', 'manage'));

CREATE POLICY "View leave eligibility" ON public.employee_leave_eligibility FOR SELECT TO authenticated
  USING (
    employee_id = public.get_my_employee_id()
    OR public.is_manager_of(employee_id)
    OR public.can('leaves', 'view')
  );
CREATE POLICY "Manage leave eligibility" ON public.employee_leave_eligibility FOR ALL TO authenticated
  USING (public.can('leaves', 'manage')) WITH CHECK (public.can('leaves', 'manage'));

-- ---------------------------------------------------------------------------
-- 7. Reimbursements
-- ---------------------------------------------------------------------------
CREATE POLICY "View reimbursements" ON public.reimbursement_requests FOR SELECT TO authenticated
  USING (
    employee_id = public.get_my_employee_id()
    OR public.is_manager_of(employee_id)
    OR public.can('reimbursements', 'view')
  );
CREATE POLICY "Submit reimbursement" ON public.reimbursement_requests FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.get_my_employee_id() OR public.can('reimbursements', 'manage'));
CREATE POLICY "Review reimbursements" ON public.reimbursement_requests FOR UPDATE TO authenticated
  USING (public.is_manager_of(employee_id) OR public.can('reimbursements', 'manage'))
  WITH CHECK (public.is_manager_of(employee_id) OR public.can('reimbursements', 'manage'));
CREATE POLICY "Delete reimbursements" ON public.reimbursement_requests FOR DELETE TO authenticated
  USING (public.can('reimbursements', 'manage'));

-- ---------------------------------------------------------------------------
-- 8. Performance (rating ownership enforced by triggers)
-- ---------------------------------------------------------------------------
CREATE POLICY "View goals" ON public.goals FOR SELECT TO authenticated
  USING (
    employee_id = public.get_my_employee_id()
    OR public.is_manager_of(employee_id)
    OR public.can('performance', 'view')
  );
CREATE POLICY "Create goals" ON public.goals FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = public.get_my_employee_id()
    OR public.is_manager_of(employee_id)
    OR public.can('performance', 'manage')
  );
CREATE POLICY "Update goals" ON public.goals FOR UPDATE TO authenticated
  USING (
    employee_id = public.get_my_employee_id()
    OR public.is_manager_of(employee_id)
    OR public.can('performance', 'manage')
  )
  WITH CHECK (
    employee_id = public.get_my_employee_id()
    OR public.is_manager_of(employee_id)
    OR public.can('performance', 'manage')
  );
CREATE POLICY "Delete goals" ON public.goals FOR DELETE TO authenticated
  USING (
    employee_id = public.get_my_employee_id()
    OR public.is_manager_of(employee_id)
    OR public.can('performance', 'manage')
  );

CREATE POLICY "View reviews" ON public.performance_reviews FOR SELECT TO authenticated
  USING (
    employee_id = public.get_my_employee_id()
    OR public.is_manager_of(employee_id)
    OR public.can('performance', 'view')
  );
CREATE POLICY "Create reviews" ON public.performance_reviews FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_of(employee_id) OR public.can('performance', 'manage'));
-- Managers edit reviews they wrote; employees may only acknowledge their own
-- (the trigger limits which columns each of them can change).
CREATE POLICY "Update reviews" ON public.performance_reviews FOR UPDATE TO authenticated
  USING (
    (public.is_manager_of(employee_id) AND reviewer_id = public.get_my_employee_id())
    OR employee_id = public.get_my_employee_id()
    OR public.can('performance', 'manage')
  )
  WITH CHECK (
    (public.is_manager_of(employee_id) AND reviewer_id = public.get_my_employee_id())
    OR employee_id = public.get_my_employee_id()
    OR public.can('performance', 'manage')
  );
CREATE POLICY "Delete reviews" ON public.performance_reviews FOR DELETE TO authenticated
  USING (
    (status = 'draft' AND public.is_manager_of(employee_id) AND reviewer_id = public.get_my_employee_id())
    OR public.can('performance', 'manage')
  );

CREATE POLICY "View KPI ratings" ON public.review_kpi_ratings FOR SELECT TO authenticated
  USING (
    public.can('performance', 'view')
    OR review_id IN (
      SELECT pr.id FROM public.performance_reviews pr
      WHERE pr.employee_id = public.get_my_employee_id() OR public.is_manager_of(pr.employee_id)
    )
  );
CREATE POLICY "Create KPI ratings" ON public.review_kpi_ratings FOR INSERT TO authenticated
  WITH CHECK (
    public.can('performance', 'manage')
    OR review_id IN (
      SELECT pr.id FROM public.performance_reviews pr
      WHERE pr.employee_id = public.get_my_employee_id() OR public.is_manager_of(pr.employee_id)
    )
  );
CREATE POLICY "Update KPI ratings" ON public.review_kpi_ratings FOR UPDATE TO authenticated
  USING (
    public.can('performance', 'manage')
    OR review_id IN (
      SELECT pr.id FROM public.performance_reviews pr
      WHERE pr.employee_id = public.get_my_employee_id() OR public.is_manager_of(pr.employee_id)
    )
  );
CREATE POLICY "Delete KPI ratings" ON public.review_kpi_ratings FOR DELETE TO authenticated
  USING (public.can('performance', 'manage'));

-- ---------------------------------------------------------------------------
-- 9. Assets
-- ---------------------------------------------------------------------------
CREATE POLICY "View assets" ON public.assets FOR SELECT TO authenticated
  USING (
    public.can('assets', 'view')
    OR id IN (SELECT asset_id FROM public.asset_assignments WHERE employee_id = public.get_my_employee_id())
  );
CREATE POLICY "Manage assets" ON public.assets FOR ALL TO authenticated
  USING (public.can('assets', 'manage')) WITH CHECK (public.can('assets', 'manage'));

CREATE POLICY "View asset assignments" ON public.asset_assignments FOR SELECT TO authenticated
  USING (employee_id = public.get_my_employee_id() OR public.can('assets', 'view'));
CREATE POLICY "Manage asset assignments" ON public.asset_assignments FOR ALL TO authenticated
  USING (public.can('assets', 'manage')) WITH CHECK (public.can('assets', 'manage'));

-- ---------------------------------------------------------------------------
-- 10. Payroll
-- ---------------------------------------------------------------------------
CREATE POLICY "View salary structures" ON public.salary_structures FOR SELECT TO authenticated
  USING (employee_id = public.get_my_employee_id() OR public.can('payroll', 'view'));
CREATE POLICY "Manage salary structures" ON public.salary_structures FOR ALL TO authenticated
  USING (public.can('payroll', 'manage')) WITH CHECK (public.can('payroll', 'manage'));

CREATE POLICY "View salary history" ON public.salary_history FOR SELECT TO authenticated
  USING (employee_id = public.get_my_employee_id() OR public.can('payroll', 'view'));
CREATE POLICY "Manage salary history" ON public.salary_history FOR ALL TO authenticated
  USING (public.can('payroll', 'manage')) WITH CHECK (public.can('payroll', 'manage'));

CREATE POLICY "View payroll records" ON public.payroll_records FOR SELECT TO authenticated
  USING (employee_id = public.get_my_employee_id() OR public.can('payroll', 'view'));
CREATE POLICY "Manage payroll records" ON public.payroll_records FOR ALL TO authenticated
  USING (public.can('payroll', 'manage')) WITH CHECK (public.can('payroll', 'manage'));

-- ---------------------------------------------------------------------------
-- 11. Calendar and settings
-- ---------------------------------------------------------------------------
CREATE POLICY "Members view company events" ON public.company_events FOR SELECT TO authenticated
  USING (public.is_active_member());
CREATE POLICY "Manage company events" ON public.company_events FOR ALL TO authenticated
  USING (public.can('calendar', 'manage')) WITH CHECK (public.can('calendar', 'manage'));

-- Readable by any signed-in user: branding and office location are needed
-- everywhere, including by invited users who are still onboarding.
CREATE POLICY "Signed-in users view organization settings" ON public.organization_settings FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Manage organization settings" ON public.organization_settings FOR ALL TO authenticated
  USING (public.can('settings', 'manage')) WITH CHECK (public.can('settings', 'manage'));

CREATE POLICY "Members view system settings" ON public.system_settings FOR SELECT TO authenticated
  USING (public.is_active_member());
CREATE POLICY "Manage system settings" ON public.system_settings FOR ALL TO authenticated
  USING (public.can('settings', 'manage')) WITH CHECK (public.can('settings', 'manage'));

-- ---------------------------------------------------------------------------
-- 12. Per-user tables (unchanged semantics)
-- ---------------------------------------------------------------------------
CREATE POLICY "View own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Service role inserts notifications" ON public.notifications FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "View own notification preferences" ON public.notification_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Insert own notification preferences" ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own notification preferences" ON public.notification_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Manage own push subscriptions" ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Service role reads push subscriptions" ON public.push_subscriptions FOR SELECT TO service_role
  USING (true);

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
