-- =============================================================================
-- BAWAAL · PRODUCTION RLS + MODERATION LOCK
-- Project: petjdnyrjhgruvhzavmu
-- Idempotent. Paste once into Supabase Dashboard → SQL Editor → Run.
--
-- Covers:
--   · content_reports + user_blocks (App Store / Play UGC)
--   · Hardened likes / comments / follows (replace open "for all" demo policies)
--   · Storage write policies (authenticated-only inserts where possible)
--   · Expanded delete_account_cascade for Edge Function delete-account
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1) Moderation tables (Report Content / Block User)
-- ---------------------------------------------------------------------------

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id text not null,
  target_type text not null
    check (target_type in ('video', 'live', 'profile', 'comment', 'message', 'other')),
  target_id text not null,
  target_owner_id text,
  reason text not null default 'other',
  details text,
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists content_reports_reporter_idx
  on public.content_reports (reporter_id, created_at desc);
create index if not exists content_reports_target_idx
  on public.content_reports (target_type, target_id);

alter table public.content_reports enable row level security;

drop policy if exists content_reports_insert_auth on public.content_reports;
drop policy if exists content_reports_select_own on public.content_reports;

create policy content_reports_insert_auth
  on public.content_reports
  for insert
  to authenticated
  with check (
    reporter_id = auth.uid()::text
    or reporter_id = coalesce(auth.jwt() ->> 'sub', '')
  );

create policy content_reports_select_own
  on public.content_reports
  for select
  to authenticated
  using (
    reporter_id = auth.uid()::text
    or reporter_id = coalesce(auth.jwt() ->> 'sub', '')
  );

grant select, insert on public.content_reports to authenticated;

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id text not null,
  blocked_id text not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

create index if not exists user_blocks_blocker_idx
  on public.user_blocks (blocker_id, created_at desc);

alter table public.user_blocks enable row level security;

drop policy if exists user_blocks_insert_auth on public.user_blocks;
drop policy if exists user_blocks_select_own on public.user_blocks;
drop policy if exists user_blocks_delete_own on public.user_blocks;

create policy user_blocks_insert_auth
  on public.user_blocks
  for insert
  to authenticated
  with check (
    blocker_id = auth.uid()::text
    or blocker_id = coalesce(auth.jwt() ->> 'sub', '')
  );

create policy user_blocks_select_own
  on public.user_blocks
  for select
  to authenticated
  using (
    blocker_id = auth.uid()::text
    or blocker_id = coalesce(auth.jwt() ->> 'sub', '')
  );

create policy user_blocks_delete_own
  on public.user_blocks
  for delete
  to authenticated
  using (
    blocker_id = auth.uid()::text
    or blocker_id = coalesce(auth.jwt() ->> 'sub', '')
  );

grant select, insert, delete on public.user_blocks to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Harden social graph demo policies (likes / comments / follows)
-- ---------------------------------------------------------------------------

do $$ begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'likes'
  ) then
    alter table public.likes enable row level security;
    drop policy if exists likes_all_demo on public.likes;
    drop policy if exists likes_select_public on public.likes;
    drop policy if exists likes_insert_auth on public.likes;
    drop policy if exists likes_delete_own on public.likes;
    execute $p$
      create policy likes_select_public on public.likes
        for select to anon, authenticated using (true)
    $p$;
    execute $p$
      create policy likes_insert_auth on public.likes
        for insert to authenticated
        with check (
          user_id = auth.uid()::text
          or user_id = coalesce(auth.jwt() ->> 'sub', '')
        )
    $p$;
    execute $p$
      create policy likes_delete_own on public.likes
        for delete to authenticated
        using (
          user_id = auth.uid()::text
          or user_id = coalesce(auth.jwt() ->> 'sub', '')
        )
    $p$;
  end if;
end $$;

do $$ begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'comments'
  ) then
    alter table public.comments enable row level security;
    drop policy if exists comments_all_demo on public.comments;
    drop policy if exists comments_select_public on public.comments;
    drop policy if exists comments_insert_auth on public.comments;
    drop policy if exists comments_delete_own on public.comments;
    execute $p$
      create policy comments_select_public on public.comments
        for select to anon, authenticated using (true)
    $p$;
    execute $p$
      create policy comments_insert_auth on public.comments
        for insert to authenticated
        with check (
          user_id = auth.uid()::text
          or user_id = coalesce(auth.jwt() ->> 'sub', '')
        )
    $p$;
    execute $p$
      create policy comments_delete_own on public.comments
        for delete to authenticated
        using (
          user_id = auth.uid()::text
          or user_id = coalesce(auth.jwt() ->> 'sub', '')
        )
    $p$;
  end if;
end $$;

do $$ begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'follows'
  ) then
    alter table public.follows enable row level security;
    drop policy if exists follows_all_demo on public.follows;
    drop policy if exists follows_select_public on public.follows;
    drop policy if exists follows_insert_auth on public.follows;
    drop policy if exists follows_delete_own on public.follows;
    execute $p$
      create policy follows_select_public on public.follows
        for select to anon, authenticated using (true)
    $p$;
    execute $p$
      create policy follows_insert_auth on public.follows
        for insert to authenticated
        with check (
          follower_id = auth.uid()::text
          or follower_id = coalesce(auth.jwt() ->> 'sub', '')
        )
    $p$;
    execute $p$
      create policy follows_delete_own on public.follows
        for delete to authenticated
        using (
          follower_id = auth.uid()::text
          or follower_id = coalesce(auth.jwt() ->> 'sub', '')
        )
    $p$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Profiles / videos — ensure RLS on
-- ---------------------------------------------------------------------------

do $$ begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    alter table public.profiles enable row level security;
  end if;
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'videos'
  ) then
    alter table public.videos enable row level security;
  end if;
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'live_matches'
  ) then
    alter table public.live_matches enable row level security;
  end if;
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'live_match_invites'
  ) then
    alter table public.live_match_invites enable row level security;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Storage — public read; authenticated write preferred
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('bawaal-videos', 'bawaal-videos', true),
  ('bawaalvideos', 'bawaalvideos', true),
  ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read bawaal-videos" on storage.objects;
create policy "Public read bawaal-videos"
  on storage.objects for select
  using (bucket_id in ('bawaal-videos', 'bawaalvideos', 'avatars'));

-- Prefer authenticated uploads; keep anon insert only for legacy soft clients
drop policy if exists "Anon upload bawaal-videos" on storage.objects;
drop policy if exists "Authenticated upload bawaal media" on storage.objects;
create policy "Authenticated upload bawaal media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id in ('bawaal-videos', 'bawaalvideos', 'avatars'));

drop policy if exists "Anon update bawaal-videos" on storage.objects;
drop policy if exists "Authenticated update bawaal media" on storage.objects;
create policy "Authenticated update bawaal media"
  on storage.objects for update
  to authenticated
  using (bucket_id in ('bawaal-videos', 'bawaalvideos', 'avatars'))
  with check (bucket_id in ('bawaal-videos', 'bawaalvideos', 'avatars'));

drop policy if exists "Anon delete own bawaal media" on storage.objects;
drop policy if exists "Authenticated delete bawaal media" on storage.objects;
create policy "Authenticated delete bawaal media"
  on storage.objects for delete
  to authenticated
  using (bucket_id in ('bawaal-videos', 'bawaalvideos', 'avatars'));

-- ---------------------------------------------------------------------------
-- 5) delete_account_cascade — service_role cleanup before auth.admin.deleteUser
-- ---------------------------------------------------------------------------

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

notify pgrst, 'reload schema';

-- Health
select 'content_reports' as table_name, count(*)::int as rows from public.content_reports
union all
select 'user_blocks', count(*)::int from public.user_blocks;
