-- BAWAAL · Locker Room / Clinic / Passport tables
-- Run in Supabase SQL Editor (or supabase db push).

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

create index if not exists squads_created_at_idx
  on public.squads (created_at desc);

-- ── Sparring logs ────────────────────────────────────────────────────
create table if not exists public.sparring_logs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  sessions_logged integer not null default 1,
  last_note text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists sparring_logs_created_at_idx
  on public.sparring_logs (created_at desc);

-- ── Clinic Q&A ───────────────────────────────────────────────────────
create table if not exists public.clinic_questions (
  id uuid primary key default gen_random_uuid(),
  athlete_handle text not null,
  sport text not null default 'GYM',
  question text not null,
  created_at timestamptz not null default now()
);

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
  -- self | following | suggested
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

notify pgrst, 'reload schema';

-- Optional seed (idempotent-ish): uncomment to populate Passport demo rows.
-- insert into public.profiles (id, display_name, handle, bio, sport, list_bucket, followers, following_count, win_rate, battles_won, bawaal_pts, rank, verified, online, status_badge)
-- values
--   ('me', 'Rohit Kumar', '@rohit_vk7', 'Combat Sports Athlete', 'COMBAT', 'self', 1240, 86, 78, 18, 3850, 1, true, true, 'SCOUT VERIFIED'),
--   ('f1', 'Mia Torque', '@Mia_Torque', 'Floor PR hunter', 'GYM', 'following', 890, 40, 81, 22, 4120, 2, true, true, 'PRO'),
--   ('s1', 'Yuki Lift', '@Yuki_Lift', 'Olympic lift focus', 'GYM', 'suggested', 420, 33, 74, 9, 2100, 8, false, false, 'RISING')
-- on conflict (id) do nothing;
