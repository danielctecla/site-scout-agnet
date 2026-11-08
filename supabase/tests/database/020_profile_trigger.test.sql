-- TASK-006: profile creation trigger (database.md §6.1, §8.4, §8.5).
begin;
\ir ../helpers/setup.psql

select plan(22);

-- ---------------------------------------------------------------------------
-- Function and trigger definition
-- ---------------------------------------------------------------------------
select function_returns('public', 'handle_new_user', array[]::text[], 'trigger', 'handle_new_user is a trigger function');
select is((select prosecdef from pg_proc where oid = 'public.handle_new_user()'::regprocedure), true,
  'handle_new_user is SECURITY DEFINER');
select is((select proconfig from pg_proc where oid = 'public.handle_new_user()'::regprocedure), array['search_path=""'],
  'handle_new_user sets an empty search_path');
select is((select proowner::regrole::text from pg_proc where oid = 'public.handle_new_user()'::regprocedure), 'postgres',
  'handle_new_user is owned by postgres');
select ok(not has_function_privilege('public', 'public.handle_new_user()', 'EXECUTE'), 'PUBLIC cannot execute handle_new_user');
select ok(not has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE'), 'anon cannot execute handle_new_user');
select ok(not has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'),
  'authenticated cannot execute handle_new_user');

select trigger_is('auth', 'users', 'on_auth_user_created', 'public', 'handle_new_user',
  'on_auth_user_created calls handle_new_user');
-- tgtype 5 = ROW (1) + INSERT (4), and not BEFORE (2): AFTER INSERT FOR EACH ROW.
select is((select tgtype::integer from pg_trigger where tgname = 'on_auth_user_created' and tgrelid = 'auth.users'::regclass), 5,
  'on_auth_user_created runs AFTER INSERT FOR EACH ROW');

-- ---------------------------------------------------------------------------
-- Registration creates exactly one empty profile
-- ---------------------------------------------------------------------------
select tests.create_user('ana@example.com', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

select is((select count(*)::integer from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1,
  'registering creates exactly one profile with the auth user id');
select is(
  (select array[full_name, age::text, onboarding_completed_at::text] from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  array[null, null, null]::text[],
  'the new profile has no personal information and incomplete onboarding'
);
select throws_ok($$insert into public.profiles (id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  '23505', 'duplicate key value violates unique constraint "profiles_pkey"', 'a second profile for the same user is rejected');

-- User metadata is client-controlled and must be ignored.
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'authenticated', 'authenticated',
  'mallory@example.com', '{}', '{"full_name": "Mallory", "age": 40, "onboarding_completed_at": "2020-01-01"}', now(), now());
select is(
  (select array[full_name, age::text, onboarding_completed_at::text] from public.profiles where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  array[null, null, null]::text[],
  'user metadata is not copied into the profile'
);

-- Signup through the Auth service (role supabase_auth_admin, which tests
-- cannot assume) is covered by the integration and end-to-end tests.

-- ---------------------------------------------------------------------------
-- Profile creation is part of the signup transaction
-- ---------------------------------------------------------------------------
alter table public.profiles add constraint tmp_reject_all check (false) not valid;
select throws_ok($$select tests.create_user('eve@example.com', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')$$,
  '23514', null, 'registration fails when the profile cannot be created');
select is((select count(*)::integer from auth.users where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'), 0,
  'no auth user remains without a profile');
alter table public.profiles drop constraint tmp_reject_all;

-- ---------------------------------------------------------------------------
-- Trigger context validation
-- ---------------------------------------------------------------------------
select count(*) as profiles_before from public.profiles \gset
create table tests.not_users (id uuid primary key);
create trigger misuse after insert on tests.not_users
  for each row execute function public.handle_new_user();
select throws_ok($$insert into tests.not_users (id) values (gen_random_uuid())$$,
  'P0001', null, 'handle_new_user refuses to run outside the auth.users insert trigger');
select is((select count(*)::integer from public.profiles), :profiles_before, 'the misused trigger created no profile');

-- ---------------------------------------------------------------------------
-- Backfill (same statement as the migration) is idempotent
-- ---------------------------------------------------------------------------
delete from public.profiles where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;
select is((select count(*)::integer from public.profiles where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'), 1,
  'the backfill creates a missing profile');
select lives_ok($$insert into public.profiles (id) select id from auth.users on conflict (id) do nothing$$,
  'running the backfill again succeeds');
select is((select count(*)::integer from public.profiles), (select count(*)::integer from auth.users),
  'every auth user has exactly one profile');

-- ---------------------------------------------------------------------------
-- Deleting the auth user deletes the profile
-- ---------------------------------------------------------------------------
delete from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is((select count(*)::integer from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0,
  'deleting the auth user deletes the profile');
select is((select count(*)::integer from public.profiles where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'), 1,
  'other profiles are untouched');

select * from finish();
rollback;
