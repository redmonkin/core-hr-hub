-- Close the gap left by 20260418092602: blocked-user restrictive policy was
-- applied to 18 tables but omitted user_roles, letting a blocked user still
-- read the full role/permission map.
CREATE POLICY "Block access for blocked users"
  ON public.user_roles AS RESTRICTIVE
  FOR ALL
  USING (public.is_not_blocked())
  WITH CHECK (public.is_not_blocked());

-- Indexes for the columns hooks filter on most heavily.
CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_date
  ON public.attendance_records (employee_id, date);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_status
  ON public.leave_requests (employee_id, status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee_id
  ON public.employee_documents (employee_id);

CREATE INDEX IF NOT EXISTS idx_asset_assignments_asset_returned
  ON public.asset_assignments (asset_id, returned_date);
