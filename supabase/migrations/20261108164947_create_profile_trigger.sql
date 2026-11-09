-- Creates the profile when a user registers (database.md §6.1).
--
-- SECURITY DEFINER exception 1 (database.md §8.5): the Auth service inserts
-- users as supabase_auth_admin, which has no privileges on application tables.
-- There is no end-user request context during signup, so the only identity
-- source is NEW.id, and the function refuses to run in any other trigger
-- context. It ignores user metadata (client-controlled).

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_when <> 'AFTER' or tg_level <> 'ROW' or tg_op <> 'INSERT'
     or tg_table_schema <> 'auth' or tg_table_name <> 'users' then
    raise exception 'handle_new_user must run as the AFTER INSERT row trigger on auth.users';
  end if;

  insert into public.profiles (id) values (new.id);
  return null;
end;
$$;

-- Trigger function: nobody calls it directly (database.md §8.4).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Runs inside the signup transaction: if it fails, the signup fails.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profiles for users that registered before this trigger existed.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
