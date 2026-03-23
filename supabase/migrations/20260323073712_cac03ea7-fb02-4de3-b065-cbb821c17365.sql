DROP POLICY "Service role read all subscriptions" ON public.push_subscriptions;

CREATE POLICY "Service role read all subscriptions"
ON public.push_subscriptions
FOR SELECT
TO service_role
USING (true);