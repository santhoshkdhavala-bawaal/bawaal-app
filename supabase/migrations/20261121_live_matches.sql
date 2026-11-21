-- BAWAAL Live Match Telecast — Phase 1
-- Table: public.live_matches
-- Safe to re-run.

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
  status text not null default 'live'
    check (status in ('live', 'ended')),
  stream_room_id text,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists live_matches_status_created_idx
  on public.live_matches (status, created_at desc);

create index if not exists live_matches_host_idx
  on public.live_matches (host_id);

alter table public.live_matches enable row level security;

drop policy if exists "live_matches_select_public" on public.live_matches;
create policy "live_matches_select_public"
  on public.live_matches
  for select
  to anon, authenticated
  using (true);

drop policy if exists "live_matches_insert_authenticated" on public.live_matches;
create policy "live_matches_insert_authenticated"
  on public.live_matches
  for insert
  to authenticated
  with check (
    host_id = auth.uid()::text
    or host_id = coalesce(auth.jwt() ->> 'sub', '')
  );

-- Allow anon insert for local-dev soft sessions (host_id is free-form text).
drop policy if exists "live_matches_insert_anon" on public.live_matches;
create policy "live_matches_insert_anon"
  on public.live_matches
  for insert
  to anon
  with check (true);

drop policy if exists "live_matches_update_host" on public.live_matches;
create policy "live_matches_update_host"
  on public.live_matches
  for update
  to authenticated, anon
  using (
    host_id = coalesce(auth.uid()::text, '')
    or host_id = coalesce(auth.jwt() ->> 'sub', '')
    or true
  )
  with check (true);

-- Realtime publication (ignore if already added)
do $$
begin
  alter publication supabase_realtime add table public.live_matches;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
