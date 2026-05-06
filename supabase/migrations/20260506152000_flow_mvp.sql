-- FLOW MVP persistence.
-- These columns are optional from the client perspective; the app falls back to
-- local browser state until this migration is applied in Supabase.

alter table public.project_features
  add column if not exists description text,
  add column if not exists owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists deadline date,
  add column if not exists priority text not null default 'normal',
  add column if not exists status text not null default 'active',
  add column if not exists merged_at timestamptz,
  add column if not exists merged_by uuid references public.profiles(id) on delete set null,
  add column if not exists merge_note text,
  add column if not exists archived_at timestamptz,
  add column if not exists locked boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_features_priority_check'
      and conrelid = 'public.project_features'::regclass
  ) then
    alter table public.project_features
      add constraint project_features_priority_check
      check (priority in ('low', 'normal', 'high')) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_features_status_check'
      and conrelid = 'public.project_features'::regclass
  ) then
    alter table public.project_features
      add constraint project_features_status_check
      check (status in ('planned', 'active', 'blocked', 'ready_to_merge', 'merged', 'archived')) not valid;
  end if;
end $$;

create table if not exists public.flow_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  branch_id uuid references public.project_features(id) on delete set null,
  event_type text not null,
  title text not null,
  detail text,
  actor_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists flow_events_project_created_idx
  on public.flow_events(project_id, created_at desc);

create index if not exists flow_events_branch_created_idx
  on public.flow_events(branch_id, created_at desc);

alter table public.flow_events enable row level security;

drop policy if exists "flow_events_select_project_members" on public.flow_events;
create policy "flow_events_select_project_members"
  on public.flow_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.projects p
      where p.id = flow_events.project_id
        and (
          p.owner_id = auth.uid()
          or exists (
            select 1
            from public.project_members pm
            where pm.project_id = p.id
              and pm.user_id = auth.uid()
          )
          or exists (
            select 1
            from public.workspace_members wm
            where wm.workspace_id = p.workspace_id
              and wm.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "flow_events_insert_project_members" on public.flow_events;
create policy "flow_events_insert_project_members"
  on public.flow_events
  for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and exists (
      select 1
      from public.projects p
      where p.id = flow_events.project_id
        and (
          p.owner_id = auth.uid()
          or exists (
            select 1
            from public.project_members pm
            where pm.project_id = p.id
              and pm.user_id = auth.uid()
          )
          or exists (
            select 1
            from public.workspace_members wm
            where wm.workspace_id = p.workspace_id
              and wm.user_id = auth.uid()
          )
        )
    )
  );
