create table if not exists public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  wake_up_time text,
  sleep_quality text not null default 'okay'
    check (sleep_quality in ('poor', 'okay', 'good')),
  energy_level text not null default 'medium'
    check (energy_level in ('low', 'medium', 'high')),
  available_hours numeric not null default 6
    check (available_hours >= 0 and available_hours <= 24),
  main_focus text,
  hard_commitments text,
  extra_context text,
  summary text not null default '',
  briefing_text text not null default '',
  priorities jsonb not null default '[]'::jsonb,
  schedule_blocks jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_plans_user_date_key unique (user_id, date)
);

alter table public.daily_plans enable row level security;

drop policy if exists "daily_plans_select_own" on public.daily_plans;
create policy "daily_plans_select_own"
on public.daily_plans
for select
using (auth.uid() = user_id);

drop policy if exists "daily_plans_insert_own" on public.daily_plans;
create policy "daily_plans_insert_own"
on public.daily_plans
for insert
with check (auth.uid() = user_id);

drop policy if exists "daily_plans_update_own" on public.daily_plans;
create policy "daily_plans_update_own"
on public.daily_plans
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "daily_plans_delete_own" on public.daily_plans;
create policy "daily_plans_delete_own"
on public.daily_plans
for delete
using (auth.uid() = user_id);

create or replace function public.touch_daily_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists daily_plans_touch_updated_at on public.daily_plans;
create trigger daily_plans_touch_updated_at
before update on public.daily_plans
for each row
execute function public.touch_daily_plans_updated_at();

