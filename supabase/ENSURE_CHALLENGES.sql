-- BAWAAL · Destination publish: challenges + challenge_responses
-- Run in Supabase SQL Editor. Safe to re-run.

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  gladiator_id uuid,
  title text not null,
  hashtag text,
  tier text not null default 'dark_arena',
  video_url text,
  status text default 'OPEN',
  created_at timestamptz not null default now()
);

alter table public.challenges add column if not exists gladiator_id uuid;
alter table public.challenges add column if not exists title text;
alter table public.challenges add column if not exists hashtag text;
alter table public.challenges add column if not exists tier text;
alter table public.challenges add column if not exists video_url text;
alter table public.challenges add column if not exists status text;
alter table public.challenges add column if not exists created_at timestamptz default now();

create index if not exists challenges_created_at_idx
  on public.challenges (created_at desc);
create index if not exists challenges_tier_idx
  on public.challenges (tier);
create index if not exists challenges_gladiator_id_idx
  on public.challenges (gladiator_id);

alter table public.challenges enable row level security;

drop policy if exists "challenges_select_all" on public.challenges;
create policy "challenges_select_all" on public.challenges
  for select using (true);

drop policy if exists "challenges_insert_all" on public.challenges;
create policy "challenges_insert_all" on public.challenges
  for insert with check (true);

drop policy if exists "challenges_update_all" on public.challenges;
create policy "challenges_update_all" on public.challenges
  for update using (true) with check (true);

grant select, insert, update, delete on public.challenges to anon, authenticated;

create table if not exists public.challenge_responses (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references public.challenges (id) on delete cascade,
  athlete_id uuid,
  video_url text not null,
  created_at timestamptz not null default now()
);

alter table public.challenge_responses add column if not exists challenge_id uuid;
alter table public.challenge_responses add column if not exists athlete_id uuid;
alter table public.challenge_responses add column if not exists video_url text;
alter table public.challenge_responses add column if not exists created_at timestamptz default now();

create index if not exists challenge_responses_challenge_id_idx
  on public.challenge_responses (challenge_id);
create index if not exists challenge_responses_created_at_idx
  on public.challenge_responses (created_at desc);

alter table public.challenge_responses enable row level security;

drop policy if exists "challenge_responses_select_all" on public.challenge_responses;
create policy "challenge_responses_select_all" on public.challenge_responses
  for select using (true);

drop policy if exists "challenge_responses_insert_all" on public.challenge_responses;
create policy "challenge_responses_insert_all" on public.challenge_responses
  for insert with check (true);

grant select, insert, update, delete on public.challenge_responses to anon, authenticated;

-- Optional Pro unlock column on profiles
alter table public.profiles add column if not exists is_pro boolean default false;
alter table public.profiles add column if not exists tier text;

do $$
begin
  begin
    alter publication supabase_realtime add table public.challenges;
  exception when duplicate_object then null;
  end;
end $$;
