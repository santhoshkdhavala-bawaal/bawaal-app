-- BAWAAL · ensure public.arena_challenges for Arena publish + feed.
-- Paste into Supabase → SQL Editor and run once per project.
-- Canonical columns: title, sport, video_url, user_id, created_at

create extension if not exists "pgcrypto";

create table if not exists public.arena_challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'OPEN CHALLENGE',
  description text,
  sport text not null default 'COMBAT',
  video_url text,
  user_id text,
  created_at timestamptz not null default now()
);

-- Migrate / extend older shapes safely
alter table public.arena_challenges add column if not exists title text;
alter table public.arena_challenges add column if not exists description text;
alter table public.arena_challenges add column if not exists sport text;
alter table public.arena_challenges add column if not exists video_url text;
alter table public.arena_challenges add column if not exists user_id text;
alter table public.arena_challenges add column if not exists created_at timestamptz default now();

-- Legacy columns kept if already present (soft-compat with older clients)
alter table public.arena_challenges add column if not exists host_id text;
alter table public.arena_challenges add column if not exists host_username text;
alter table public.arena_challenges add column if not exists host_flag text;
alter table public.arena_challenges add column if not exists target_title text;
alter table public.arena_challenges add column if not exists target_details text;
alter table public.arena_challenges add column if not exists opener_video_url text;
alter table public.arena_challenges add column if not exists status text default 'OPEN';
alter table public.arena_challenges add column if not exists response_count integer default 0;

create index if not exists arena_challenges_created_at_idx
  on public.arena_challenges (created_at desc);

create index if not exists arena_challenges_sport_idx
  on public.arena_challenges (sport);

alter table public.arena_challenges enable row level security;

drop policy if exists "arena_challenges_select_all" on public.arena_challenges;
create policy "arena_challenges_select_all" on public.arena_challenges
  for select using (true);

drop policy if exists "arena_challenges_insert_all" on public.arena_challenges;
create policy "arena_challenges_insert_all" on public.arena_challenges
  for insert with check (true);

drop policy if exists "arena_challenges_update_all" on public.arena_challenges;
create policy "arena_challenges_update_all" on public.arena_challenges
  for update using (true);

do $$
begin
  begin
    alter publication supabase_realtime add table public.arena_challenges;
  exception when duplicate_object then null;
  end;
end $$;

notify pgrst, 'reload schema';
