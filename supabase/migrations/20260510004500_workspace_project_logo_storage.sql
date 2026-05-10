-- Workspace and project logo uploads.
-- Run this after the invite/profile policies migration so workspace_can_manage exists.

alter table public.workspaces
  add column if not exists logo_url text;

alter table public.projects
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('workspace-logos', 'workspace-logos', true, 5242880, array['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('project-logos', 'project-logos', true, 5242880, array['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
