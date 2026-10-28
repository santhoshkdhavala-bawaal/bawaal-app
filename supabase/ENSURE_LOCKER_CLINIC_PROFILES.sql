-- BAWAAL · Locker Room / Clinic / Passport tables
-- Run in Supabase SQL Editor (or supabase db push).
-- Re-run safely to align columns + clear PostgREST schema cache.

-- ── Squads (training hubs / gym circles) ─────────────────────────────
create table if not exists public.squads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'TRAINING SQUAD',
  privacy text not null default 'Invite only',
  member_count integer not null default 1,
  last_message text,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.squads add column if not exists kind text;
alter table public.squads add column if not exists created_by text;
alter table public.squads alter column kind set default 'TRAINING SQUAD';

create index if not exists squads_created_at_idx
  on public.squads (created_at desc);

-- ── Sparring logs ────────────────────────────────────────────────────
create table if not exists public.sparring_logs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  sessions_logged integer not null default 1,
  last_note text,
  created_by text,
  athlete_handle text,
  created_at timestamptz not null default now()
);

alter table public.sparring_logs add column if not exists created_by text;
alter table public.sparring_logs add column if not exists athlete_handle text;

create index if not exists sparring_logs_created_at_idx
  on public.sparring_logs (created_at desc);

-- ── Clinic Q&A (question_text is the live column name) ───────────────
create table if not exists public.clinic_questions (
  id uuid primary key default gen_random_uuid(),
  athlete_handle text not null,
  sport text not null default 'GYM',
  question_text text not null,
  created_at timestamptz not null default now()
);

alter table public.clinic_questions add column if not exists athlete_handle text;
alter table public.clinic_questions add column if not exists question_text text;
alter table public.clinic_questions add column if not exists sport text;

-- Backfill from legacy `question` column when present
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clinic_questions'
      and column_name = 'question'
  ) then
    execute $q$
      update public.clinic_questions
      set question_text = coalesce(question_text, question)
      where question_text is null and question is not null
    $q$;
  end if;
end $$;

create index if not exists clinic_questions_created_at_idx
  on public.clinic_questions (created_at desc);

create table if not exists public.clinic_replies (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.clinic_questions (id) on delete cascade,
  expert_name text not null,
  expert_role text not null default 'VERIFIED EXPERT',
  response text not null,
  has_video boolean not null default false,
  video_label text,
  created_at timestamptz not null default now()
);

create index if not exists clinic_replies_question_id_idx
  on public.clinic_replies (question_id);

-- ── Profiles (Passport / suggested / following) ──────────────────────
create table if not exists public.profiles (
  id text primary key,
  display_name text not null,
  handle text not null,
  bio text,
  role text default 'athlete',
  sport text,
  avatar_uri text,
  city text,
  status_badge text,
  verified boolean not null default false,
  online boolean not null default false,
  followers integer not null default 0,
  following_count integer not null default 0,
  win_rate integer not null default 0,
  battles_won integer not null default 0,
  bawaal_pts integer not null default 0,
  rank integer,
  list_bucket text not null default 'suggested',
  created_at timestamptz not null default now()
);

create index if not exists profiles_list_bucket_idx
  on public.profiles (list_bucket);

-- ── RLS (open for Expo Go demo; tighten with auth later) ─────────────
alter table public.squads enable row level security;
alter table public.sparring_logs enable row level security;
alter table public.clinic_questions enable row level security;
alter table public.clinic_replies enable row level security;
alter table public.profiles enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'squads',
    'sparring_logs',
    'clinic_questions',
    'clinic_replies',
    'profiles'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_all', t);
    execute format(
      'create policy %I on public.%I for select using (true)',
      t || '_select_all',
      t
    );
    execute format('drop policy if exists %I on public.%I', t || '_insert_all', t);
    execute format(
      'create policy %I on public.%I for insert with check (true)',
      t || '_insert_all',
      t
    );
    execute format('drop policy if exists %I on public.%I', t || '_update_all', t);
    execute format(
      'create policy %I on public.%I for update using (true)',
      t || '_update_all',
      t
    );
  end loop;
end $$;

-- Force PostgREST to drop stale column cache (clears PGRST204 / schema cache errors)
notify pgrst, 'reload schema';
