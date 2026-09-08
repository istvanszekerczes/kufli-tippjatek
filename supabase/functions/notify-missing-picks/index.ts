// ============================================================================
// notify-missing-picks — Web Push reminder.
//
// Once, ~within 24h of a matchday's first kickoff, every player who still has
// an un-predicted match in that matchday gets one push notification.
// Deduped via public.notifications_sent, so run it as often as you like
// (pg_cron hourly is fine).
//
// Auth: optional header  x-cron-secret: <CRON_SECRET>  (only enforced if set)
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { corsHeaders, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const secret = Deno.env.get('CRON_SECRET');
  if (secret && req.headers.get('x-cron-secret') !== secret) {
    return json({ error: 'unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey =
    Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    // 1. VAPID
    const { data: secRows } = await db
      .from('app_secrets')
      .select('key, value')
      .in('key', ['vapid_public', 'vapid_private', 'vapid_subject']);
    const S: Record<string, string> = Object.fromEntries((secRows ?? []).map((r) => [r.key, r.value]));
    if (!S.vapid_public || !S.vapid_private) {
      return json({ ok: false, error: 'VAPID keys missing from app_secrets' }, 500);
    }
    webpush.setVapidDetails(S.vapid_subject || 'mailto:admin@example.com', S.vapid_public, S.vapid_private);

    // 2. matchdays with a first kickoff inside the next 24h
    const nowIso = new Date().toISOString();
    const in24Iso = new Date(Date.now() + 24 * 3600e3).toISOString();
    const { data: matches } = await db
      .from('matches')
      .select('id, stage, matchday, kickoff_at')
      .eq('status', 'upcoming')
      .gt('kickoff_at', nowIso)
      .lte('kickoff_at', in24Iso);

    const keyOf = (m: { stage: string; matchday: number | null }) =>
      m.stage === 'group' ? `MD${m.matchday}` : m.stage;

    const groups = new Map<string, string[]>();
    for (const m of matches ?? []) {
      const k = keyOf(m);
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(m.id);
    }
    if (groups.size === 0) return json({ ok: true, matchdays: 0, sent: 0 });

    const { data: cfg } = await db
      .from('tournament_config')
      .select('group_stage_betting, knockout_betting')
      .eq('id', 1)
      .single();

    const { data: subs } = await db.from('push_subscriptions').select('*');
    const subsByUser = new Map<string, any[]>();
    for (const s of subs ?? []) (subsByUser.get(s.user_id) ?? subsByUser.set(s.user_id, []).get(s.user_id)!).push(s);

    let sent = 0;
    let pruned = 0;

    for (const [key, matchIds] of groups) {
      const isGroup = key.startsWith('MD');
      const phaseOpen = isGroup ? cfg?.group_stage_betting : cfg?.knockout_betting;
      if (!phaseOpen) continue;

      const { data: already } = await db
        .from('notifications_sent')
        .select('user_id')
        .eq('kind', 'matchday')
        .eq('key', key);
      const notified = new Set((already ?? []).map((r) => r.user_id));

      for (const [userId, userSubs] of subsByUser) {
        if (notified.has(userId)) continue;

        const { data: preds } = await db
          .from('predictions')
          .select('match_id')
          .eq('user_id', userId)
          .in('match_id', matchIds);
        const have = new Set((preds ?? []).map((p) => p.match_id));
        const missing = matchIds.filter((id) => !have.has(id)).length;
        if (missing === 0) continue;

        const label = isGroup ? `${key.slice(2)}. forduló` : key;
        const payload = JSON.stringify({
          title: 'Kufli TippJáték',
          body: `${label} hamarosan kezdődik – ${missing} meccsre nincs tipped!`,
          tag: `md-${key}`,
          url: '/'
        });

        let anyOk = false;
        for (const s of userSubs) {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload
            );
            anyOk = true;
          } catch (e: any) {
            const code = e?.statusCode ?? 0;
            if (code === 404 || code === 410) {
              await db.from('push_subscriptions').delete().eq('id', s.id);
              pruned++;
            }
          }
        }

        if (anyOk) {
          await db.from('notifications_sent').insert({ user_id: userId, kind: 'matchday', key });
          sent++;
        }
      }
    }

    return json({ ok: true, at: nowIso, matchdays: groups.size, sent, pruned });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: String(err) }, 500);
  }
});
