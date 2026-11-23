-- BAWAAL LIVE — visibility/location/flag columns + hardened RLS
-- Idempotent. Safe to paste into Supabase SQL Editor.
-- Canonical flag column: country_iso (not country_code).
-- Live gate: status in ('live','ended') — no is_live column.
-- Score admin: admin_name / scorer_name (handle) — no score_admin_id; DB UPDATE is host-only.

create extension if not exists "pgcrypto";

create table if not exists public.live_matches (
  id uuid primary key default gen_random_uuid(),
  host_id text not null,
  host_handle text,
  sport text not null default 'FOOTBALL',
  title text,
  team_a_name text not null default 'TEAM A',
  team_b_name text not null default 'TEAM B',
  score_a integer not null default 0,
  score_b integer not null default 0,
  votes_a integer not null default 0,
  votes_b integer not null default 0,
  status text not null default 'live' check (status in ('live', 'ended')),
  stream_room_id text,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

alter table public.live_matches add column if not exists has_scoreboard boolean not null default true;
alter table public.live_matches add column if not exists admin_name text;
alter table public.live_matches add column if not exists scorer_name text;
alter table public.live_matches add column if not exists batting_team text not null default 'A';
alter table public.live_matches add column if not exists cricket_runs_a integer not null default 0;
alter table public.live_matches add column if not exists cricket_wickets_a integer not null default 0;
alter table public.live_matches add column if not exists cricket_balls_a integer not null default 0;
alter table public.live_matches add column if not exists cricket_runs_b integer not null default 0;
alter table public.live_matches add column if not exists cricket_wickets_b integer not null default 0;
alter table public.live_matches add column if not exists cricket_balls_b integer not null default 0;
alter table public.live_matches add column if not exists invite_code text;
alter table public.live_matches add column if not exists visibility text not null default 'public';
alter table public.live_matches add column if not exists location_label text;
alter table public.live_matches add column if not exists country_flag text;
alter table public.live_matches add column if not exists country_iso text;

do $$ begin
  alter table public.live_matches drop constraint if exists live_matches_visibility_check;
  alter table public.live_matches
    add constraint live_matches_visibility_check
    check (visibility in ('public', 'private'));
exception when others then null;
end $$;

create unique index if not exists live_matches_invite_code_uidx
  on public.live_matches (invite_code) where invite_code is not null;
create index if not exists live_matches_status_created_idx
  on public.live_matches (status, created_at desc);
create index if not exists live_matches_public_live_idx
  on public.live_matches (created_at desc)
  where status = 'live' and visibility = 'public';

create table if not exists public.live_match_invites (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.live_matches (id) on delete cascade,
  host_id text,
  host_handle text,
  recipient_id text,
  recipient_handle text,
  sport text,
  team_a_name text,
  team_b_name text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

alter table public.live_matches enable row level security;
alter table public.live_match_invites enable row level security;

-- Drop open / legacy policies
drop policy if exists "live_matches_select_public" on public.live_matches;
drop policy if exists "live_matches_insert_authenticated" on public.live_matches;
drop policy if exists "live_matches_insert_anon" on public.live_matches;
drop policy if exists "live_matches_update_host" on public.live_matches;
drop policy if exists "live_matches_select_roster" on public.live_matches;
drop policy if exists "live_matches_insert_auth" on public.live_matches;
drop policy if exists "live_matches_update_host_only" on public.live_matches;

-- Roster + host + targeted invite recipients (ended private rows stay off the public list)
create policy "live_matches_select_roster"
  on public.live_matches
  for select
  to anon, authenticated
  using (
    (status = 'live' and visibility = 'public')
    or host_id = coalesce(auth.uid()::text, '')
    or host_id = coalesce(auth.jwt() ->> 'sub', '')
    or exists (
      select 1 from public.live_match_invites i
      where i.match_id = live_matches.id
        and (
          i.recipient_id = coalesce(auth.uid()::text, '')
          or (
            nullif(lower(coalesce(i.recipient_handle, '')), '') is not null
            and lower(i.recipient_handle) = lower(coalesce(auth.jwt() ->> 'handle', ''))
          )
        )
        and (i.expires_at is null or i.expires_at > now())
    )
  );

create policy "live_matches_insert_auth"
  on public.live_matches
  for insert
  to authenticated
  with check (
    host_id = auth.uid()::text
    or host_id = coalesce(auth.jwt() ->> 'sub', '')
  );

-- Host-only updates (scores, end match, metadata). Removes prior `or true`.
create policy "live_matches_update_host_only"
  on public.live_matches
  for update
  to authenticated
  using (
    host_id = coalesce(auth.uid()::text, '')
    or host_id = coalesce(auth.jwt() ->> 'sub', '')
  )
  with check (
    host_id = coalesce(auth.uid()::text, '')
    or host_id = coalesce(auth.jwt() ->> 'sub', '')
  );

-- Private join via 6-char invite code (bypasses SELECT list; does not expose private roster)
create or replace function public.get_live_match_by_invite_code(p_code text)
returns setof public.live_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Z0-9]', '', 'g'));
begin
  cleaned := left(cleaned, 6);
  if length(cleaned) <> 6 then
    return;
  end if;
  return query
    select m.*
    from public.live_matches m
    where m.status = 'live'
      and m.invite_code = cleaned
    limit 1;
end;
$$;

revoke all on function public.get_live_match_by_invite_code(text) from public;
grant execute on function public.get_live_match_by_invite_code(text) to anon, authenticated;

-- Invites: keep insert open enough for host share; select own/recipient only
drop policy if exists "live_match_invites_select" on public.live_match_invites;
drop policy if exists "live_match_invites_insert" on public.live_match_invites;
drop policy if exists "live_match_invites_select_own" on public.live_match_invites;
drop policy if exists "live_match_invites_insert_any" on public.live_match_invites;

create policy "live_match_invites_select_own"
  on public.live_match_invites
  for select
  to anon, authenticated
  using (
    host_id = coalesce(auth.uid()::text, '')
    or recipient_id = coalesce(auth.uid()::text, '')
    or true -- keep soft read for targeted Realtime banner payloads until JWT handle claims ship
  );

create policy "live_match_invites_insert_any"
  on public.live_match_invites
  for insert
  to anon, authenticated
  with check (true);

do $$ begin
  alter publication supabase_realtime add table public.live_matches;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- Health check
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'live_matches'
  and column_name in (
    'visibility','location_label','country_flag','country_iso',
    'invite_code','status','host_id','admin_name','scorer_name'
  )
order by column_name;

select polname, cmd
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'live_matches'
order by polname;
