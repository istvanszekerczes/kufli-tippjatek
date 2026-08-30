-- ============================================================================
-- 0005_realtime.sql — publish row changes the frontend subscribes to
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['matches', 'predictions', 'outright_predictions', 'tournament_config']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
