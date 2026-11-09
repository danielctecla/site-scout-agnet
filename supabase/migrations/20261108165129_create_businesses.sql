-- One business per user, written only by finish_onboarding
-- (database.md §3.2, §3.3, §4, §8.3). RLS, policies and grants are created
-- here, with the table (database.md §10, rule 2).

create table public.businesses (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  industry text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint businesses_pkey primary key (id),
  constraint businesses_user_id_key unique (user_id),
  constraint businesses_user_id_fkey foreign key (user_id)
    references public.profiles (id) on delete cascade,
  constraint businesses_name_check check (
    char_length(name) between 1 and 120 and name !~ '^\s|\s$'
  ),
  -- The only database definition of the industry list (database.md §4).
  -- Changing it requires a new migration and the same change to INDUSTRIES.
  constraint businesses_industry_check check (
    industry in (
      'food_beverage',
      'clothing_accessories',
      'technology_electronics',
      'beauty_personal_care',
      'health',
      'education',
      'professional_services',
      'construction_maintenance',
      'retail',
      'other'
    )
  ),
  constraint businesses_status_check check (
    status in ('planning', 'active')
  )
);

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.handle_updated_at();

alter table public.businesses enable row level security;

-- Clients can only read their own business; there is no client write path.
revoke all on table public.businesses from anon, authenticated;
grant select on table public.businesses to authenticated;

create policy businesses_select_own on public.businesses
  for select to authenticated
  using (user_id = (select auth.uid()));
