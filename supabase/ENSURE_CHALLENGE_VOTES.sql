-- BAWAAL · Custom Matchup votes + response display columns
-- Run in Supabase SQL Editor. Safe to re-run.
-- Depends on: public.challenges, public.challenge_responses (ENSURE_CHALLENGES.sql)

alter table public.challenge_responses add column if not exists handle text;
alter table public.challenge_responses add column if not exists display_name text;
alter table public.challenge_responses add column if not exists votes integer default 0;

create table if not exists public.challenge_votes (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references public.challenges (id) on delete cascade,
  fighter_a_id uuid,
  fighter_b_id uuid,
  voted_for_id uuid,
  response_id uuid,
  voter_id uuid,
  created_at timestamptz not null default now()
);

alter table public.challenge_votes add column if not exists challenge_id uuid;
alter table public.challenge_votes add column if not exists fighter_a_id uuid;
alter table public.challenge_votes add column if not exists fighter_b_id uuid;
alter table public.challenge_votes add column if not exists voted_for_id uuid;
alter table public.challenge_votes add column if not exists response_id uuid;
alter table public.challenge_votes add column if not exists voter_id uuid;
alter table public.challenge_votes add column if not exists created_at timestamptz default now();

create index if not exists challenge_votes_challenge_id_idx
  on public.challenge_votes (challenge_id);
create index if not exists challenge_votes_voted_for_idx
  on public.challenge_votes (voted_for_id);
create index if not exists challenge_votes_pair_idx
  on public.challenge_votes (challenge_id, fighter_a_id, fighter_b_id);

alter table public.challenge_votes enable row level security;

drop policy if exists "challenge_votes_select_all" on public.challenge_votes;
create policy "challenge_votes_select_all" on public.challenge_votes
  for select using (true);

drop policy if exists "challenge_votes_insert_all" on public.challenge_votes;
create policy "challenge_votes_insert_all" on public.challenge_votes
  for insert with check (true);

drop policy if exists "challenge_votes_delete_all" on public.challenge_votes;
create policy "challenge_votes_delete_all" on public.challenge_votes
  for delete using (true);

grant select, insert, update, delete on public.challenge_votes to anon, authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.challenge_votes;
  exception when duplicate_object then null;
  end;
end $$;
