-- BAWAAL · BATTLE BAWAAL multi-challenger arena schema
-- Run via Supabase SQL editor or: supabase db push

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  host_id text not null,
  host_username text,
  host_flag text,
  title text,
  category text,
  match_length text,
  status text not null default 'live'
    check (status in ('scheduled', 'live', 'completed')),
  host_reps integer not null default 0,
  total_spectators integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.battle_challengers (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles (id) on delete cascade,
  user_id text not null,
  username text,
  flag text,
  reps integer not null default 0,
  votes integer not null default 0,
  joined_at timestamptz not null default now(),
  unique (battle_id, user_id)
);

create table if not exists public.battle_events (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles (id) on delete cascade,
  sender_id text,
  event_type text not null
    check (event_type in ('HYPE', 'VOTE_HOST', 'VOTE_RIVAL', 'BANTER')),
  target_challenger_id text,
  created_at timestamptz not null default now()
);

create index if not exists battle_challengers_battle_id_idx
  on public.battle_challengers (battle_id);

create index if not exists battle_events_battle_id_created_idx
  on public.battle_events (battle_id, created_at desc);

-- ---------------------------------------------------------------------------
-- REALTIME (idempotent — skip if already in publication)
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    alter publication supabase_realtime add table public.battles;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.battle_challengers;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.battle_events;
  exception when duplicate_object then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- RLS (anon open for demo / Expo Go — tighten for production auth)
-- ---------------------------------------------------------------------------

alter table public.battles enable row level security;
alter table public.battle_challengers enable row level security;
alter table public.battle_events enable row level security;

drop policy if exists "battles_select_all" on public.battles;
create policy "battles_select_all" on public.battles for select using (true);

drop policy if exists "battles_insert_all" on public.battles;
create policy "battles_insert_all" on public.battles for insert with check (true);

drop policy if exists "battles_update_all" on public.battles;
create policy "battles_update_all" on public.battles for update using (true);

drop policy if exists "challengers_select_all" on public.battle_challengers;
create policy "challengers_select_all" on public.battle_challengers for select using (true);

drop policy if exists "challengers_insert_all" on public.battle_challengers;
create policy "challengers_insert_all" on public.battle_challengers for insert with check (true);

drop policy if exists "challengers_update_all" on public.battle_challengers;
create policy "challengers_update_all" on public.battle_challengers for update using (true);

drop policy if exists "events_select_all" on public.battle_events;
create policy "events_select_all" on public.battle_events for select using (true);

drop policy if exists "events_insert_all" on public.battle_events;
create policy "events_insert_all" on public.battle_events for insert with check (true);

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Insert a floating reaction / vote event (and bump challenger votes when VOTE_RIVAL)
create or replace function public.send_battle_reaction(
  p_battle_id uuid,
  p_sender_id text,
  p_event_type text,
  p_target_challenger_id text default null
)
returns public.battle_events
language plpgsql
security definer
as $$
declare
  v_row public.battle_events;
begin
  insert into public.battle_events (battle_id, sender_id, event_type, target_challenger_id)
  values (p_battle_id, p_sender_id, p_event_type, p_target_challenger_id)
  returning * into v_row;

  if p_event_type = 'VOTE_RIVAL' and p_target_challenger_id is not null then
    update public.battle_challengers
      set votes = votes + 1
    where battle_id = p_battle_id
      and user_id = p_target_challenger_id;
  end if;

  return v_row;
end;
$$;

-- Increment reps for host or a challenger
create or replace function public.increment_battle_reps(
  p_battle_id uuid,
  p_user_id text,
  p_delta integer default 1
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_host_id text;
  v_host_reps integer;
  v_challenger_reps integer;
begin
  select host_id into v_host_id from public.battles where id = p_battle_id;
  if v_host_id is null then
    raise exception 'battle not found';
  end if;

  if p_user_id = v_host_id then
    update public.battles
      set host_reps = host_reps + greatest(p_delta, 1)
    where id = p_battle_id
    returning host_reps into v_host_reps;
    return jsonb_build_object('role', 'host', 'reps', v_host_reps);
  else
    update public.battle_challengers
      set reps = reps + greatest(p_delta, 1)
    where battle_id = p_battle_id
      and user_id = p_user_id
    returning reps into v_challenger_reps;
    return jsonb_build_object('role', 'challenger', 'reps', coalesce(v_challenger_reps, 0));
  end if;
end;
$$;

-- Cast a crowd vote toward a challenger (or host via null target + VOTE_HOST event)
create or replace function public.cast_battle_vote(
  p_battle_id uuid,
  p_sender_id text,
  p_challenger_user_id text default null
)
returns public.battle_events
language plpgsql
security definer
as $$
declare
  v_type text;
begin
  if p_challenger_user_id is null or p_challenger_user_id = '' then
    v_type := 'VOTE_HOST';
  else
    v_type := 'VOTE_RIVAL';
  end if;

  return public.send_battle_reaction(
    p_battle_id,
    p_sender_id,
    v_type,
    nullif(p_challenger_user_id, '')
  );
end;
$$;

grant execute on function public.send_battle_reaction(uuid, text, text, text) to anon, authenticated;
grant execute on function public.increment_battle_reps(uuid, text, integer) to anon, authenticated;
grant execute on function public.cast_battle_vote(uuid, text, text) to anon, authenticated;
