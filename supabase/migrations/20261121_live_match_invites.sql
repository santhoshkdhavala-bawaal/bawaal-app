-- BAWAAL Live Match — targeted invites (soft-fail clients if absent)

alter table public.live_matches
  add column if not exists invite_code text;

create unique index if not exists live_matches_invite_code_uidx
  on public.live_matches (invite_code)
  where invite_code is not null;

create table if not exists public.live_match_invites (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.live_matches (id) on delete cascade,
  host_id text,
  host_handle text,
  recipient_id text,
  recipient_handle text,
  sport text,
  team_a_name text,
  team_b_name text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists live_match_invites_recipient_idx
  on public.live_match_invites (recipient_id, created_at desc);

create index if not exists live_match_invites_handle_idx
  on public.live_match_invites (recipient_handle, created_at desc);

alter table public.live_match_invites enable row level security;

drop policy if exists "live_match_invites_select" on public.live_match_invites;
create policy "live_match_invites_select"
  on public.live_match_invites
  for select
  to anon, authenticated
  using (true);

drop policy if exists "live_match_invites_insert" on public.live_match_invites;
create policy "live_match_invites_insert"
  on public.live_match_invites
  for insert
  to anon, authenticated
  with check (true);
