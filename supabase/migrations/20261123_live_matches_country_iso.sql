-- BAWAAL Live Match — optional ISO country code for flagcdn image badges
-- Safe to re-run. Soft-fail clients keep country_iso on the local Map before this lands.

alter table public.live_matches
  add column if not exists country_iso text;

comment on column public.live_matches.country_iso is
  'ISO 3166-1 alpha-2 country code derived from location_label (for flagcdn images).';
