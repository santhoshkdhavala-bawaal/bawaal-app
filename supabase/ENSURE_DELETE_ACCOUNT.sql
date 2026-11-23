-- BAWAAL · Account deletion support (App Store / Play)
-- Profiles already cascade when auth.users is deleted:
--   id uuid primary key references auth.users (id) on delete cascade
-- Primary deletion path: Edge Function `delete-account`
--   supabase functions deploy delete-account --project-ref petjdnyrjhgruvhzavmu
--
-- Idempotent. Safe to paste into Supabase SQL Editor.
-- Prefer full lockdown: supabase/LOCK_PRODUCTION_RLS.sql

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

-- Best-effort app data cleanup before auth.admin.deleteUser (service_role only).
create or replace function public.delete_account_cascade(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := p_user_id::text;
begin
  if p_user_id is null then
    return;
  end if;

  begin
    update public.live_matches
      set status = 'ended', ended_at = coalesce(ended_at, now())
    where host_id = uid and status = 'live';
  exception when undefined_table then null; when others then null;
  end;

  begin
    delete from public.live_match_invites
    where host_id = uid or recipient_id = uid;
  exception when undefined_table then null; when others then null;
  end;

  begin
    delete from public.content_reports where reporter_id = uid;
  exception when undefined_table then null; when others then null;
  end;

  begin
    delete from public.user_blocks
    where blocker_id = uid or blocked_id = uid;
  exception when undefined_table then null; when others then null;
  end;

  begin
    delete from public.likes where user_id = uid;
  exception when undefined_table then null; when others then null;
  end;

  begin
    delete from public.comments where user_id = uid;
  exception when undefined_table then null; when others then null;
  end;

  begin
    delete from public.follows
    where follower_id = uid or following_id = uid;
  exception when undefined_table then null; when others then null;
  end;

  begin
    delete from public.direct_messages
    where sender_id = uid or receiver_id = uid;
  exception when undefined_table then null; when others then null;
  end;

  begin
    delete from public.profiles where id = p_user_id;
  exception when undefined_table then null; when others then null;
  end;
end;
$$;

revoke all on function public.delete_account_cascade(uuid) from public;
revoke all on function public.delete_account_cascade(uuid) from anon, authenticated;
grant execute on function public.delete_account_cascade(uuid) to service_role;

comment on function public.delete_account_cascade(uuid) is
  'Service-role cleanup before auth.admin.deleteUser (delete-account Edge Function).';

comment on table public.profiles is
  'Athlete profiles; deleted with auth.users via ON DELETE CASCADE (delete-account Edge Function).';
