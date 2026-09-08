-- ============================================================================
-- 0010_push.sql — Web Push: device subscriptions + a send-once ledger + a
-- tiny service-role-only secrets table (holds the VAPID keys).
-- ============================================================================

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- one row per (user, notification) so the sender never double-notifies
create table if not exists public.notifications_sent (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind    text not null,
  key     text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, key)
);

-- read only by the service role (RLS on, no policies)
create table if not exists public.app_secrets (
  key   text primary key,
  value text not null
);

alter table public.push_subscriptions enable row level security;
alter table public.notifications_sent  enable row level security;
alter table public.app_secrets         enable row level security;

drop policy if exists "push: read own"   on public.push_subscriptions;
drop policy if exists "push: insert own" on public.push_subscriptions;
drop policy if exists "push: update own" on public.push_subscriptions;
drop policy if exists "push: delete own" on public.push_subscriptions;

create policy "push: read own"   on public.push_subscriptions for select to authenticated using (auth.uid() = user_id);
create policy "push: insert own" on public.push_subscriptions for insert to authenticated with check (auth.uid() = user_id);
create policy "push: update own" on public.push_subscriptions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "push: delete own" on public.push_subscriptions for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;
-- notifications_sent and app_secrets get no grants → service role only

-- VAPID public key (also shipped to the browser) + contact subject.
-- The PRIVATE key is NOT in version control — add it once with:
--   insert into public.app_secrets (key, value)
--   values ('vapid_private', '<your VAPID private key>')
--   on conflict (key) do update set value = excluded.value;
insert into public.app_secrets (key, value) values
  ('vapid_public',  'BJy9QFUma1Uz7hBGh1DvspGe0xlja_QlmMjYUgvad5kc1YpfFqMsuDTodXA2dhAFOQ7LHyCgqlRFaYvCFQyPhT0'),
  ('vapid_subject', 'mailto:szekerczesistvan2004@gmail.com')
on conflict (key) do update set value = excluded.value;
