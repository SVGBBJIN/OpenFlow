-- Restrict Realtime broadcast to round members (read) and editors/owners (write).
-- The client joins private channels named "round:<round uuid>". Requires Supabase Realtime Authorization.
create policy "round members receive broadcast" on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast' and exists (
    select 1 from public.rounds r where 'round:' || r.id::text = (select realtime.topic()) and public.can_read_round(r.id)));
create policy "round editors send broadcast" on realtime.messages for insert to authenticated
  with check (realtime.messages.extension = 'broadcast' and exists (
    select 1 from public.rounds r where 'round:' || r.id::text = (select realtime.topic()) and public.can_edit_round(r.id)));
