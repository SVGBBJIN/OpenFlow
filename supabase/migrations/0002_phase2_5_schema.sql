-- OpenFlow Phases 2–5: extra round/argument columns, invites, teams, shared libraries,
-- speech documents, version history. RLS everywhere; sharing flows through round_members / team_memberships.

alter table public.rounds
  add column plans jsonb,
  add column review jsonb,
  add column completed boolean not null default false;

alter table public.arguments
  add column inserts jsonb not null default '[]',
  add column evidence_ids jsonb not null default '[]';

-- ───────────── Invite links ─────────────
create table public.round_invites (
  token text primary key default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  round_id uuid not null references public.rounds(id) on delete cascade,
  role text not null check (role in ('editor','viewer')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '14 days',
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.round_invites enable row level security;
create policy invites_owner on public.round_invites for all
  using (exists (select 1 from public.rounds r where r.id = round_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.rounds r where r.id = round_id and r.owner_id = auth.uid()));

-- Redeem an invite: caller becomes editor/viewer (never owner; never downgrades an existing role).
create function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv round_invites;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into inv from round_invites where token = p_token and not revoked and expires_at > now();
  if not found then raise exception 'invalid or expired invite'; end if;
  insert into round_members (round_id, user_id, role) values (inv.round_id, auth.uid(), inv.role)
  on conflict (round_id, user_id) do nothing;
  return inv.round_id;
end $$;
grant execute on function public.accept_invite(text) to authenticated;

-- ───────────── Teams ─────────────
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.team_memberships (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  primary key (team_id, user_id)
);
alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;

create function public.team_role(t uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from teams where id = t and owner_id = auth.uid()) then 'owner'
              else (select role from team_memberships where team_id = t and user_id = auth.uid()) end;
$$;
create policy teams_read on public.teams for select using (owner_id = auth.uid() or public.team_role(id) is not null);
create policy teams_insert on public.teams for insert with check (owner_id = auth.uid());
create policy teams_owner_write on public.teams for update using (owner_id = auth.uid());
create policy teams_owner_delete on public.teams for delete using (owner_id = auth.uid());
create policy tm_read on public.team_memberships for select using (public.team_role(team_id) is not null);
create policy tm_owner_write on public.team_memberships for all
  using (public.team_role(team_id) = 'owner') with check (public.team_role(team_id) = 'owner');

-- ───────────── Evidence + blocks (personal or team-shared) ─────────────
create table public.evidence_folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  scope text not null check (scope in ('evidence','blocks')),
  parent_id uuid references public.evidence_folders(id) on delete cascade,
  name text not null,
  kind text not null default 'folder' check (kind in ('folder','file'))
);
create table public.evidence_cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  folder_id uuid references public.evidence_folders(id) on delete set null,
  tag text not null default '', author text not null default '', publication text not null default '',
  published text not null default '', url text not null default '',
  body_html text not null default '', citation text not null default '', notes text not null default '',
  topic text not null default '', contention text not null default '',
  tags text[] not null default '{}', collections text[] not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  folder_id uuid references public.evidence_folders(id) on delete set null,
  name text not null, kind text not null, topic text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.block_entries (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.blocks(id) on delete cascade,
  position int not null,
  type text not null check (type in ('card','text')),
  card_id uuid references public.evidence_cards(id) on delete set null,
  html text not null default ''
);

-- ───────────── Speech documents ─────────────
create table public.speech_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  round_id uuid references public.rounds(id) on delete set null,
  title text not null, template text not null default 'blank', speech_name text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.document_entries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.speech_documents(id) on delete cascade,
  position int not null,
  kind text not null check (kind in ('heading','text','arg','card')),
  argument_id uuid references public.arguments(id) on delete set null,
  card_id uuid references public.evidence_cards(id) on delete set null,
  data jsonb not null default '{}'
);

-- Access helper: owner, or member of the owning team (editor/owner may write).
create function public.can_access(owner uuid, team uuid, write boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select owner = auth.uid()
      or (team is not null and (case when write then public.team_role(team) in ('owner','editor') else public.team_role(team) is not null end));
$$;

do $$
declare t text;
begin
  foreach t in array array['evidence_folders','evidence_cards','blocks','speech_documents'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (public.can_access(owner_id, team_id, false))', t || '_read', t);
    execute format('create policy %I on public.%I for insert with check (owner_id = auth.uid() and (team_id is null or public.team_role(team_id) in (''owner'',''editor'')))', t || '_ins', t);
    execute format('create policy %I on public.%I for update using (public.can_access(owner_id, team_id, true))', t || '_upd', t);
    execute format('create policy %I on public.%I for delete using (public.can_access(owner_id, team_id, true))', t || '_del', t);
  end loop;
end $$;

alter table public.block_entries enable row level security;
create policy be_read on public.block_entries for select using (exists (select 1 from public.blocks b where b.id = block_id and public.can_access(b.owner_id, b.team_id, false)));
create policy be_write on public.block_entries for all
  using (exists (select 1 from public.blocks b where b.id = block_id and public.can_access(b.owner_id, b.team_id, true)))
  with check (exists (select 1 from public.blocks b where b.id = block_id and public.can_access(b.owner_id, b.team_id, true)));
alter table public.document_entries enable row level security;
create policy de_read on public.document_entries for select using (exists (select 1 from public.speech_documents d where d.id = document_id and public.can_access(d.owner_id, d.team_id, false)));
create policy de_write on public.document_entries for all
  using (exists (select 1 from public.speech_documents d where d.id = document_id and public.can_access(d.owner_id, d.team_id, true)))
  with check (exists (select 1 from public.speech_documents d where d.id = document_id and public.can_access(d.owner_id, d.team_id, true)));

-- ───────────── Round version history ─────────────
create table public.round_versions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  label text not null default '',
  snapshot jsonb not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on public.round_versions (round_id, created_at desc);
alter table public.round_versions enable row level security;
create policy rv_read on public.round_versions for select using (public.can_read_round(round_id));
create policy rv_insert on public.round_versions for insert with check (public.can_edit_round(round_id) and created_by = auth.uid());
create policy rv_delete on public.round_versions for delete using (exists (select 1 from public.rounds r where r.id = round_id and r.owner_id = auth.uid()));
