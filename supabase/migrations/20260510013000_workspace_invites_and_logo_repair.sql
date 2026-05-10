-- Repair workspace invite acceptance and make logo storage setup self-contained.
-- This migration intentionally recreates the helper functions because some
-- production databases may have skipped the earlier workspace RLS migration.

alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.workspaces enable row level security;

alter table public.workspaces
  add column if not exists logo_url text;

alter table public.projects
  add column if not exists logo_url text;

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
  )
  or exists (
    select 1
    from public.workspace_invites wi
    where wi.workspace_id = target_workspace_id
      and wi.status = 'pending'
      and lower(wi.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.project_can_manage(target_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = target_project_id
      and (
        p.owner_id = auth.uid()
        or exists (
          select 1
          from public.project_members pm
          where pm.project_id = p.id
            and pm.user_id = auth.uid()
            and pm.role in ('owner', 'manager')
        )
        or exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = p.workspace_id
            and wm.user_id = auth.uid()
            and wm.role = 'admin'
        )
      )
  );
$$;

create or replace function public.accept_workspace_invite(target_invite_id uuid)
returns table(workspace_id uuid, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.workspace_invites%rowtype;
  signed_in_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept a workspace invite.';
  end if;

  select *
  into invite_row
  from public.workspace_invites wi
  where wi.id = target_invite_id
    and wi.status = 'pending'
    and lower(wi.email) = signed_in_email
  limit 1;

  if not found then
    raise exception 'This invite is no longer available for this signed-in email.';
  end if;

  insert into public.workspace_members (workspace_id, user_id, email, role)
  select invite_row.workspace_id, auth.uid(), signed_in_email, invite_row.role
  where not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = invite_row.workspace_id
      and wm.user_id = auth.uid()
  );

  update public.workspace_invites
  set status = 'accepted'
  where id = invite_row.id;

  return query select invite_row.workspace_id, invite_row.role::text;
end;
$$;

grant execute on function public.accept_workspace_invite(uuid) to authenticated;

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('workspace-logos', 'workspace-logos', true, 5242880, array['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('project-logos', 'project-logos', true, 5242880, array['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Workspace logos are publicly readable" on storage.objects;
create policy "Workspace logos are publicly readable"
on storage.objects for select
using (bucket_id = 'workspace-logos');

drop policy if exists "Workspace managers can upload logos" on storage.objects;
create policy "Workspace managers can upload logos"
on storage.objects for insert
with check (
  bucket_id = 'workspace-logos'
  and public.workspace_can_manage(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Workspace managers can update logos" on storage.objects;
create policy "Workspace managers can update logos"
on storage.objects for update
using (
  bucket_id = 'workspace-logos'
  and public.workspace_can_manage(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'workspace-logos'
  and public.workspace_can_manage(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Workspace managers can delete logos" on storage.objects;
create policy "Workspace managers can delete logos"
on storage.objects for delete
using (
  bucket_id = 'workspace-logos'
  and public.workspace_can_manage(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Project logos are publicly readable" on storage.objects;
create policy "Project logos are publicly readable"
on storage.objects for select
using (bucket_id = 'project-logos');

drop policy if exists "Project managers can upload logos" on storage.objects;
create policy "Project managers can upload logos"
on storage.objects for insert
with check (
  bucket_id = 'project-logos'
  and public.project_can_manage(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Project managers can update logos" on storage.objects;
create policy "Project managers can update logos"
on storage.objects for update
using (
  bucket_id = 'project-logos'
  and public.project_can_manage(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'project-logos'
  and public.project_can_manage(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Project managers can delete logos" on storage.objects;
create policy "Project managers can delete logos"
on storage.objects for delete
using (
  bucket_id = 'project-logos'
  and public.project_can_manage(((storage.foldername(name))[1])::uuid)
);
