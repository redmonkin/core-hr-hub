-- Fix: Restrict notifications INSERT to service role only
-- This prevents any authenticated user from inserting notifications for any user
-- Only edge functions using service role can create notifications

DROP POLICY IF EXISTS "System insert notifications" ON public.notifications;

CREATE POLICY "Service role can insert notifications" 
ON public.notifications 
FOR INSERT TO service_role
WITH CHECK (true);