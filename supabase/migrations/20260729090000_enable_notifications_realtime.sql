-- The notification bell subscribes to postgres_changes on `notifications`,
-- but no table was ever added to the supabase_realtime publication, so the
-- subscription silently receives nothing and new notifications only appear
-- after a remount or mark-read action. Add notifications (and the existing
-- leave_requests dashboard subscription, which has the same gap) so both
-- realtime subscriptions actually fire.
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
