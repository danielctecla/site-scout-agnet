-- TASK-010: consolidated security model (database.md §5, §8).
--
-- Coverage of the database.md §5 enforcement table:
--   1  profiles_id_fkey ............................ 010 (fk_ok), 020 (cascade)
--   2  profiles_pkey ............................... 020 (duplicate profile)
--   3  businesses_user_id_key ...................... 030, 050 (business_already_exists)
--   4  businesses_user_id_fkey ..................... 030 (orphan business)
--   5  ON DELETE CASCADE ........................... 010, 020, 030
--   6  profiles_full_name_check .................... 010, 040
--   7  profiles_validate_birth_date trigger ........ 010, 040
--   8  profiles_completion_requires_personal_info .. 010, 050 (personal_info_incomplete)
--   9  businesses_name_check ....................... 030, 050
--   10 businesses_industry_check ................... 030, 050
--   11 businesses_status_check ..................... 030, 050
--   12 privileges .................................. 010, 030, this file
--   13 profiles_update_own_before_completion ....... 010, 040, 050
--   14 atomic finish_onboarding .................... 050 (rollback), concurrency integration test
--   15 finish_onboarding is the only business path . 030, this file
--   16 updated_at triggers ......................... 010, 030
begin;
\ir ../helpers/setup.psql

select plan(26);

-- Ana and Ben complete onboarding through the application path.
select tests.create_user('ana@example.com', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select tests.create_user('ben@example.com', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select tests.authenticate_as('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.save_personal_information('Ana', '1990-05-14');
select public.finish_onboarding('Café Ana', 'food_beverage', 'planning');
select tests.authenticate_as('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select public.save_personal_information('Ben', '1986-02-01');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------
-- Privilege catalog
-- ---------------------------------------------------------------------------
select tables_are('public', array['businesses', 'location_evaluations', 'profiles'], 'public contains only the application tables');
select functions_are('public',
  array['finish_onboarding', 'handle_new_user', 'handle_updated_at', 'save_personal_information', 'validate_profile_birth_date'],
  'public contains only the documented functions');

select is_empty($$
  select c.relname, p.priv
  from pg_class c
  cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p (priv)
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and has_table_privilege('anon', c.oid, p.priv)
$$, 'anon has no table privileges in public');
select is_empty($$
  select c.relname, p.priv
  from pg_class c
  cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']) as p (priv)
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and has_any_column_privilege('anon', c.oid, p.priv)
$$, 'anon has no column privileges in public');
select is_empty($$
  select p.oid::regprocedure from pg_proc p
  where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'EXECUTE')
$$, 'anon cannot execute any function in public');

select results_eq($$
  select c.relname::text collate "default", p.priv
  from pg_class c
  cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p (priv)
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and has_table_privilege('authenticated', c.oid, p.priv)
  order by 1, 2
$$, $$values ('businesses', 'SELECT'), ('location_evaluations', 'SELECT'), ('profiles', 'SELECT')$$,
  'authenticated has only SELECT on the application tables');
select results_eq($$
  select c.relname::text collate "default", a.attname::text collate "default", p.priv
  from pg_class c
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  cross join unnest(array['INSERT', 'UPDATE', 'REFERENCES']) as p (priv)
  where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
    and has_column_privilege('authenticated', c.oid, a.attnum, p.priv)
  order by 1, 2, 3
$$, $$values ('location_evaluations', 'input', 'INSERT'), ('location_evaluations', 'result', 'INSERT'),
         ('profiles', 'birth_date', 'UPDATE'), ('profiles', 'full_name', 'UPDATE')$$,
  'authenticated can write only profiles.full_name, profiles.birth_date and new evaluations');
select results_eq($$
  select p.proname::text collate "default" from pg_proc p
  where p.pronamespace = 'public'::regnamespace and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  order by 1
$$, $$values ('finish_onboarding'), ('save_personal_information')$$,
  'authenticated can execute only the two RPC functions');

select is_empty($$
  select p.oid::regprocedure from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proconfig is distinct from array['search_path=""']
$$, 'every function in public sets an empty search_path');
select is_empty($$
  select c.relname from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity
$$, 'every table in public has RLS enabled');

-- ---------------------------------------------------------------------------
-- Isolation, as Ana (completed) and Ben (incomplete)
-- ---------------------------------------------------------------------------
select tests.authenticate_as('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select results_eq('select id from public.profiles', array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid], 'Ana reads only her profile');
select results_eq('select user_id from public.businesses', array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid], 'Ana reads only her business');
with updated as (
  update public.profiles set full_name = 'Hacked' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' returning 1
)
select is(count(*)::integer, 0, 'Ana cannot update Ben''s profile') from updated;
select throws_ok($$insert into public.businesses (user_id, name, industry, status)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'For Ben', 'retail', 'active')$$,
  '42501', null, 'Ana cannot create a business for Ben');
select throws_ok($$delete from public.businesses$$, '42501', null, 'Ana cannot delete businesses');
select throws_ok($$delete from public.profiles$$, '42501', null, 'Ana cannot delete profiles');

select tests.authenticate_as('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select is_empty('select * from public.businesses', 'Ben, without a business, cannot see Ana''s');
select lives_ok($$select public.finish_onboarding('Ben Tech', 'retail', 'active')$$, 'Ben completes his own onboarding');
select results_eq('select name from public.businesses', array['Ben Tech'], 'Ben''s call created only his own business');

-- ---------------------------------------------------------------------------
-- anon, across all tables and functions
-- ---------------------------------------------------------------------------
select tests.authenticate_as_anon();
select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select * from public.businesses', '42501', null, 'anon cannot read businesses');
select throws_ok($$update public.profiles set full_name = 'x'$$, '42501', null, 'anon cannot update profiles');
select throws_ok($$insert into public.businesses (user_id, name, industry, status)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'x', 'retail', 'active')$$, '42501', null, 'anon cannot insert businesses');
select throws_ok($$select public.save_personal_information('x', '1990-05-14')$$, '42501', null, 'anon cannot call save_personal_information');
select throws_ok($$select public.finish_onboarding('x', 'retail', 'active')$$, '42501', null, 'anon cannot call finish_onboarding');

-- ---------------------------------------------------------------------------
-- Effects, checked as the owner
-- ---------------------------------------------------------------------------
select tests.clear_authentication();
select is((select full_name from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'Ben', 'Ben''s profile was not modified by Ana');

select * from finish();
rollback;
