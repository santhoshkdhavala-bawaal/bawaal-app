-- BAWAAL · Arena dashboard shelves + War Cry live match sync.
-- Paste into Supabase → SQL Editor and run once per project.
-- Tables: war_cry_matches, sparks_josh_clips, battle_bawaal_reels, face_off_challenges

create extension if not exists "pgcrypto";

-- ─── War Cry live dual-feed matches ─────────────────────────────────────────
create table if not exists public.war_cry_matches (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'LIVE',
  sport text not null default 'COMBAT',
  host_handle text not null default '@host',
  rival_handle text not null default '@rival',
  host_score integer not null default 0,
  rival_score integer not null default 0,
  spectator_count integer not null default 0,
  room_id text,
  title text default 'WAR CRY · LIVE',
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.war_cry_matches add column if not exists status text default 'LIVE';
alter table public.war_cry_matches add column if not exists sport text default 'COMBAT';
alter table public.war_cry_matches add column if not exists host_handle text default '@host';
alter table public.war_cry_matches add column if not exists rival_handle text default '@rival';
alter table public.war_cry_matches add column if not exists host_score integer default 0;
alter table public.war_cry_matches add column if not exists rival_score integer default 0;
alter table public.war_cry_matches add column if not exists spectator_count integer default 0;
alter table public.war_cry_matches add column if not exists room_id text;
alter table public.war_cry_matches add column if not exists title text default 'WAR CRY · LIVE';
alter table public.war_cry_matches add column if not exists thumbnail_url text;
alter table public.war_cry_matches add column if not exists created_at timestamptz default now();
alter table public.war_cry_matches add column if not exists updated_at timestamptz default now();

create index if not exists war_cry_matches_status_idx
  on public.war_cry_matches (status, updated_at desc);

alter table public.war_cry_matches enable row level security;

drop policy if exists "war_cry_matches_select_all" on public.war_cry_matches;
create policy "war_cry_matches_select_all" on public.war_cry_matches
  for select using (true);

drop policy if exists "war_cry_matches_insert_all" on public.war_cry_matches;
create policy "war_cry_matches_insert_all" on public.war_cry_matches
  for insert with check (true);

drop policy if exists "war_cry_matches_update_all" on public.war_cry_matches;
create policy "war_cry_matches_update_all" on public.war_cry_matches
  for update using (true);

-- ─── Sparks & Josh shelf clips ──────────────────────────────────────────────
create table if not exists public.sparks_josh_clips (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'SPARK',
  sport text not null default 'ARENA',
  mode text not null default 'SPARK',
  author text default '@athlete',
  video_url text,
  thumbnail_url text,
  user_id text,
  created_at timestamptz not null default now()
);

alter table public.sparks_josh_clips add column if not exists title text default 'SPARK';
alter table public.sparks_josh_clips add column if not exists sport text default 'ARENA';
alter table public.sparks_josh_clips add column if not exists mode text default 'SPARK';
alter table public.sparks_josh_clips add column if not exists author text default '@athlete';
alter table public.sparks_josh_clips add column if not exists video_url text;
alter table public.sparks_josh_clips add column if not exists thumbnail_url text;
alter table public.sparks_josh_clips add column if not exists user_id text;
alter table public.sparks_josh_clips add column if not exists created_at timestamptz default now();

create index if not exists sparks_josh_clips_created_at_idx
  on public.sparks_josh_clips (created_at desc);

alter table public.sparks_josh_clips enable row level security;

drop policy if exists "sparks_josh_clips_select_all" on public.sparks_josh_clips;
create policy "sparks_josh_clips_select_all" on public.sparks_josh_clips
  for select using (true);

drop policy if exists "sparks_josh_clips_insert_all" on public.sparks_josh_clips;
create policy "sparks_josh_clips_insert_all" on public.sparks_josh_clips
  for insert with check (true);

-- ─── Battle Bawaal group reels ──────────────────────────────────────────────
create table if not exists public.battle_bawaal_reels (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'BATTLE BAWAAL',
  sport text not null default 'COMBAT',
  author text default '@athlete',
  video_url text,
  thumbnail_url text,
  user_id text,
  participant_count integer default 0,
  created_at timestamptz not null default now()
);

alter table public.battle_bawaal_reels add column if not exists title text default 'BATTLE BAWAAL';
alter table public.battle_bawaal_reels add column if not exists sport text default 'COMBAT';
alter table public.battle_bawaal_reels add column if not exists author text default '@athlete';
alter table public.battle_bawaal_reels add column if not exists video_url text;
alter table public.battle_bawaal_reels add column if not exists thumbnail_url text;
alter table public.battle_bawaal_reels add column if not exists user_id text;
alter table public.battle_bawaal_reels add column if not exists participant_count integer default 0;
alter table public.battle_bawaal_reels add column if not exists created_at timestamptz default now();

create index if not exists battle_bawaal_reels_created_at_idx
  on public.battle_bawaal_reels (created_at desc);

alter table public.battle_bawaal_reels enable row level security;

drop policy if exists "battle_bawaal_reels_select_all" on public.battle_bawaal_reels;
create policy "battle_bawaal_reels_select_all" on public.battle_bawaal_reels
  for select using (true);

drop policy if exists "battle_bawaal_reels_insert_all" on public.battle_bawaal_reels;
create policy "battle_bawaal_reels_insert_all" on public.battle_bawaal_reels
  for insert with check (true);

-- ─── Face Off open challenges ───────────────────────────────────────────────
create table if not exists public.face_off_challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'FACE OFF',
  sport text not null default 'ARENA',
  author text default '@athlete',
  status text not null default 'OPEN',
  video_url text,
  thumbnail_url text,
  user_id text,
  created_at timestamptz not null default now()
);

alter table public.face_off_challenges add column if not exists title text default 'FACE OFF';
alter table public.face_off_challenges add column if not exists sport text default 'ARENA';
alter table public.face_off_challenges add column if not exists author text default '@athlete';
alter table public.face_off_challenges add column if not exists status text default 'OPEN';
alter table public.face_off_challenges add column if not exists video_url text;
alter table public.face_off_challenges add column if not exists thumbnail_url text;
alter table public.face_off_challenges add column if not exists user_id text;
alter table public.face_off_challenges add column if not exists created_at timestamptz default now();

create index if not exists face_off_challenges_created_at_idx
  on public.face_off_challenges (created_at desc);

alter table public.face_off_challenges enable row level security;

drop policy if exists "face_off_challenges_select_all" on public.face_off_challenges;
create policy "face_off_challenges_select_all" on public.face_off_challenges
  for select using (true);

drop policy if exists "face_off_challenges_insert_all" on public.face_off_challenges;
create policy "face_off_challenges_insert_all" on public.face_off_challenges
  for insert with check (true);

-- Realtime publication (idempotent)
do $$
begin
  begin
    alter publication supabase_realtime add table public.war_cry_matches;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.sparks_josh_clips;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.battle_bawaal_reels;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.face_off_challenges;
  exception when duplicate_object then null;
  end;
end $$;

notify pgrst, 'reload schema';
