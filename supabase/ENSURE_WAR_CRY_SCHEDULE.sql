-- War Cry schedule columns on public.battles
-- start_time: UTC timestamptz for the live showdown
-- registration_open: false once within 5h of start (or when live)

alter table if exists public.battles
  add column if not exists start_time timestamptz;

alter table if exists public.battles
  add column if not exists registration_open boolean default true;

comment on column public.battles.start_time is 'War Cry scheduled start (UTC)';
comment on column public.battles.registration_open is 'False when within 5h of start_time or battle is live';

-- Soft backfill: scheduled rows without start_time keep registration_open true
update public.battles
set registration_open = coalesce(registration_open, true)
where registration_open is null;
