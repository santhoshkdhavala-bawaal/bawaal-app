-- BAWAAL · Production backend lock-down (schema · RLS · realtime · grants)
-- Paste into Supabase → SQL Editor. Safe to re-run.
-- Covers: war_cry_matches, sparks_josh_clips, battle_bawaal_reels,
--         face_off_challenges, reel_likes, reel_banter
-- (+ companion likes / comments realtime for live banter streams)
--
-- Contract:
--   · Public SELECT for Arena viewers
--   · Authenticated INSERT / UPDATE / DELETE (creator-scoped where possible)
--   · Client soft-fails when tables missing / RLS rejects (local mock seeds)

create extension if not exists "pgcrypto";

-- ─── Shared updated_at trigger ──────────────────────────────────────────────
create or replace function public.bawaal_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. war_cry_matches
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.war_cry_matches (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'LIVE',
  sport text not null default 'COMBAT',
  host_handle text not null default '@host',
  rival_handle text not null default '@rival',
  host_score integer not null default 0,
  rival_score integer not null default 0,
  spectator_count integer not null default 0,
  room_id text,
  title text default 'WAR CRY · LIVE',
  thumbnail_url text,
  host_user_id uuid,
  rival_user_id uuid,
  creator_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.war_cry_matches add column if not exists status text default 'LIVE';
alter table public.war_cry_matches add column if not exists sport text default 'COMBAT';
alter table public.war_cry_matches add column if not exists host_handle text default '@host';
alter table public.war_cry_matches add column if not exists rival_handle text default '@rival';
alter table public.war_cry_matches add column if not exists host_score integer default 0;
alter table public.war_cry_matches add column if not exists rival_score integer default 0;
alter table public.war_cry_matches add column if not exists spectator_count integer default 0;
alter table public.war_cry_matches add column if not exists room_id text;
alter table public.war_cry_matches add column if not exists title text default 'WAR CRY · LIVE';
alter table public.war_cry_matches add column if not exists thumbnail_url text;
alter table public.war_cry_matches add column if not exists host_user_id uuid;
alter table public.war_cry_matches add column if not exists rival_user_id uuid;
alter table public.war_cry_matches add column if not exists creator_id uuid;
alter table public.war_cry_matches add column if not exists created_at timestamptz default now();
alter table public.war_cry_matches add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table public.war_cry_matches
      add constraint war_cry_matches_creator_fk
      foreign key (creator_id) references auth.users (id) on delete set null;
  exception when duplicate_object then null;
  end;
  begin
    alter table public.war_cry_matches
      add constraint war_cry_matches_host_user_fk
      foreign key (host_user_id) references auth.users (id) on delete set null;
  exception when duplicate_object then null;
  end;
  begin
    alter table public.war_cry_matches
      add constraint war_cry_matches_rival_user_fk
      foreign key (rival_user_id) references auth.users (id) on delete set null;
  exception when duplicate_object then null;
  end;
end $$;

create index if not exists war_cry_matches_status_idx
  on public.war_cry_matches (status, updated_at desc);
create index if not exists war_cry_matches_room_idx
  on public.war_cry_matches (room_id);
create index if not exists war_cry_matches_creator_idx
  on public.war_cry_matches (creator_id);

drop trigger if exists war_cry_matches_set_updated_at on public.war_cry_matches;
create trigger war_cry_matches_set_updated_at
  before update on public.war_cry_matches
  for each row execute function public.bawaal_set_updated_at();

alter table public.war_cry_matches enable row level security;

drop policy if exists "war_cry_matches_select_all" on public.war_cry_matches;
drop policy if exists "war_cry_matches_insert_all" on public.war_cry_matches;
drop policy if exists "war_cry_matches_update_all" on public.war_cry_matches;
drop policy if exists war_cry_matches_select_public on public.war_cry_matches;
drop policy if exists war_cry_matches_insert_auth on public.war_cry_matches;
drop policy if exists war_cry_matches_update_auth on public.war_cry_matches;
drop policy if exists war_cry_matches_delete_creator on public.war_cry_matches;

create policy war_cry_matches_select_public on public.war_cry_matches
  for select using (true);

create policy war_cry_matches_insert_auth on public.war_cry_matches
  for insert to authenticated
  with check (
    auth.uid() is not null
    and (creator_id is null or creator_id = auth.uid())
  );

create policy war_cry_matches_update_auth on public.war_cry_matches
  for update to authenticated
  using (
    auth.uid() is not null
    and (
      creator_id is null
      or creator_id = auth.uid()
      or host_user_id = auth.uid()
      or rival_user_id = auth.uid()
    )
  )
  with check (auth.uid() is not null);

create policy war_cry_matches_delete_creator on public.war_cry_matches
  for delete to authenticated
  using (creator_id = auth.uid() or host_user_id = auth.uid());

grant select on public.war_cry_matches to anon, authenticated;
grant insert, update, delete on public.war_cry_matches to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. sparks_josh_clips
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.sparks_josh_clips (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'SPARK',
  sport text not null default 'ARENA',
  mode text not null default 'SPARK',
  author text default '@athlete',
  video_url text,
  thumbnail_url text,
  user_id text,
  creator_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sparks_josh_clips add column if not exists title text default 'SPARK';
alter table public.sparks_josh_clips add column if not exists sport text default 'ARENA';
alter table public.sparks_josh_clips add column if not exists mode text default 'SPARK';
alter table public.sparks_josh_clips add column if not exists author text default '@athlete';
alter table public.sparks_josh_clips add column if not exists video_url text;
alter table public.sparks_josh_clips add column if not exists thumbnail_url text;
alter table public.sparks_josh_clips add column if not exists user_id text;
alter table public.sparks_josh_clips add column if not exists creator_id uuid;
alter table public.sparks_josh_clips add column if not exists created_at timestamptz default now();
alter table public.sparks_josh_clips add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table public.sparks_josh_clips
      add constraint sparks_josh_clips_creator_fk
      foreign key (creator_id) references auth.users (id) on delete set null;
  exception when duplicate_object then null;
  end;
end $$;

create index if not exists sparks_josh_clips_created_at_idx
  on public.sparks_josh_clips (created_at desc);
create index if not exists sparks_josh_clips_creator_idx
  on public.sparks_josh_clips (creator_id);
create index if not exists sparks_josh_clips_mode_idx
  on public.sparks_josh_clips (mode, created_at desc);

drop trigger if exists sparks_josh_clips_set_updated_at on public.sparks_josh_clips;
create trigger sparks_josh_clips_set_updated_at
  before update on public.sparks_josh_clips
  for each row execute function public.bawaal_set_updated_at();

alter table public.sparks_josh_clips enable row level security;

drop policy if exists "sparks_josh_clips_select_all" on public.sparks_josh_clips;
drop policy if exists "sparks_josh_clips_insert_all" on public.sparks_josh_clips;
drop policy if exists sparks_josh_clips_select_public on public.sparks_josh_clips;
drop policy if exists sparks_josh_clips_insert_auth on public.sparks_josh_clips;
drop policy if exists sparks_josh_clips_update_creator on public.sparks_josh_clips;
drop policy if exists sparks_josh_clips_delete_creator on public.sparks_josh_clips;

create policy sparks_josh_clips_select_public on public.sparks_josh_clips
  for select using (true);

create policy sparks_josh_clips_insert_auth on public.sparks_josh_clips
  for insert to authenticated
  with check (
    auth.uid() is not null
    and (creator_id is null or creator_id = auth.uid())
  );

create policy sparks_josh_clips_update_creator on public.sparks_josh_clips
  for update to authenticated
  using (
    creator_id = auth.uid()
    or user_id = auth.uid()::text
  )
  with check (auth.uid() is not null);

create policy sparks_josh_clips_delete_creator on public.sparks_josh_clips
  for delete to authenticated
  using (
    creator_id = auth.uid()
    or user_id = auth.uid()::text
  );

grant select on public.sparks_josh_clips to anon, authenticated;
grant insert, update, delete on public.sparks_josh_clips to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. battle_bawaal_reels
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.battle_bawaal_reels (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'BATTLE BAWAAL',
  sport text not null default 'COMBAT',
  author text default '@athlete',
  video_url text,
  thumbnail_url text,
  user_id text,
  creator_id uuid,
  participant_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.battle_bawaal_reels add column if not exists title text default 'BATTLE BAWAAL';
alter table public.battle_bawaal_reels add column if not exists sport text default 'COMBAT';
alter table public.battle_bawaal_reels add column if not exists author text default '@athlete';
alter table public.battle_bawaal_reels add column if not exists video_url text;
alter table public.battle_bawaal_reels add column if not exists thumbnail_url text;
alter table public.battle_bawaal_reels add column if not exists user_id text;
alter table public.battle_bawaal_reels add column if not exists creator_id uuid;
alter table public.battle_bawaal_reels add column if not exists participant_count integer default 0;
alter table public.battle_bawaal_reels add column if not exists created_at timestamptz default now();
alter table public.battle_bawaal_reels add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table public.battle_bawaal_reels
      add constraint battle_bawaal_reels_creator_fk
      foreign key (creator_id) references auth.users (id) on delete set null;
  exception when duplicate_object then null;
  end;
end $$;

create index if not exists battle_bawaal_reels_created_at_idx
  on public.battle_bawaal_reels (created_at desc);
create index if not exists battle_bawaal_reels_creator_idx
  on public.battle_bawaal_reels (creator_id);

drop trigger if exists battle_bawaal_reels_set_updated_at on public.battle_bawaal_reels;
create trigger battle_bawaal_reels_set_updated_at
  before update on public.battle_bawaal_reels
  for each row execute function public.bawaal_set_updated_at();

alter table public.battle_bawaal_reels enable row level security;

drop policy if exists "battle_bawaal_reels_select_all" on public.battle_bawaal_reels;
drop policy if exists "battle_bawaal_reels_insert_all" on public.battle_bawaal_reels;
drop policy if exists battle_bawaal_reels_select_public on public.battle_bawaal_reels;
drop policy if exists battle_bawaal_reels_insert_auth on public.battle_bawaal_reels;
drop policy if exists battle_bawaal_reels_update_creator on public.battle_bawaal_reels;
drop policy if exists battle_bawaal_reels_delete_creator on public.battle_bawaal_reels;

create policy battle_bawaal_reels_select_public on public.battle_bawaal_reels
  for select using (true);

create policy battle_bawaal_reels_insert_auth on public.battle_bawaal_reels
  for insert to authenticated
  with check (
    auth.uid() is not null
    and (creator_id is null or creator_id = auth.uid())
  );

create policy battle_bawaal_reels_update_creator on public.battle_bawaal_reels
  for update to authenticated
  using (
    creator_id = auth.uid()
    or user_id = auth.uid()::text
  )
  with check (auth.uid() is not null);

create policy battle_bawaal_reels_delete_creator on public.battle_bawaal_reels
  for delete to authenticated
  using (
    creator_id = auth.uid()
    or user_id = auth.uid()::text
  );

grant select on public.battle_bawaal_reels to anon, authenticated;
grant insert, update, delete on public.battle_bawaal_reels to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. face_off_challenges
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.face_off_challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'FACE OFF',
  sport text not null default 'ARENA',
  author text default '@athlete',
  status text not null default 'OPEN',
  video_url text,
  thumbnail_url text,
  user_id text,
  creator_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.face_off_challenges add column if not exists title text default 'FACE OFF';
alter table public.face_off_challenges add column if not exists sport text default 'ARENA';
alter table public.face_off_challenges add column if not exists author text default '@athlete';
alter table public.face_off_challenges add column if not exists status text default 'OPEN';
alter table public.face_off_challenges add column if not exists video_url text;
alter table public.face_off_challenges add column if not exists thumbnail_url text;
alter table public.face_off_challenges add column if not exists user_id text;
alter table public.face_off_challenges add column if not exists creator_id uuid;
alter table public.face_off_challenges add column if not exists created_at timestamptz default now();
alter table public.face_off_challenges add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table public.face_off_challenges
      add constraint face_off_challenges_creator_fk
      foreign key (creator_id) references auth.users (id) on delete set null;
  exception when duplicate_object then null;
  end;
end $$;

create index if not exists face_off_challenges_created_at_idx
  on public.face_off_challenges (created_at desc);
create index if not exists face_off_challenges_status_idx
  on public.face_off_challenges (status, created_at desc);
create index if not exists face_off_challenges_creator_idx
  on public.face_off_challenges (creator_id);

drop trigger if exists face_off_challenges_set_updated_at on public.face_off_challenges;
create trigger face_off_challenges_set_updated_at
  before update on public.face_off_challenges
  for each row execute function public.bawaal_set_updated_at();

alter table public.face_off_challenges enable row level security;

drop policy if exists "face_off_challenges_select_all" on public.face_off_challenges;
drop policy if exists "face_off_challenges_insert_all" on public.face_off_challenges;
drop policy if exists face_off_challenges_select_public on public.face_off_challenges;
drop policy if exists face_off_challenges_insert_auth on public.face_off_challenges;
drop policy if exists face_off_challenges_update_creator on public.face_off_challenges;
drop policy if exists face_off_challenges_delete_creator on public.face_off_challenges;

create policy face_off_challenges_select_public on public.face_off_challenges
  for select using (true);

create policy face_off_challenges_insert_auth on public.face_off_challenges
  for insert to authenticated
  with check (
    auth.uid() is not null
    and (creator_id is null or creator_id = auth.uid())
  );

create policy face_off_challenges_update_creator on public.face_off_challenges
  for update to authenticated
  using (
    creator_id = auth.uid()
    or user_id = auth.uid()::text
  )
  with check (auth.uid() is not null);

create policy face_off_challenges_delete_creator on public.face_off_challenges
  for delete to authenticated
  using (
    creator_id = auth.uid()
    or user_id = auth.uid()::text
  );

grant select on public.face_off_challenges to anon, authenticated;
grant insert, update, delete on public.face_off_challenges to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. reel_likes (legacy soft-compat + locked RLS)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.reel_likes (
  id text primary key,
  user_id text not null,
  reel_id text,
  created_at timestamptz not null default now()
);

alter table public.reel_likes add column if not exists user_id text;
alter table public.reel_likes add column if not exists reel_id text;
alter table public.reel_likes add column if not exists created_at timestamptz default now();

create index if not exists reel_likes_reel_idx on public.reel_likes (reel_id);
create index if not exists reel_likes_user_idx on public.reel_likes (user_id);
create unique index if not exists reel_likes_user_reel_uidx
  on public.reel_likes (user_id, reel_id)
  where reel_id is not null;

alter table public.reel_likes enable row level security;

drop policy if exists reel_likes_all_demo on public.reel_likes;
drop policy if exists reel_likes_select_public on public.reel_likes;
drop policy if exists reel_likes_insert_auth on public.reel_likes;
drop policy if exists reel_likes_delete_own on public.reel_likes;

create policy reel_likes_select_public on public.reel_likes
  for select using (true);

create policy reel_likes_insert_auth on public.reel_likes
  for insert to authenticated
  with check (
    auth.uid() is not null
    and user_id = auth.uid()::text
  );

create policy reel_likes_delete_own on public.reel_likes
  for delete to authenticated
  using (user_id = auth.uid()::text);

grant select on public.reel_likes to anon, authenticated;
grant insert, delete on public.reel_likes to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. reel_banter (legacy soft-compat + locked RLS)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.reel_banter (
  id text primary key,
  user_id text not null,
  reel_id text,
  username text,
  body text not null default '',
  content text,
  created_at timestamptz not null default now()
);

alter table public.reel_banter add column if not exists user_id text;
alter table public.reel_banter add column if not exists reel_id text;
alter table public.reel_banter add column if not exists username text;
alter table public.reel_banter add column if not exists body text default '';
alter table public.reel_banter add column if not exists content text;
alter table public.reel_banter add column if not exists created_at timestamptz default now();

-- Keep body / content in sync when one side is blank
create or replace function public.bawaal_reel_banter_sync_body()
returns trigger
language plpgsql
as $$
begin
  if (new.body is null or new.body = '') and new.content is not null then
    new.body := new.content;
  end if;
  if (new.content is null or new.content = '') and new.body is not null then
    new.content := new.body;
  end if;
  return new;
end;
$$;

drop trigger if exists reel_banter_sync_body on public.reel_banter;
create trigger reel_banter_sync_body
  before insert or update on public.reel_banter
  for each row execute function public.bawaal_reel_banter_sync_body();

create index if not exists reel_banter_reel_idx
  on public.reel_banter (reel_id, created_at desc);
create index if not exists reel_banter_user_idx
  on public.reel_banter (user_id);

alter table public.reel_banter enable row level security;

drop policy if exists reel_banter_all_demo on public.reel_banter;
drop policy if exists reel_banter_select_public on public.reel_banter;
drop policy if exists reel_banter_insert_auth on public.reel_banter;
drop policy if exists reel_banter_update_own on public.reel_banter;
drop policy if exists reel_banter_delete_own on public.reel_banter;

create policy reel_banter_select_public on public.reel_banter
  for select using (true);

create policy reel_banter_insert_auth on public.reel_banter
  for insert to authenticated
  with check (
    auth.uid() is not null
    and user_id = auth.uid()::text
  );

create policy reel_banter_update_own on public.reel_banter
  for update to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

create policy reel_banter_delete_own on public.reel_banter
  for delete to authenticated
  using (user_id = auth.uid()::text);

grant select on public.reel_banter to anon, authenticated;
grant insert, update, delete on public.reel_banter to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Companion social graph (likes / comments) — tighten demo-all policies
-- ═══════════════════════════════════════════════════════════════════════════
do $$
begin
  if to_regclass('public.likes') is not null then
    execute 'alter table public.likes enable row level security';
    execute 'drop policy if exists likes_all_demo on public.likes';
    execute 'drop policy if exists likes_select_public on public.likes';
    execute 'drop policy if exists likes_insert_auth on public.likes';
    execute 'drop policy if exists likes_delete_own on public.likes';
    execute 'create policy likes_select_public on public.likes for select using (true)';
    execute $p$
      create policy likes_insert_auth on public.likes
        for insert to authenticated
        with check (auth.uid() is not null and user_id = auth.uid()::text)
    $p$;
    execute $p$
      create policy likes_delete_own on public.likes
        for delete to authenticated
        using (user_id = auth.uid()::text)
    $p$;
    execute 'grant select on public.likes to anon, authenticated';
    execute 'grant insert, delete on public.likes to authenticated';
  end if;

  if to_regclass('public.comments') is not null then
    execute 'alter table public.comments enable row level security';
    execute 'drop policy if exists comments_all_demo on public.comments';
    execute 'drop policy if exists comments_select_public on public.comments';
    execute 'drop policy if exists comments_insert_auth on public.comments';
    execute 'drop policy if exists comments_delete_own on public.comments';
    execute 'create policy comments_select_public on public.comments for select using (true)';
    execute $p$
      create policy comments_insert_auth on public.comments
        for insert to authenticated
        with check (auth.uid() is not null and user_id = auth.uid()::text)
    $p$;
    execute $p$
      create policy comments_delete_own on public.comments
        for delete to authenticated
        using (user_id = auth.uid()::text)
    $p$;
    execute 'grant select on public.comments to anon, authenticated';
    execute 'grant insert, delete on public.comments to authenticated';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Realtime publication (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  t text;
begin
  foreach t in array array[
    'war_cry_matches',
    'sparks_josh_clips',
    'battle_bawaal_reels',
    'face_off_challenges',
    'reel_likes',
    'reel_banter',
    'likes',
    'comments'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      begin
        execute format(
          'alter publication supabase_realtime add table public.%I',
          t
        );
      exception
        when duplicate_object then null;
        when undefined_object then null;
      end;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
