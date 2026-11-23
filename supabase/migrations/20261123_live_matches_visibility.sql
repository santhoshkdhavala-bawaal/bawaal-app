-- BAWAAL Live Match — public/private visibility + optional location label
-- Safe to re-run. Soft-fail clients keep values on the local Map before this lands.

alter table public.live_matches
  add column if not exists visibility text not null default 'public';

alter table public.live_matches
  add column if not exists location_label text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'live_matches_visibility_check'
  ) then
    alter table public.live_matches
      add constraint live_matches_visibility_check
      check (visibility in ('public', 'private'));
  end if;
end $$;

comment on column public.live_matches.visibility is
  'public = listed on LIVE AROUND THE WORLD; private = invite code / targeted invite only.';

comment on column public.live_matches.location_label is
  'Optional human-readable venue/city label shown on the global public roster.';
