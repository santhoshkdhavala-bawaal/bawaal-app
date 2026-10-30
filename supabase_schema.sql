-- =============================================================================
-- BAWAAL · Complete backend schema (profiles / videos / battles + storage)
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS / ON CONFLICT).
-- Category values MUST match locked BAWAAL_SPORTS (src/constants/sports.js).
--
-- NOTE: If an older `profiles` (text id) or live 1v1 `battles` table already
-- exists, CREATE IF NOT EXISTS is a no-op — use ALTER ADD COLUMN below and/or
-- migrate on a staging project. Fresh projects get the full auth-linked shape.
-- =============================================================================

create extension if not exists "pgcrypto";

-- Locked BAWAAL_SPORTS taxonomy (publish rows should not use ALL — filter only)
-- ALL | CRICKET | FOOTBALL | GYM | KABADDI | COMBAT | THROTTLE |
-- WAVE & BLADE | COURT KINGS | SKY & SUMMIT | OTHERS

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  primary_sport text
    check (
      primary_sport is null
      or primary_sport in (
        'ALL',
        'CRICKET',
        'FOOTBALL',
        'GYM',
        'KABADDI',
        'COMBAT',
        'THROTTLE',
        'WAVE & BLADE',
        'COURT KINGS',
        'SKY & SUMMIT',
        'OTHERS'
      )
    ),
  created_at timestamptz not null default now()
);

-- Soft-compat columns when a legacy profiles table already existed
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists primary_sport text;
alter table public.profiles add column if not exists created_at timestamptz default now();

create unique index if not exists profiles_username_unique_idx
  on public.profiles (username)
  where username is not null;
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);
create index if not exists profiles_primary_sport_idx on public.profiles (primary_sport);

-- Auto-create profile row when a user signs up (auth.users insert)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    nullif(new.raw_user_meta_data->>'username', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- videos (Arena cinematic feed)
-- ---------------------------------------------------------------------------
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  video_url text not null,
  thumbnail_url text,
  caption text,
  category text not null default 'OTHERS'
    check (
      category in (
        'ALL',
        'CRICKET',
        'FOOTBALL',
        'GYM',
        'KABADDI',
        'COMBAT',
        'THROTTLE',
        'WAVE & BLADE',
        'COURT KINGS',
        'SKY & SUMMIT',
        'OTHERS'
      )
    ),
  created_at timestamptz not null default now()
);

alter table public.videos add column if not exists user_id uuid;
alter table public.videos add column if not exists video_url text;
alter table public.videos add column if not exists thumbnail_url text;
alter table public.videos add column if not exists caption text;
alter table public.videos add column if not exists category text;
alter table public.videos add column if not exists created_at timestamptz default now();

create index if not exists videos_created_at_idx on public.videos (created_at desc);
create index if not exists videos_user_id_idx on public.videos (user_id);
create index if not exists videos_category_idx on public.videos (category);

-- ---------------------------------------------------------------------------
-- battles (async OPEN CHALLENGES for BATTLES tab + Arena community shelf)
-- ---------------------------------------------------------------------------
create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles (id) on delete set null,
  responder_id uuid references public.profiles (id) on delete set null,
  target_description text,
  category text not null default 'OTHERS'
    check (
      category in (
        'ALL',
        'CRICKET',
        'FOOTBALL',
        'GYM',
        'KABADDI',
        'COMBAT',
        'THROTTLE',
        'WAVE & BLADE',
        'COURT KINGS',
        'SKY & SUMMIT',
        'OTHERS'
      )
    ),
  status text not null default 'open'
    check (status in ('open', 'active', 'completed')),
  creator_video_url text,
  responder_video_url text,
  created_at timestamptz not null default now()
);

alter table public.battles add column if not exists creator_id uuid;
alter table public.battles add column if not exists responder_id uuid;
alter table public.battles add column if not exists target_description text;
alter table public.battles add column if not exists category text;
alter table public.battles add column if not exists status text;
alter table public.battles add column if not exists creator_video_url text;
alter table public.battles add column if not exists responder_video_url text;
alter table public.battles add column if not exists created_at timestamptz default now();

create index if not exists battles_status_created_idx
  on public.battles (status, created_at desc);
create index if not exists battles_category_idx on public.battles (category);
create index if not exists battles_creator_id_idx on public.battles (creator_id);

-- ---------------------------------------------------------------------------
-- RLS (public read for Expo Go / demo — tighten writes with auth.uid() later)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.battles enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'videos', 'battles']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_anon', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_select_anon',
      t
    );
    execute format('drop policy if exists %I on public.%I', t || '_insert_anon', t);
    execute format(
      'create policy %I on public.%I for insert to anon, authenticated with check (true)',
      t || '_insert_anon',
      t
    );
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (true) with check (true)',
      t || '_update_own',
      t
    );
  end loop;
end $$;

-- Prefer owner-scoped profile updates when auth is live
drop policy if exists profiles_update_own_strict on public.profiles;
create policy profiles_update_own_strict on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Storage buckets: `bawaal-videos` + `avatars` (public read)
-- Dashboard alternative: Storage → New bucket → public = true
--
-- Legacy note: existing Expo uploads still target `bawaalvideos` via
-- uploadService.BAWAAL_VIDEO_BUCKET. Keep that bucket if already provisioned;
-- new architecture prefers `bawaal-videos`.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'bawaal-videos',
    'bawaal-videos',
    true,
    104857600, -- 100 MB
    array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'avatars',
    'avatars',
    true,
    5242880, -- 5 MB
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Optional: keep legacy bucket public if present
insert into storage.buckets (id, name, public)
values ('bawaalvideos', 'bawaalvideos', true)
on conflict (id) do update set public = true;

-- Storage object policies (public read; authenticated / anon insert for demo)
drop policy if exists "Public read bawaal-videos" on storage.objects;
create policy "Public read bawaal-videos"
  on storage.objects for select
  using (bucket_id in ('bawaal-videos', 'bawaalvideos', 'avatars'));

drop policy if exists "Anon upload bawaal-videos" on storage.objects;
create policy "Anon upload bawaal-videos"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id in ('bawaal-videos', 'bawaalvideos', 'avatars'));

drop policy if exists "Anon update bawaal-videos" on storage.objects;
create policy "Anon update bawaal-videos"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id in ('bawaal-videos', 'bawaalvideos', 'avatars'));

drop policy if exists "Anon delete own bawaal media" on storage.objects;
create policy "Anon delete own bawaal media"
  on storage.objects for delete
  to authenticated
  using (bucket_id in ('bawaal-videos', 'bawaalvideos', 'avatars'));

notify pgrst, 'reload schema';
