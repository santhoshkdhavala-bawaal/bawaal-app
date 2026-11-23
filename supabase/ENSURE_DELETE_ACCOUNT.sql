-- BAWAAL · Account deletion support (App Store / Play)
-- Profiles already cascade when auth.users is deleted:
--   id uuid primary key references auth.users (id) on delete cascade
-- Primary deletion path: Edge Function `delete-account`
--   supabase functions deploy delete-account
--
-- Optional: confirm FK cascade is present (safe re-run).

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_id_fkey'
  ) then
    begin
      alter table public.profiles
        add constraint profiles_id_fkey
        foreign key (id) references auth.users (id) on delete cascade;
    exception
      when duplicate_object then null;
      when others then
        raise notice 'profiles FK ensure skipped: %', SQLERRM;
    end;
  end if;
end $$;

comment on table public.profiles is
  'Athlete profiles; deleted with auth.users via ON DELETE CASCADE (delete-account Edge Function).';
