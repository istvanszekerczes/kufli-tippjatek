-- ============================================================================
-- OPTIONAL — schedule sync-fixtures from inside Postgres (instead of, or in
-- addition to, the GitHub Actions workflow in .github/workflows/).
--
-- Requires the `pg_cron` and `pg_net` extensions:
--   Dashboard -> Database -> Extensions -> enable `pg_cron` and `pg_net`.
-- Run this file once in the SQL editor after editing the two secrets below.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1. Store the function base URL and cron secret in Vault (run once, then
--    delete these two lines or they will error on re-run):
--
--   select vault.create_secret('https://<PROJECT_REF>.supabase.co/functions/v1', 'functions_base_url');
--   select vault.create_secret('<YOUR_CRON_SECRET>', 'cron_secret');

-- 2. Schedule the job every 10 minutes.
select cron.schedule(
  'sync-fixtures-every-10-min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'functions_base_url') || '/sync-fixtures',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- To inspect or remove:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 20;
--   select cron.unschedule('sync-fixtures-every-10-min');
