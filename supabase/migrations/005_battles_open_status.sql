-- Allow OPEN challenges published from the + BATTLE FAB / Arena feed.
-- Idempotent: drops and recreates the status check so older DBs pick up 'open'.

alter table public.battles drop constraint if exists battles_status_check;

alter table public.battles
  add constraint battles_status_check
  check (status in ('open', 'scheduled', 'live', 'completed'));

-- Optional opener clip for open challenges (nullable; local URI or public https).
alter table public.battles
  add column if not exists opener_video_url text;

comment on column public.battles.opener_video_url is
  'Optional host opener clip for OPEN Arena challenges';
