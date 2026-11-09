-- TASK-005: profiles table, updated_at trigger, RLS and privileges
-- (database.md §3.1, §3.3, §6.2, §7.2 Path B, §8.1, §8.2, §8.4).
begin;
\ir ../helpers/setup.psql

select plan(81);

-- Fixtures: Ana and Ben, each with a profile. After TASK-006 the trigger
-- creates the profiles; before it, the insert does.
select tests.create_user('ana@example.com', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select tests.create_user('ben@example.com', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.profiles (id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------
select has_table('public', 'profiles', 'profiles exists');
select columns_are('public', 'profiles',
  array['id', 'full_name', 'birth_date', 'onboarding_completed_at', 'created_at', 'updated_at'],
  'profiles has exactly the documented columns');
select col_is_pk('public', 'profiles', 'id', 'id is the primary key');
select col_type_is('public', 'profiles', 'full_name', 'text', 'full_name is text');
select col_type_is('public', 'profiles', 'birth_date', 'date', 'birth_date is date');
select col_type_is('public', 'profiles', 'onboarding_completed_at', 'timestamp with time zone', 'onboarding_completed_at is timestamptz');
select col_is_null('public', 'profiles', 'full_name', 'full_name is nullable');
select col_is_null('public', 'profiles', 'birth_date', 'birth_date is nullable');
select col_is_null('public', 'profiles', 'onboarding_completed_at', 'onboarding_completed_at is nullable');
select col_not_null('public', 'profiles', 'created_at', 'created_at is not null');
select col_not_null('public', 'profiles', 'updated_at', 'updated_at is not null');
select fk_ok('public', 'profiles', 'id', 'auth', 'users', 'id', 'id references auth.users');

select is(
  (select array_agg(conname::text order by conname) from pg_constraint where conrelid = 'public.profiles'::regclass),
  array['profiles_completion_requires_personal_info', 'profiles_full_name_check', 'profiles_id_fkey', 'profiles_pkey'],
  'profiles has exactly the documented named constraints'
);

select is(
  (select array[full_name, birth_date::text, onboarding_completed_at::text] from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  array[null, null, null]::text[],
  'a new profile has no personal information and incomplete onboarding'
);

-- ---------------------------------------------------------------------------
-- Constraints, as the table owner (every write path)
-- ---------------------------------------------------------------------------
select lives_ok($$update public.profiles set full_name = 'A' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'a 1-character full name is accepted');
select lives_ok($$update public.profiles set full_name = repeat('x', 100) where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'a 100-character full name is accepted');
select lives_ok($$update public.profiles set full_name = 'Ana María  López' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'internal whitespace is preserved');
select is((select full_name from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'Ana María  López',
  'the full name is stored as written');

select throws_ok($$update public.profiles set full_name = repeat('x', 101) where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', 'new row for relation "profiles" violates check constraint "profiles_full_name_check"',
  'a 101-character full name is rejected');
select throws_ok($$update public.profiles set full_name = '' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', 'new row for relation "profiles" violates check constraint "profiles_full_name_check"',
  'an empty full name is rejected');
select throws_ok($$update public.profiles set full_name = '   ' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', 'new row for relation "profiles" violates check constraint "profiles_full_name_check"',
  'a whitespace-only full name is rejected');
select throws_ok($$update public.profiles set full_name = ' Ana' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', 'new row for relation "profiles" violates check constraint "profiles_full_name_check"',
  'a full name with leading whitespace is rejected');
select throws_ok($$update public.profiles set full_name = E'Ana\n' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', 'new row for relation "profiles" violates check constraint "profiles_full_name_check"',
  'a full name with a trailing newline is rejected');

-- Date of birth: the trigger enforces an age of 16-100 on the day it is written (database.md §6.3).
select trigger_is('public', 'profiles', 'profiles_validate_birth_date', 'public', 'validate_profile_birth_date',
  'profiles_validate_birth_date calls validate_profile_birth_date');
select is((select prosecdef from pg_proc where oid = 'public.validate_profile_birth_date()'::regprocedure), false,
  'validate_profile_birth_date is SECURITY INVOKER');
select is((select proconfig from pg_proc where oid = 'public.validate_profile_birth_date()'::regprocedure), array['search_path=""'],
  'validate_profile_birth_date sets an empty search_path');
select ok(not has_function_privilege('public', 'public.validate_profile_birth_date()', 'EXECUTE'), 'PUBLIC cannot execute validate_profile_birth_date');
select ok(not has_function_privilege('anon', 'public.validate_profile_birth_date()', 'EXECUTE'), 'anon cannot execute validate_profile_birth_date');
select ok(not has_function_privilege('authenticated', 'public.validate_profile_birth_date()', 'EXECUTE'),
  'authenticated cannot execute validate_profile_birth_date');

select lives_ok($$update public.profiles set birth_date = (current_date - interval '16 years')::date where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'a date of birth giving age 16 today is accepted');
select lives_ok($$update public.profiles set birth_date = (current_date - interval '101 years' + interval '1 day')::date where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'a date of birth giving age 100 today is accepted');
select throws_ok($$update public.profiles set birth_date = (current_date - interval '16 years' + interval '1 day')::date where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', 'birth_date must give an age between 16 and 100', 'a date of birth giving age 15 today is rejected');
select throws_ok($$update public.profiles set birth_date = (current_date - interval '101 years')::date where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', 'birth_date must give an age between 16 and 100', 'a date of birth giving age 101 today is rejected');

-- A stored date is not re-evaluated when it is not changed (it may age out over time).
alter table public.profiles disable trigger profiles_validate_birth_date;
update public.profiles set birth_date = '1900-01-01' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
alter table public.profiles enable trigger profiles_validate_birth_date;
select lives_ok($$update public.profiles set full_name = 'Ana' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'updating other columns does not re-evaluate the stored date of birth');
select lives_ok($$update public.profiles set birth_date = '1900-01-01' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  're-saving the same date of birth does not re-evaluate it');

-- Inserts are never evaluated, so restoring a backup cannot fail on old dates.
select tests.create_user('old@example.com', '99999999-9999-4999-8999-999999999999');
delete from public.profiles where id = '99999999-9999-4999-8999-999999999999';
select lives_ok($$insert into public.profiles (id, birth_date) values ('99999999-9999-4999-8999-999999999999', '1900-01-01')$$,
  'an insert with any date of birth is not evaluated');
update public.profiles set full_name = null, birth_date = null where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- Completion invariant
select throws_ok($$update public.profiles set onboarding_completed_at = now() where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$,
  '23514', 'new row for relation "profiles" violates check constraint "profiles_completion_requires_personal_info"',
  'onboarding cannot be completed without personal information');
select throws_ok($$update public.profiles set full_name = 'Ben', onboarding_completed_at = now() where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$,
  '23514', 'new row for relation "profiles" violates check constraint "profiles_completion_requires_personal_info"',
  'onboarding cannot be completed without a date of birth');
select lives_ok($$update public.profiles set full_name = 'Ana', birth_date = '1990-05-14', onboarding_completed_at = now() where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'onboarding can be completed with personal information');
select throws_ok($$update public.profiles set full_name = null where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', 'new row for relation "profiles" violates check constraint "profiles_completion_requires_personal_info"',
  'personal information cannot be removed after completion');
-- Reset Ana for the client tests below.
update public.profiles set full_name = null, birth_date = null, onboarding_completed_at = null
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- ---------------------------------------------------------------------------
-- RLS and privileges
-- ---------------------------------------------------------------------------
select is((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), true, 'RLS is enabled');
select is((select relforcerowsecurity from pg_class where oid = 'public.profiles'::regclass), false, 'RLS is not forced');
select policies_are('public', 'profiles', array['profiles_select_own', 'profiles_update_own_before_completion'],
  'profiles has exactly the documented policies');
select policy_cmd_is('public', 'profiles', 'profiles_select_own', 'select', 'profiles_select_own is a SELECT policy');
select policy_roles_are('public', 'profiles', 'profiles_select_own', array['authenticated'], 'profiles_select_own applies to authenticated');
select policy_cmd_is('public', 'profiles', 'profiles_update_own_before_completion', 'update', 'profiles_update_own_before_completion is an UPDATE policy');
select policy_roles_are('public', 'profiles', 'profiles_update_own_before_completion', array['authenticated'],
  'profiles_update_own_before_completion applies to authenticated');

select table_privs_are('public', 'profiles', 'anon', array[]::text[], 'anon has no table privileges');
select table_privs_are('public', 'profiles', 'authenticated', array['SELECT'], 'authenticated has only SELECT at table level');
select ok(has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE'), 'authenticated can update full_name');
select ok(has_column_privilege('authenticated', 'public.profiles', 'birth_date', 'UPDATE'), 'authenticated can update birth_date');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE'), 'authenticated cannot update id');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'onboarding_completed_at', 'UPDATE'),
  'authenticated cannot update onboarding_completed_at');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'created_at', 'UPDATE'), 'authenticated cannot update created_at');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'updated_at', 'UPDATE'), 'authenticated cannot update updated_at');
select ok(not has_column_privilege('anon', 'public.profiles', 'full_name', 'UPDATE'), 'anon cannot update full_name');

-- ---------------------------------------------------------------------------
-- updated_at function and trigger
-- ---------------------------------------------------------------------------
select function_returns('public', 'handle_updated_at', array[]::text[], 'trigger', 'handle_updated_at is a trigger function');
select is((select prosecdef from pg_proc where oid = 'public.handle_updated_at()'::regprocedure), false,
  'handle_updated_at is SECURITY INVOKER');
select is((select proconfig from pg_proc where oid = 'public.handle_updated_at()'::regprocedure), array['search_path=""'],
  'handle_updated_at sets an empty search_path');
select ok(not has_function_privilege('public', 'public.handle_updated_at()', 'EXECUTE'), 'PUBLIC cannot execute handle_updated_at');
select ok(not has_function_privilege('anon', 'public.handle_updated_at()', 'EXECUTE'), 'anon cannot execute handle_updated_at');
select ok(not has_function_privilege('authenticated', 'public.handle_updated_at()', 'EXECUTE'),
  'authenticated cannot execute handle_updated_at');
select trigger_is('public', 'profiles', 'profiles_set_updated_at', 'public', 'handle_updated_at',
  'profiles_set_updated_at calls handle_updated_at');

-- Backdate Ana's updated_at without firing the trigger, so the client update
-- below proves the trigger sets it.
alter table public.profiles disable trigger profiles_set_updated_at;
update public.profiles set updated_at = '2000-01-01' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
alter table public.profiles enable trigger profiles_set_updated_at;

-- ---------------------------------------------------------------------------
-- Direct client writes (Path B), as Ana
-- ---------------------------------------------------------------------------
select tests.authenticate_as('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

select results_eq('select id from public.profiles', array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid],
  'Ana sees only her own profile');

select lives_ok($$update public.profiles set full_name = 'Ana', birth_date = '1990-05-14' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'Ana can update her own full_name and birth_date before completion');
select is((select array[full_name, birth_date::text] from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  array['Ana', '1990-05-14'], 'the direct update is stored');
select is((select updated_at from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), now(),
  'the trigger sets updated_at on a client update');

select throws_ok($$update public.profiles set full_name = ' Ana' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', null, 'a direct untrimmed update is rejected, not normalized');
select throws_ok($$update public.profiles set onboarding_completed_at = now() where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '42501', 'permission denied for table profiles', 'Ana cannot set onboarding_completed_at');
select throws_ok($$update public.profiles set id = gen_random_uuid() where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '42501', 'permission denied for table profiles', 'Ana cannot change id');
select throws_ok($$update public.profiles set created_at = now() where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '42501', 'permission denied for table profiles', 'Ana cannot change created_at');
select throws_ok($$update public.profiles set updated_at = now() where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '42501', 'permission denied for table profiles', 'Ana cannot change updated_at');
select throws_ok($$insert into public.profiles (id) values (gen_random_uuid())$$,
  '42501', 'permission denied for table profiles', 'Ana cannot insert profiles');
select throws_ok($$delete from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '42501', 'permission denied for table profiles', 'Ana cannot delete profiles');

with updated as (
  update public.profiles set full_name = 'Hacked' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' returning 1
)
select is(count(*)::integer, 0, 'an update of Ben''s profile affects no rows') from updated;

-- After completion, direct updates affect no rows (personal information is locked).
select tests.clear_authentication();
update public.profiles set onboarding_completed_at = now() where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select tests.authenticate_as('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

with updated as (
  update public.profiles set full_name = 'Changed' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1
)
select is(count(*)::integer, 0, 'after completion, a direct update affects no rows') from updated;
select results_eq('select id from public.profiles', array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid],
  'Ana still sees her own profile after completion');

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------
select tests.authenticate_as_anon();
select throws_ok('select * from public.profiles', '42501', 'permission denied for table profiles', 'anon cannot read profiles');

-- ---------------------------------------------------------------------------
-- Effects, checked as the owner
-- ---------------------------------------------------------------------------
select tests.clear_authentication();
select is((select full_name from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), null,
  'Ben''s profile is unchanged');
select is((select full_name from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'Ana',
  'Ana''s locked profile is unchanged');

delete from auth.users where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select is((select count(*)::integer from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0,
  'deleting the auth user deletes the profile');

select * from finish();
rollback;
