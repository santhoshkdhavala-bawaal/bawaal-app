-- Ensure profiles cascade when auth users are deleted via delete-account Edge Function.
-- Deploy function: supabase functions deploy delete-account

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
