-- BAWAAL · ensure battles table accepts OPEN challenge status + opener clip.
-- Paste into Supabase → SQL Editor and run once per project.

create extension if not exists "pgcrypto";

create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  host_id text not null,
  host_username text,
  host_flag text,
  title text,
  category text,
  match_length text,
  status text not null default 'live',
  host_reps integer not null default 0,
  total_spectators integer not null default 1,
  opener_video_url text,
  created_at timestamptz not null default now()
);

alter table public.battles
  add column if not exists opener_video_url text;

alter table public.battles drop constraint if exists battles_status_check;

alter table public.battles
  add constraint battles_status_check
  check (status in ('open', 'scheduled', 'live', 'completed'));

alter table public.battles enable row level security;

drop policy if exists "battles_select_all" on public.battles;
create policy "battles_select_all" on public.battles for select using (true);

drop policy if exists "battles_insert_all" on public.battles;
create policy "battles_insert_all" on public.battles for insert with check (true);

drop policy if exists "battles_update_all" on public.battles;
create policy "battles_update_all" on public.battles for update using (true);

notify pgrst, 'reload schema';
