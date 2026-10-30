-- =============================================================================
-- BAWAAL · Core schema blueprint (profiles / videos / open battles)
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- Category values MUST match locked BAWAAL_SPORTS (src/constants/sports.js).
-- =============================================================================

create extension if not exists "pgcrypto";

-- Locked taxonomy (excludes ALL — feed filters may still use ALL client-side)
-- ALL | CRICKET | FOOTBALL | GYM | KABADDI | COMBAT | THROTTLE |
-- WAVE & BLADE | COURT KINGS | SKY & SUMMIT | OTHERS

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  username text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Soft-compat with existing Passport profiles (text id / display_name / handle)
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists created_at timestamptz default now();

create index if not exists profiles_username_idx on public.profiles (username);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

-- ---------------------------------------------------------------------------
-- videos (Arena cinematic feed source)
-- ---------------------------------------------------------------------------
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  -- Soft ref to profiles.id (uuid or text depending on project age — no hard FK)
  user_id text,
  video_url text not null,
  category text not null default 'OTHERS'
    check (
      category in (
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
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists videos_created_at_idx on public.videos (created_at desc);
create index if not exists videos_user_id_idx on public.videos (user_id);
create index if not exists videos_category_idx on public.videos (category);

-- ---------------------------------------------------------------------------
-- battles (async OPEN CHALLENGES / tips callouts for BATTLES + Arena shelf)
-- NOTE: An older live 1v1 `battles` table may already exist in some projects
-- (host_id / live status). If CREATE is skipped, add missing columns below or
-- run against a fresh project. Prefer this shape for open callouts.
-- ---------------------------------------------------------------------------
create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  -- Soft refs to profiles.id (uuid or text — no hard FK for dual-schema projects)
  creator_id text,
  responder_id text,
  target_description text,
  category text not null default 'OTHERS'
    check (
      category in (
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

alter table public.battles add column if not exists creator_id text;
alter table public.battles add column if not exists responder_id text;
alter table public.battles add column if not exists target_description text;
alter table public.battles add column if not exists category text;
alter table public.battles add column if not exists creator_video_url text;
alter table public.battles add column if not exists responder_video_url text;
alter table public.battles add column if not exists created_at timestamptz default now();

create index if not exists battles_status_created_idx
  on public.battles (status, created_at desc);
create index if not exists battles_category_idx on public.battles (category);
create index if not exists battles_creator_id_idx on public.battles (creator_id);

-- ---------------------------------------------------------------------------
-- RLS (open read for Expo Go / demo — tighten with auth.uid() in production)
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
    execute format(
      'drop policy if exists %I on public.%I',
      t || '_select_anon',
      t
    );
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_select_anon',
      t
    );
    execute format(
      'drop policy if exists %I on public.%I',
      t || '_insert_anon',
      t
    );
    execute format(
      'create policy %I on public.%I for insert to anon, authenticated with check (true)',
      t || '_insert_anon',
      t
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
