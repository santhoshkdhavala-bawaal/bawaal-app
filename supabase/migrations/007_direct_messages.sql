-- BAWAAL · 1v1 Athlete Direct Messages
-- Safe to re-run.

create extension if not exists "pgcrypto";

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id text not null,
  receiver_id text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint direct_messages_body_len check (char_length(body) > 0 and char_length(body) <= 4000),
  constraint direct_messages_not_self check (sender_id <> receiver_id)
);

alter table public.direct_messages add column if not exists sender_id text;
alter table public.direct_messages add column if not exists receiver_id text;
alter table public.direct_messages add column if not exists body text;
alter table public.direct_messages add column if not exists read boolean default false;
alter table public.direct_messages add column if not exists created_at timestamptz default now();

create index if not exists direct_messages_pair_created_idx
  on public.direct_messages (sender_id, receiver_id, created_at asc);

create index if not exists direct_messages_inbox_idx
  on public.direct_messages (receiver_id, created_at desc);

create index if not exists direct_messages_created_at_idx
  on public.direct_messages (created_at desc);

alter table public.direct_messages enable row level security;

drop policy if exists "dm_select_participants" on public.direct_messages;
create policy "dm_select_participants"
  on public.direct_messages for select
  using (
    auth.uid()::text = sender_id
    or auth.uid()::text = receiver_id
  );

drop policy if exists "dm_insert_as_sender" on public.direct_messages;
create policy "dm_insert_as_sender"
  on public.direct_messages for insert
  with check (auth.uid()::text = sender_id);

drop policy if exists "dm_update_receiver_read" on public.direct_messages;
create policy "dm_update_receiver_read"
  on public.direct_messages for update
  using (auth.uid()::text = receiver_id)
  with check (auth.uid()::text = receiver_id);

-- Realtime for instant inbox updates
do $$
begin
  begin
    alter publication supabase_realtime add table public.direct_messages;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

notify pgrst, 'reload schema';
