
-- 1) Restrict system_settings SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can read system settings" ON public.system_settings;

CREATE POLICY "Authenticated users can read system settings"
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- 2) Server-side enforcement of the "blocked" flag on profiles
CREATE OR REPLACE FUNCTION public.is_not_blocked()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT COALESCE(
    (SELECT blocked FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Apply blocked check via restrictive policies on sensitive tables.
-- Restrictive policies are AND-combined with existing permissive policies,
-- so all other access rules continue to apply unchanged.

CREATE POLICY "Block access for blocked users"
  ON public.employees AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_not_blocked())
  WITH CHECK (public.is_not_blocked());

CREATE POLICY "Block access for blocked users"
  ON public.leave_requests AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_not_blocked())
  WITH CHECK (public.is_not_blocked());

CREATE POLICY "Block access for blocked users"
  ON public.leave_balances AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_not_blocked())
  WITH CHECK (public.is_not_blocked());

CREATE POLICY "Block access for blocked users"
  ON public.attendance_records AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_not_blocked())
  WITH CHECK (public.is_not_blocked());

CREATE POLICY "Block access for blocked users"
  ON public.attendance_breaks AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_not_blocked())
  WITH CHECK (public.is_not_blocked());

CREATE POLICY "Block access for blocked users"
  ON public.payroll_records AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_not_blocked())
  WITH CHECK (public.is_not_blocked());

CREATE POLICY "Block access for blocked users"
  ON public.salary_structures AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_not_blocked())
  WITH CHECK (public.is_not_blocked());

CREATE POLICY "Block access for blocked users"
  ON public.salary_history AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_not_blocked())
  WITH CHECK (public.is_not_blocked());

CREATE POLICY "Block access for blocked users"
  ON public.profiles AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_not_blocked())
  WITH CHECK (public.is_not_blocked());

CREATE POLICY "Block access for blocked users"
  ON public.goals AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_not_blocked())
  WITH CHECK (public.is_not_blocked());

CREATE POLICY "Block access for blocked users"
  ON public.performance_reviews AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_not_blocked())
  WITH CHECK (public.is_not_blocked());

CREATE POLICY "Block access for blocked users"
  ON public.review_kpi_ratings AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_not_blocked())
  WITH CHECK (public.is_not_blocked());

CREATE POLICY "Block access for blocked users"
  ON public.assets AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_not_blocked())
  WITH CHECK (public.is_not_blocked());

CREATE POLICY "Block access for blocked users"
  ON public.asset_assignments AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_not_blocked())
  WITH CHECK (public.is_not_blocked());

CREATE POLICY "Block access for blocked users"
  ON public.employee_documents AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_not_blocked())
  WITH CHECK (public.is_not_blocked());

CREATE POLICY "Block access for blocked users"
  ON public.employee_leave_eligibility AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_not_blocked())
  WITH CHECK (public.is_not_blocked());

CREATE POLICY "Block access for blocked users"
  ON public.notifications AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_not_blocked())
  WITH CHECK (public.is_not_blocked());

CREATE POLICY "Block access for blocked users"
  ON public.onboarding_requests AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.is_not_blocked())
  WITH CHECK (public.is_not_blocked());
