-- Personal information and onboarding progress, one row per auth user
-- (database.md §3.1, §3.3, §8.2). RLS, policies and grants are created here,
-- with the table (database.md §10, rule 2).

create table public.profiles (
  id uuid not null,
  full_name text,
  age integer,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign key (id)
    references auth.users (id) on delete cascade,
  constraint profiles_full_name_check check (
    full_name is null
    or (char_length(full_name) between 1 and 100 and full_name !~ '^\s|\s$')
  ),
  constraint profiles_age_check check (
    age is null or age between 16 and 100
  ),
  constraint profiles_completion_requires_personal_info check (
    onboarding_completed_at is null
    or (full_name is not null and age is not null)
  )
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

alter table public.profiles enable row level security;

-- Supabase grants ALL on new public tables to anon and authenticated; table
-- privileges override column grants, so revoke first (database.md §8.1).
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, age) on table public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- Personal information is locked once onboarding is completed (FR-06).
create policy profiles_update_own_before_completion on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and onboarding_completed_at is null)
  with check (id = (select auth.uid()) and onboarding_completed_at is null);
