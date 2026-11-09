-- Completed Location Evaluations (database.md §13). RLS, policies and grants
-- are created here, with the table (database.md §10, rule 2).

create table public.location_evaluations (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  input jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),

  constraint location_evaluations_pkey primary key (id),
  constraint location_evaluations_user_id_fkey foreign key (user_id)
    references public.profiles (id) on delete cascade,
  constraint location_evaluations_input_check check (jsonb_typeof(input) = 'object'),
  constraint location_evaluations_result_check check (
    jsonb_typeof(result) = 'object' and pg_column_size(result) <= 5000000
  )
);

create index location_evaluations_user_id_idx
  on public.location_evaluations (user_id);

alter table public.location_evaluations enable row level security;

-- Users read and create only their own evaluations. Only input and result are
-- writable: id, user_id and created_at always come from their defaults.
revoke all on table public.location_evaluations from anon, authenticated;
grant select on table public.location_evaluations to authenticated;
grant insert (input, result) on table public.location_evaluations to authenticated;

create policy location_evaluations_select_own on public.location_evaluations
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy location_evaluations_insert_own on public.location_evaluations
  for insert to authenticated
  with check (user_id = (select auth.uid()));
