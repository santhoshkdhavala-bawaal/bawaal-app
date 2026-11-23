-- BAWAAL Live Match — optional national flag derived from location_label
-- Safe to re-run. Soft-fail clients keep country_flag on the local Map before this lands.

alter table public.live_matches
  add column if not exists country_flag text;

comment on column public.live_matches.country_flag is
  'National flag emoji derived from location_label (null/empty when unmatched).';
