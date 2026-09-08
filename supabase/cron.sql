-- ============================================================================
-- Reliable sync scheduling — run this ONCE in the Supabase SQL editor.
--
-- GitHub's scheduled workflows are best-effort and get throttled to once every
-- few hours on a low-traffic repo, which lags live results by hours on a
-- matchday. pg_cron runs inside your database on the exact interval — it fires
-- a POST at the already-deployed `sync-fixtures` Edge Function every 3 minutes.
--
-- The function needs no secret (it defaults to provider=uefa and Supabase's
-- built-in service key), so there is nothing to edit here.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- replace any previous schedule of this job
select cron.unschedule(jobid) from cron.job where jobname = 'kufli-sync';

select cron.schedule(
  'kufli-sync',
  '*/3 * * * *',
  $$
  select net.http_post(
    url     := 'https://qehmgeeejcnfsblkrvgq.supabase.co/functions/v1/sync-fixtures',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- missing-picks push reminder — hourly (deduped, so the exact minute doesn't matter)
select cron.unschedule(jobid) from cron.job where jobname = 'kufli-notify';

select cron.schedule(
  'kufli-notify',
  '7 * * * *',
  $$
  select net.http_post(
    url     := 'https://qehmgeeejcnfsblkrvgq.supabase.co/functions/v1/notify-missing-picks',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- check it:
--   select jobname, schedule, active from cron.job;
--   select status, return_message, start_time
--   from cron.job_run_details where jobid = (select jobid from cron.job where jobname='kufli-sync')
--   order by start_time desc limit 10;
-- remove it:
--   select cron.unschedule('kufli-sync');
