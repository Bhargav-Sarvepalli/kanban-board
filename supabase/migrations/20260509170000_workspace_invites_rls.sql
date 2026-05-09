-- Keep workspace management usable under RLS:
-- owners/admins can manage invites, recipients can see/accept their invites,
-- and users can join only the workspace they were invited to.

alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.workspaces enable row level security;

create or replace function public.workspace_can_manage(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = target_workspace_id
      and w.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'
  );
$$;

create or replace function public.workspace_can_read(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.workspace_can_manage(target_workspace_id)
  or exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

drop policy if exists "workspaces_read_access" on public.workspaces;
create policy "workspaces_read_access"
on public.workspaces
for select
to authenticated
using (
  owner_id = auth.uid()
  or public.workspace_can_read(id)
);

drop policy if exists "workspaces_owner_insert" on public.workspaces;
create policy "workspaces_owner_insert"
on public.workspaces
for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "workspaces_admin_update" on public.workspaces;
create policy "workspaces_admin_update"
on public.workspaces
for update
to authenticated
using (owner_id = auth.uid() or public.workspace_can_manage(id))
with check (owner_id = auth.uid() or public.workspace_can_manage(id));

drop policy if exists "workspaces_owner_delete" on public.workspaces;
create policy "workspaces_owner_delete"
on public.workspaces
for delete
to authenticated
using (owner_id = auth.uid());

drop policy if exists "workspace_members_read_access" on public.workspace_members;
create policy "workspace_members_read_access"
on public.workspace_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.workspace_can_read(workspace_id)
);

drop policy if exists "workspace_members_admin_insert" on public.workspace_members;
create policy "workspace_members_admin_insert"
on public.workspace_members
for insert
to authenticated
with check (
  public.workspace_can_manage(workspace_id)
  or (
    user_id = auth.uid()
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and exists (
      select 1
      from public.workspace_invites wi
      where wi.workspace_id = workspace_members.workspace_id
        and wi.status = 'pending'
        and lower(wi.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
);

drop policy if exists "workspace_members_admin_update" on public.workspace_members;
create policy "workspace_members_admin_update"
on public.workspace_members
for update
to authenticated
using (public.workspace_can_manage(workspace_id))
with check (public.workspace_can_manage(workspace_id));

drop policy if exists "workspace_members_admin_delete" on public.workspace_members;
create policy "workspace_members_admin_delete"
on public.workspace_members
for delete
to authenticated
using (public.workspace_can_manage(workspace_id) or user_id = auth.uid());

drop policy if exists "workspace_invites_read_access" on public.workspace_invites;
create policy "workspace_invites_read_access"
on public.workspace_invites
for select
to authenticated
using (
  public.workspace_can_manage(workspace_id)
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "workspace_invites_admin_insert" on public.workspace_invites;
create policy "workspace_invites_admin_insert"
on public.workspace_invites
for insert
to authenticated
with check (
  invited_by = auth.uid()
  and public.workspace_can_manage(workspace_id)
);

drop policy if exists "workspace_invites_update_access" on public.workspace_invites;
create policy "workspace_invites_update_access"
on public.workspace_invites
for update
to authenticated
using (
  public.workspace_can_manage(workspace_id)
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
with check (
  public.workspace_can_manage(workspace_id)
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "workspace_invites_delete_access" on public.workspace_invites;
create policy "workspace_invites_delete_access"
on public.workspace_invites
for delete
to authenticated
using (public.workspace_can_manage(workspace_id));
