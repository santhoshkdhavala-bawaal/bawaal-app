-- BAWAAL · ensure public.arena_challenges for OPEN Arena challenges.
-- Paste into Supabase → SQL Editor and run once per project.

create extension if not exists "pgcrypto";

create table if not exists public.arena_challenges (
  id uuid primary key default gen_random_uuid(),
  host_id text not null,
  host_username text,
  host_flag text,
  sport text not null default 'COMBAT',
  target_title text not null,
  target_details text,
  opener_video_url text,
  status text not null default 'OPEN'
    check (status in ('OPEN', 'LIVE', 'CLOSED')),
  response_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists arena_challenges_created_at_idx
  on public.arena_challenges (created_at desc);

create index if not exists arena_challenges_status_idx
  on public.arena_challenges (status);

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
