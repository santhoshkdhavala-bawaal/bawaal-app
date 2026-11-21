-- BAWAAL Live Match — optional scoreboard + admin/scorer labels
-- Safe to re-run. Soft-fail clients work before this migration lands.

alter table public.live_matches
  add column if not exists has_scoreboard boolean not null default true;

alter table public.live_matches
  add column if not exists admin_name text;

alter table public.live_matches
  add column if not exists scorer_name text;

comment on column public.live_matches.has_scoreboard is
  'When false, room is pure telecast (no scoreboard / host score controls).';

comment on column public.live_matches.admin_name is
  'Display name/handle of designated scorer/admin (may differ from host).';

comment on column public.live_matches.scorer_name is
  'Alias of admin_name for scorer punch role display.';
