-- ============================================================================
-- 0004_views.sql — leaderboard
-- ============================================================================

-- security_invoker = off (the default): the view runs with the owner's rights
-- so it can aggregate every player's points, while RLS still hides individual
-- prediction rows from other users.
create or replace view public.leaderboard as
with pred as (
  select p.user_id,
         coalesce(sum(p.points_awarded), 0)::int                       as pts,
         count(p.points_awarded)::int                                  as scored,
         count(*) filter (where p.points_awarded = 5)::int             as exact_hits
  from public.predictions p
  group by p.user_id
),
outr as (
  select o.user_id, coalesce(sum(o.points_awarded), 0)::int as pts
  from public.outright_predictions o
  group by o.user_id
)
select
  pr.id                                                              as user_id,
  pr.username,
  (coalesce(pred.pts, 0) + coalesce(outr.pts, 0))                    as total_points,
  coalesce(pred.scored, 0)                                           as matches_scored,
  coalesce(pred.exact_hits, 0)                                       as exact_hits,
  rank() over (order by coalesce(pred.pts, 0) + coalesce(outr.pts, 0) desc)::int as rank
from public.profiles pr
left join pred on pred.user_id = pr.id
left join outr on outr.user_id = pr.id;

grant select on public.leaderboard to authenticated, anon;
