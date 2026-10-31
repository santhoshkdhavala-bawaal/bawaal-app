-- BAWAAL · Registration profiles columns + sports_hubs map pins
-- Run in Supabase SQL Editor. Safe to re-run.

-- ── Profiles: registration sync columns ──────────────────────────────
create table if not exists public.profiles (
  id text primary key,
  display_name text,
  handle text,
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

alter table public.profiles add column if not exists real_name text;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists age integer;
alter table public.profiles add column if not exists mobile text;
alter table public.profiles add column if not exists location text;
alter table public.profiles add column if not exists role text;
alter table public.profiles add column if not exists sport_interests text[];
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists handle text;
alter table public.profiles add column if not exists sport text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists primary_sport text;
alter table public.profiles add column if not exists updated_at timestamptz default now();

create index if not exists profiles_mobile_idx on public.profiles (mobile);
create index if not exists profiles_list_bucket_idx on public.profiles (list_bucket);

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_all_demo'
  ) then
    create policy profiles_all_demo on public.profiles
      for all using (true) with check (true);
  end if;
end $$;

grant select, insert, update, delete on public.profiles to anon, authenticated;

-- ── Sports hubs (map pins) ───────────────────────────────────────────
create table if not exists public.sports_hubs (
  id text primary key,
  name text not null,
  category text not null,
  latitude double precision not null,
  longitude double precision not null,
  address text,
  member_count integer not null default 0,
  squad_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.sports_hubs add column if not exists name text;
alter table public.sports_hubs add column if not exists category text;
alter table public.sports_hubs add column if not exists latitude double precision;
alter table public.sports_hubs add column if not exists longitude double precision;
alter table public.sports_hubs add column if not exists address text;
alter table public.sports_hubs add column if not exists member_count integer;
alter table public.sports_hubs add column if not exists squad_count integer;

create index if not exists sports_hubs_category_idx on public.sports_hubs (category);

alter table public.sports_hubs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'sports_hubs' and policyname = 'sports_hubs_all_demo'
  ) then
    create policy sports_hubs_all_demo on public.sports_hubs
      for all using (true) with check (true);
  end if;
end $$;

grant select, insert, update, delete on public.sports_hubs to anon, authenticated;

-- Seed Virar / Nalasopara facilities (idempotent)
insert into public.sports_hubs (id, name, category, latitude, longitude, address, member_count, squad_count)
values
  ('virar-golds-gym', 'Gold''s Gym Virar', 'GYM', 19.4568, 72.8082, 'Near Virar West Station, Palghar', 0, 0),
  ('virar-talwalkars', 'Talwalkars Fitness Virar', 'GYM', 19.4582, 72.8125, 'Evershine City Road, Virar West', 0, 0),
  ('virar-fitzone', 'FitZone Local Hub', 'GYM', 19.4521, 72.8058, 'Agashi Road, Virar West', 0, 0),
  ('nalasopara-powerhouse', 'PowerHouse Gym Nalasopara', 'GYM', 19.4195, 72.8142, 'Nalasopara West Market Road', 0, 0),
  ('virar-global-city-turf', 'Global City Turf', 'FOOTBALL', 19.4612, 72.8015, 'Global City Complex, Virar West', 0, 0),
  ('virar-viva-ground', 'Viva Ground', 'FOOTBALL', 19.4486, 72.8168, 'Viva College Rd, Virar West', 0, 0),
  ('nalasopara-astro-turf', 'Nalasopara Astro Turf', 'FOOTBALL', 19.4238, 72.8211, 'Achole Road, Nalasopara East', 0, 0),
  ('virar-cricket-ground', 'Virar Cricket Ground', 'CRICKET', 19.4545, 72.8189, 'Bolinj Cricket Ground, Virar West', 0, 0),
  ('virar-nets-arena', 'Virar Nets Arena', 'CRICKET', 19.4498, 72.8095, 'Chandansar Rd, Virar East', 0, 0),
  ('nalasopara-turf-cricket', 'Nalasopara Cricket Turf', 'CRICKET', 19.4272, 72.8088, 'Tulinj Road, Nalasopara East', 0, 0),
  ('virar-mma-lab', 'Virar MMA Lab', 'COMBAT', 19.4575, 72.8044, 'Phoolpada Road, Virar West', 0, 0),
  ('virar-iron-fist', 'Iron Fist Boxing Ring', 'COMBAT', 19.4512, 72.8136, 'Manvelpada, Virar East', 0, 0),
  ('nalasopara-strike-academy', 'Strike Academy MMA', 'COMBAT', 19.4218, 72.8175, 'Nalasopara West Main Road', 0, 0),
  ('virar-kabaddi-akhada', 'Virar Kabaddi Akhada', 'KABADDI', 19.4604, 72.8152, 'Bolinj Village Ground, Virar', 0, 0),
  ('virar-open-courts', 'Virar Open Courts', 'COURT KINGS', 19.4469, 72.8071, 'Yashwant Viva Township Courts', 0, 0)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  address = excluded.address;

notify pgrst, 'reload schema';
