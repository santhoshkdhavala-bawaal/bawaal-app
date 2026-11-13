-- BAWAAL · Ensure registration / Passport columns on public.profiles
-- Safe to re-run. Reloads PostgREST schema cache at the end.
--
-- Adds: real_name, age, location, city_country, gender, phone, role,
--        category, avatar_uri, avatar_url (+ soft-compat companions).

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  primary_sport text,
  created_at timestamptz not null default now()
);

-- Registration / Passport columns (idempotent)
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists real_name text;
alter table public.profiles add column if not exists age integer;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists location text;
alter table public.profiles add column if not exists city_country text;
alter table public.profiles add column if not exists category text;
alter table public.profiles add column if not exists role text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists primary_sport text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists avatar_uri text;
alter table public.profiles add column if not exists created_at timestamptz default now();

-- Soft-compat (Passport / Arena) — never written by registration sanitizer as junk
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists handle text;
alter table public.profiles add column if not exists sport text;
alter table public.profiles add column if not exists mobile text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists belt_tier text;
alter table public.profiles add column if not exists list_bucket text default 'suggested';
alter table public.profiles add column if not exists followers integer default 0;
alter table public.profiles add column if not exists following_count integer default 0;
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- Backfill city_country / location / avatar mirrors when empty
update public.profiles
set city_country = coalesce(
  nullif(city_country, ''),
  nullif(location, ''),
  nullif(concat_ws(', ', nullif(city, ''), nullif(country, '')), '')
)
where coalesce(city_country, '') = '';

update public.profiles
set location = coalesce(nullif(location, ''), nullif(city_country, ''), nullif(country, ''))
where coalesce(location, '') = '';

update public.profiles
set avatar_url = coalesce(nullif(avatar_url, ''), nullif(avatar_uri, ''))
where coalesce(avatar_url, '') = '' and coalesce(avatar_uri, '') <> '';

update public.profiles
set avatar_uri = coalesce(nullif(avatar_uri, ''), nullif(avatar_url, ''))
where coalesce(avatar_uri, '') = '' and coalesce(avatar_url, '') <> '';

update public.profiles
set real_name = coalesce(nullif(real_name, ''), nullif(full_name, ''), nullif(display_name, ''))
where coalesce(real_name, '') = '';

update public.profiles
set full_name = coalesce(nullif(full_name, ''), nullif(real_name, ''), nullif(display_name, ''))
where coalesce(full_name, '') = '';

create unique index if not exists profiles_username_unique_idx
  on public.profiles (username) where username is not null;
create unique index if not exists profiles_email_unique_idx
  on public.profiles (email) where email is not null;
create unique index if not exists profiles_phone_unique_idx
  on public.profiles (phone) where phone is not null;
create index if not exists profiles_category_idx on public.profiles (category);
create index if not exists profiles_city_country_idx on public.profiles (city_country);

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

-- Refresh PostgREST schema cache so new columns stop returning PGRST204
notify pgrst, 'reload schema';
