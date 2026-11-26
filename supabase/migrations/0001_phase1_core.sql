-- OpenFlow Phase 1: identity, rounds, speeches, arguments, explicit relationships.
-- Row Level Security isolates every user's data; sharing is via round_members.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled round',
  tournament text not null default '',
  side text not null check (side in ('pro','con')),
  opponent text not null default '',
  partner_name text not null default '',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.round_members (
  round_id uuid not null references public.rounds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (round_id, user_id)
);

create table public.speeches (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  position int not null,
  name text not null,
  side text not null check (side in ('pro','con')),
  minutes int not null default 2 check (minutes > 0)
);
create index on public.speeches (round_id, position);

create table public.arguments (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  flow text not null check (flow in ('pro','con')),
  speech_id uuid not null references public.speeches(id) on delete restrict,
  parent_id uuid references public.arguments(id) on delete cascade,
  extends_id uuid references public.arguments(id) on delete set null,
  sort_order double precision not null default 0,
  body_html text not null default '',
  status text not null default 'active' check (status in ('active','answered','dropped','extended','turned','unresolved')),
  priority smallint not null default 0 check (priority between 0 and 3),
  tags text[] not null default '{}',
  notes text not null default '',
  impact text not null default '',
  collapsed boolean not null default false,
  is_turn boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.arguments (round_id);
create index on public.arguments (parent_id);

-- Cross-links between arguments anywhere in the flow (stored once, a < b).
create table public.argument_links (
  a_id uuid not null references public.arguments(id) on delete cascade,
  b_id uuid not null references public.arguments(id) on delete cascade,
  primary key (a_id, b_id),
  check (a_id < b_id)
);

-- Membership helpers (security definer avoids recursive RLS on round_members).
create function public.can_read_round(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from rounds where id = r and owner_id = auth.uid())
      or exists (select 1 from round_members where round_id = r and user_id = auth.uid());
$$;
create function public.can_edit_round(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from rounds where id = r and owner_id = auth.uid())
      or exists (select 1 from round_members where round_id = r and user_id = auth.uid() and role in ('owner','editor'));
$$;

alter table public.profiles enable row level security;
alter table public.rounds enable row level security;
alter table public.round_members enable row level security;
alter table public.speeches enable row level security;
alter table public.arguments enable row level security;
alter table public.argument_links enable row level security;

create policy profiles_self on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

create policy rounds_read on public.rounds for select using (owner_id = auth.uid() or public.can_read_round(id));
create policy rounds_insert on public.rounds for insert with check (owner_id = auth.uid());
create policy rounds_update on public.rounds for update using (owner_id = auth.uid() or public.can_edit_round(id));
create policy rounds_delete on public.rounds for delete using (owner_id = auth.uid());

create policy members_read on public.round_members for select using (public.can_read_round(round_id));
create policy members_owner_write on public.round_members for all
  using (exists (select 1 from public.rounds r where r.id = round_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.rounds r where r.id = round_id and r.owner_id = auth.uid()));

create policy speeches_read on public.speeches for select using (public.can_read_round(round_id));
create policy speeches_write on public.speeches for all using (public.can_edit_round(round_id)) with check (public.can_edit_round(round_id));

create policy args_read on public.arguments for select using (public.can_read_round(round_id));
create policy args_write on public.arguments for all using (public.can_edit_round(round_id)) with check (public.can_edit_round(round_id));

create policy links_read on public.argument_links for select
  using (exists (select 1 from public.arguments a where a.id = a_id and public.can_read_round(a.round_id)));
create policy links_write on public.argument_links for all
  using (exists (select 1 from public.arguments a where a.id = a_id and public.can_edit_round(a.round_id)))
  with check (exists (select 1 from public.arguments a where a.id = a_id and public.can_edit_round(a.round_id)));

-- Owner is always a member row, created automatically.
create function public.add_owner_member() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into round_members (round_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end $$;
create trigger rounds_owner_member after insert on public.rounds for each row execute function public.add_owner_member();

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
