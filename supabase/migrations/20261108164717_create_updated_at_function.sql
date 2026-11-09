-- Keeps updated_at current on every update (database.md §6.2).

create function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Trigger function: nobody calls it directly (database.md §8.4).
revoke execute on function public.handle_updated_at() from public, anon, authenticated;
