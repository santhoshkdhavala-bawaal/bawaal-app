-- Fix cloud persist: anon/authenticated need table GRANTs + upsert-safe RLS.
-- Without GRANT, upsert fails → "Posted locally / cloud save failed".

grant usage on schema public to anon, authenticated;

grant select, insert, update on table public.bawaal_posts to anon, authenticated;

alter table public.bawaal_posts enable row level security;

drop policy if exists "bawaal_posts_select_all" on public.bawaal_posts;
create policy "bawaal_posts_select_all"
  on public.bawaal_posts for select
  using (true);

drop policy if exists "bawaal_posts_insert_all" on public.bawaal_posts;
create policy "bawaal_posts_insert_all"
  on public.bawaal_posts for insert
  with check (true);

drop policy if exists "bawaal_posts_update_all" on public.bawaal_posts;
create policy "bawaal_posts_update_all"
  on public.bawaal_posts for update
  using (true)
  with check (true);
