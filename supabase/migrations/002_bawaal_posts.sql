-- BAWAAL · Arena feed posts (SPARKS / JOSH reels)
-- Persists metadata so clips survive app restart.
-- Run via Supabase SQL editor or: supabase db push

create table if not exists public.bawaal_posts (
  id text primary key,
  mode text,
  title text,
  caption text,
  tagline text,
  author text,
  creator text,
  category text default 'GYM',
  sport text default 'GYM',
  video_url text not null,
  hype_count integer not null default 0,
  duration_sec numeric,
  slow_mo_enabled boolean not null default false,
  slow_mo_rate numeric,
  slow_mo_start_sec numeric,
  slow_mo_end_sec numeric,
  feed text not null default 'ARENA',
  created_at timestamptz not null default now()
);

create index if not exists bawaal_posts_created_at_idx
  on public.bawaal_posts (created_at desc);

create index if not exists bawaal_posts_feed_created_idx
  on public.bawaal_posts (feed, created_at desc);

-- Realtime (idempotent)
do $$
begin
  begin
    alter publication supabase_realtime add table public.bawaal_posts;
  exception when duplicate_object then null;
  end;
end $$;

-- RLS — open for demo / Expo Go (tighten when auth ships)
alter table public.bawaal_posts enable row level security;

drop policy if exists "bawaal_posts_select_all" on public.bawaal_posts;
create policy "bawaal_posts_select_all"
  on public.bawaal_posts for select using (true);

drop policy if exists "bawaal_posts_insert_all" on public.bawaal_posts;
create policy "bawaal_posts_insert_all"
  on public.bawaal_posts for insert with check (true);

drop policy if exists "bawaal_posts_update_all" on public.bawaal_posts;
create policy "bawaal_posts_update_all"
  on public.bawaal_posts for update using (true);
