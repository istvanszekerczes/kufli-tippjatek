-- ============================================================================
-- Reliable sync scheduling, straight from Postgres.
--
-- GitHub's scheduled workflows are best-effort and get throttled to once every
-- few hours on low-traffic repos — no good during a matchday. pg_cron runs
-- inside your database on the exact interval. It fires a tiny POST at the
-- sync-fixtures Edge Function every 3 minutes; the function does the work.
--
-- SETUP (once):
--   1. Dashboard → Database → Extensions → enable `pg_cron` and `pg_net`.
--   2. Deploy the function:  supabase functions deploy sync-fixtures --no-verify-jwt
--      and set its secrets (SUPABASE_SECRET_KEY, CRON_SECRET, FOOTBALL_API_PROVIDER=uefa).
--   3. Edit the two values below, then run this whole file in the SQL editor.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- >>> EDIT THESE TWO <<<
--   FUNCTIONS_URL : https://<your-project-ref>.supabase.co/functions/v1
--   CRON_SECRET   : the same value you set with `supabase secrets set CRON_SECRET=...`

do $$
declare
  functions_url text := 'https://qehmgeeejcnfsblkrvgq.supabase.co/functions/v1';
  cron_secret   text := 'REPLACE_WITH_YOUR_CRON_SECRET';
begin
  -- clear any previous schedule of this job
  perform cron.unschedule(jobid) from cron.job where jobname = 'kufli-sync';

  perform cron.schedule(
    'kufli-sync',
    '*/3 * * * *',
    format($cmd$
      select net.http_post(
        url     := %L,
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', %L),
        body    := '{}'::jsonb
      );
    $cmd$, functions_url || '/sync-fixtures', cron_secret)
  );
end $$;

-- inspect:
--   select jobname, schedule, active from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
-- remove:
--   select cron.unschedule('kufli-sync');
