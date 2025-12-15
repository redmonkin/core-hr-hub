-- Schedule weekly event notifications every Monday at 8 AM UTC
SELECT cron.schedule(
  'weekly-event-notifications',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url:='https://ppdsxgkmnmjfwmpnamts.supabase.co/functions/v1/event-notification',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZHN4Z2ttbm1qZndtcG5hbXRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyOTU5NTcsImV4cCI6MjA4MDg3MTk1N30.nqyBQ6C1XViRSzmp0ROaOydmuwegGgtemZxE99UczHE'
    ),
    body:='{}'::jsonb
  ) AS request_id;
  $$
);