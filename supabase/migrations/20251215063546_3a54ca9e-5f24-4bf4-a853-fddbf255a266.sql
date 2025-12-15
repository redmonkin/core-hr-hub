-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule onboarding reminders to run daily at 9 AM UTC
SELECT cron.schedule(
  'onboarding-reminders-daily',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://ppdsxgkmnmjfwmpnamts.supabase.co/functions/v1/onboarding-reminders',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZHN4Z2ttbm1qZndtcG5hbXRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyOTU5NTcsImV4cCI6MjA4MDg3MTk1N30.nqyBQ6C1XViRSzmp0ROaOydmuwegGgtemZxE99UczHE"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);