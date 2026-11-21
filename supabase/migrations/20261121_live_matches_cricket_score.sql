-- BAWAAL Live Match — cricket scoring fields
-- Safe to re-run. Clients soft-fail + broadcast when columns are absent.

alter table public.live_matches
  add column if not exists batting_team text not null default 'A';

alter table public.live_matches
  add column if not exists cricket_runs_a integer not null default 0;

alter table public.live_matches
  add column if not exists cricket_wickets_a integer not null default 0;

alter table public.live_matches
  add column if not exists cricket_balls_a integer not null default 0;

alter table public.live_matches
  add column if not exists cricket_runs_b integer not null default 0;

alter table public.live_matches
  add column if not exists cricket_wickets_b integer not null default 0;

alter table public.live_matches
  add column if not exists cricket_balls_b integer not null default 0;

do $$
begin
  alter table public.live_matches
    drop constraint if exists live_matches_batting_team_check;
  alter table public.live_matches
    add constraint live_matches_batting_team_check
    check (batting_team in ('A', 'B'));
exception
  when others then null;
end $$;

comment on column public.live_matches.batting_team is
  'Cricket batting side: A or B.';
comment on column public.live_matches.cricket_balls_a is
  'Legal balls faced by team A (overs = balls/6, rem = balls%6).';
comment on column public.live_matches.cricket_balls_b is
  'Legal balls faced by team B (overs = balls/6, rem = balls%6).';
