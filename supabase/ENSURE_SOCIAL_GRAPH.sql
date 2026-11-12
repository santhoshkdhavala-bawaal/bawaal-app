-- BAWAAL · Social graph + belt tiers for Arena feed
-- Run in Supabase SQL Editor after ENSURE_PROFILES_SPORTS_HUBS.sql / supabase_schema.sql.
-- Safe to re-run. Soft-compat with existing reel_* tables.

create extension if not exists "pgcrypto";

-- ── Profiles: avatar + belt / ranking tier ───────────────────────────
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists avatar_uri text;
alter table public.profiles add column if not exists belt_tier text
  check (
    belt_tier is null
    or belt_tier in ('White', 'Yellow', 'Blue', 'Purple', 'Gold')
  );

create index if not exists profiles_belt_tier_idx on public.profiles (belt_tier);

-- Default new athletes to White belt when unset
update public.profiles
set belt_tier = 'White'
where belt_tier is null;

-- ── Videos soft-compat columns (already in supabase_schema.sql) ──────
alter table public.videos add column if not exists user_id uuid;
alter table public.videos add column if not exists video_url text;
alter table public.videos add column if not exists thumbnail_url text;
alter table public.videos add column if not exists caption text;
alter table public.videos add column if not exists created_at timestamptz default now();
alter table public.videos add column if not exists like_count integer default 0;
alter table public.videos add column if not exists comment_count integer default 0;

-- ── likes (video interactions) ───────────────────────────────────────
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  video_id text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists likes_user_video_uidx
  on public.likes (user_id, video_id);
create index if not exists likes_video_idx on public.likes (video_id);
alter table public.likes enable row level security;
drop policy if exists likes_all_demo on public.likes;
create policy likes_all_demo on public.likes
  for all using (true) with check (true);
grant select, insert, update, delete on public.likes to anon, authenticated;

-- ── comments (banter / comment stream) ───────────────────────────────
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  video_id text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists comments_video_created_idx
  on public.comments (video_id, created_at desc);
alter table public.comments enable row level security;
drop policy if exists comments_all_demo on public.comments;
create policy comments_all_demo on public.comments
  for all using (true) with check (true);
grant select, insert, update, delete on public.comments to anon, authenticated;

-- ── follows (athlete graph) ──────────────────────────────────────────
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id text not null,
  following_id text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists follows_pair_uidx
  on public.follows (follower_id, following_id);
create index if not exists follows_following_idx on public.follows (following_id);
alter table public.follows enable row level security;
drop policy if exists follows_all_demo on public.follows;
create policy follows_all_demo on public.follows
  for all using (true) with check (true);
grant select, insert, update, delete on public.follows to anon, authenticated;

-- Keep legacy reel_* tables in sync for older clients (see ENSURE_REEL_SOCIAL.sql)

notify pgrst, 'reload schema';
