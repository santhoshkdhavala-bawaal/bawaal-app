-- BAWAAL · Reel social graph (⋮ menu) — likes, follows, reposts, tags, banter
-- Run in Supabase SQL Editor. Safe to re-run.
-- PRODUCTION LOCK: prefer ENSURE_BAWAAL_BACKEND_LOCKDOWN.sql for strict RLS
-- on reel_likes / reel_banter (public read · authenticated own-row write).

create extension if not exists "pgcrypto";

-- ── Likes (Banner Like) ─────────────────────────────────────────────
-- Binding: reel_id + user_id with unique pair (legacy soft-fallback for likes)
create table if not exists public.reel_likes (
  id text primary key,
  user_id text not null,
  reel_id text,
  created_at timestamptz not null default now()
);
create index if not exists reel_likes_reel_idx on public.reel_likes (reel_id);
create index if not exists reel_likes_user_idx on public.reel_likes (user_id);
create unique index if not exists reel_likes_user_reel_uidx
  on public.reel_likes (user_id, reel_id)
  where reel_id is not null;
alter table public.reel_likes enable row level security;
drop policy if exists reel_likes_all_demo on public.reel_likes;
drop policy if exists reel_likes_select_public on public.reel_likes;
drop policy if exists reel_likes_insert_auth on public.reel_likes;
drop policy if exists reel_likes_delete_own on public.reel_likes;
create policy reel_likes_select_public on public.reel_likes
  for select using (true);
create policy reel_likes_insert_auth on public.reel_likes
  for insert to authenticated
  with check (auth.uid() is not null and user_id = auth.uid()::text);
create policy reel_likes_delete_own on public.reel_likes
  for delete to authenticated
  using (user_id = auth.uid()::text);
grant select on public.reel_likes to anon, authenticated;
grant insert, delete on public.reel_likes to authenticated;

-- ── Follows ─────────────────────────────────────────────────────────
create table if not exists public.reel_follows (
  id text primary key,
  follower_id text not null,
  following_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists reel_follows_follower_idx on public.reel_follows (follower_id);
create index if not exists reel_follows_following_idx on public.reel_follows (following_id);
alter table public.reel_follows enable row level security;
drop policy if exists reel_follows_all_demo on public.reel_follows;
create policy reel_follows_all_demo on public.reel_follows
  for all using (true) with check (true);
grant select, insert, update, delete on public.reel_follows to anon, authenticated;

-- ── Reposts ─────────────────────────────────────────────────────────
create table if not exists public.reel_reposts (
  id text primary key,
  user_id text not null,
  reel_id text,
  created_at timestamptz not null default now()
);
create index if not exists reel_reposts_reel_idx on public.reel_reposts (reel_id);
alter table public.reel_reposts enable row level security;
drop policy if exists reel_reposts_all_demo on public.reel_reposts;
create policy reel_reposts_all_demo on public.reel_reposts
  for all using (true) with check (true);
grant select, insert, update, delete on public.reel_reposts to anon, authenticated;

-- ── Tags ────────────────────────────────────────────────────────────
create table if not exists public.reel_tags (
  id text primary key,
  user_id text not null,
  reel_id text,
  tagged_handle text,
  created_at timestamptz not null default now()
);
create index if not exists reel_tags_reel_idx on public.reel_tags (reel_id);
alter table public.reel_tags enable row level security;
drop policy if exists reel_tags_all_demo on public.reel_tags;
create policy reel_tags_all_demo on public.reel_tags
  for all using (true) with check (true);
grant select, insert, update, delete on public.reel_tags to anon, authenticated;

-- ── Banter threads ──────────────────────────────────────────────────
-- Binding: reel_id, user_id, username, body (= content). Primary path is public.comments.
-- Never seed unicode emoji defaults — body may be empty; clients use vault shortcodes.
create table if not exists public.reel_banter (
  id text primary key,
  user_id text not null,
  reel_id text,
  username text,
  body text not null default '',
  content text,
  created_at timestamptz not null default now()
);
alter table if exists public.reel_banter
  add column if not exists username text;
alter table if exists public.reel_banter
  add column if not exists content text;
alter table if exists public.reel_banter
  add column if not exists body text default '';
create index if not exists reel_banter_reel_idx on public.reel_banter (reel_id, created_at desc);
alter table public.reel_banter enable row level security;
drop policy if exists reel_banter_all_demo on public.reel_banter;
drop policy if exists reel_banter_select_public on public.reel_banter;
drop policy if exists reel_banter_insert_auth on public.reel_banter;
drop policy if exists reel_banter_update_own on public.reel_banter;
drop policy if exists reel_banter_delete_own on public.reel_banter;
create policy reel_banter_select_public on public.reel_banter
  for select using (true);
create policy reel_banter_insert_auth on public.reel_banter
  for insert to authenticated
  with check (auth.uid() is not null and user_id = auth.uid()::text);
create policy reel_banter_update_own on public.reel_banter
  for update to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);
create policy reel_banter_delete_own on public.reel_banter
  for delete to authenticated
  using (user_id = auth.uid()::text);
grant select on public.reel_banter to anon, authenticated;
grant insert, update, delete on public.reel_banter to authenticated;

-- DMs: see ENSURE_DIRECT_MESSAGES.sql
-- Videos / arena_challenges / profiles: see ENSURE_* companions

notify pgrst, 'reload schema';
