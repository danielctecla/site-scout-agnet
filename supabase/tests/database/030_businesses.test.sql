-- TASK-007: businesses table, RLS and privileges (database.md §3.2, §3.3, §4, §8.3).
begin;
\ir ../helpers/setup.psql

select plan(57);

-- Fixtures: Ana and Ben (the trigger creates their profiles), one business each.
select tests.create_user('ana@example.com', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select tests.create_user('ben@example.com', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select tests.create_user('cal@example.com', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
insert into public.businesses (user_id, name, industry, status) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Café Ana', 'food_beverage', 'planning'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Ben Tech', 'technology_electronics', 'active');

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------
select has_table('public', 'businesses', 'businesses exists');
select columns_are('public', 'businesses',
  array['id', 'user_id', 'name', 'industry', 'status', 'created_at', 'updated_at'],
  'businesses has exactly the documented columns');
select col_is_pk('public', 'businesses', 'id', 'id is the primary key');
select col_default_is('public', 'businesses', 'id', 'gen_random_uuid()', 'id defaults to gen_random_uuid()');
select col_is_unique('public', 'businesses', 'user_id', 'user_id is unique');
select fk_ok('public', 'businesses', 'user_id', 'public', 'profiles', 'id', 'user_id references profiles');
select col_not_null('public', 'businesses', 'user_id', 'user_id is not null');
select col_not_null('public', 'businesses', 'name', 'name is not null');
select col_not_null('public', 'businesses', 'industry', 'industry is not null');
select col_not_null('public', 'businesses', 'status', 'status is not null');
select col_not_null('public', 'businesses', 'created_at', 'created_at is not null');
select col_not_null('public', 'businesses', 'updated_at', 'updated_at is not null');
select is(
  (select array_agg(conname::text order by conname) from pg_constraint where conrelid = 'public.businesses'::regclass),
  array['businesses_industry_check', 'businesses_name_check', 'businesses_pkey', 'businesses_status_check',
        'businesses_user_id_fkey', 'businesses_user_id_key'],
  'businesses has exactly the documented named constraints'
);
select isnt((select id from public.businesses where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), null,
  'a business receives a generated id');

-- ---------------------------------------------------------------------------
-- Constraints, as the table owner
-- ---------------------------------------------------------------------------
select throws_ok($$insert into public.businesses (user_id, name, industry, status)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Second', 'retail', 'active')$$,
  '23505', 'duplicate key value violates unique constraint "businesses_user_id_key"', 'a user cannot have a second business');
select throws_ok($$insert into public.businesses (user_id, name, industry, status)
  values (gen_random_uuid(), 'Orphan', 'retail', 'active')$$,
  '23503', 'insert or update on table "businesses" violates foreign key constraint "businesses_user_id_fkey"',
  'a business requires an existing profile');
select throws_ok($$insert into public.businesses (user_id, name, industry, status)
  values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', null, 'retail', 'active')$$,
  '23502', null, 'a business requires a name');

-- Name
select lives_ok($$update public.businesses set name = 'A' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'a 1-character name is accepted');
select lives_ok($$update public.businesses set name = repeat('x', 120) where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'a 120-character name is accepted');
select lives_ok($$update public.businesses set name = 'Café  de Ana' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'internal whitespace is preserved');
select throws_ok($$update public.businesses set name = repeat('x', 121) where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', 'new row for relation "businesses" violates check constraint "businesses_name_check"', 'a 121-character name is rejected');
select throws_ok($$update public.businesses set name = '' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', 'new row for relation "businesses" violates check constraint "businesses_name_check"', 'an empty name is rejected');
select throws_ok($$update public.businesses set name = '   ' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', 'new row for relation "businesses" violates check constraint "businesses_name_check"', 'a whitespace-only name is rejected');
select throws_ok($$update public.businesses set name = ' Café' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', 'new row for relation "businesses" violates check constraint "businesses_name_check"', 'a name with leading whitespace is rejected');
select throws_ok($$update public.businesses set name = E'Café\t' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', 'new row for relation "businesses" violates check constraint "businesses_name_check"', 'a name with a trailing tab is rejected');

-- Industry: every supported code (database.md §4) is accepted; anything else is rejected.
select lives_ok(
  format($$update public.businesses set industry = %L where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, code),
  format('industry %s is accepted', code)
)
from unnest(array[
  'food_beverage', 'clothing_accessories', 'technology_electronics', 'beauty_personal_care', 'health',
  'education', 'professional_services', 'construction_maintenance', 'retail', 'other'
]) as code;
select throws_ok($$update public.businesses set industry = 'restaurants' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', 'new row for relation "businesses" violates check constraint "businesses_industry_check"', 'an unknown industry is rejected');
select throws_ok($$update public.businesses set industry = 'Retail' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', 'new row for relation "businesses" violates check constraint "businesses_industry_check"',
  'industry codes are case-sensitive');

-- Status
select lives_ok($$update public.businesses set status = 'active' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, 'status active is accepted');
select lives_ok($$update public.businesses set status = 'planning' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, 'status planning is accepted');
select throws_ok($$update public.businesses set status = 'closed' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', 'new row for relation "businesses" violates check constraint "businesses_status_check"', 'an unknown status is rejected');
select throws_ok($$update public.businesses set status = 'Active' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514', 'new row for relation "businesses" violates check constraint "businesses_status_check"', 'statuses are case-sensitive');

-- ---------------------------------------------------------------------------
-- RLS and privileges
-- ---------------------------------------------------------------------------
select is((select relrowsecurity from pg_class where oid = 'public.businesses'::regclass), true, 'RLS is enabled');
select policies_are('public', 'businesses', array['businesses_select_own'], 'businesses has exactly the documented policy');
select policy_cmd_is('public', 'businesses', 'businesses_select_own', 'select', 'businesses_select_own is a SELECT policy');
select policy_roles_are('public', 'businesses', 'businesses_select_own', array['authenticated'],
  'businesses_select_own applies to authenticated');
select table_privs_are('public', 'businesses', 'anon', array[]::text[], 'anon has no table privileges');
select table_privs_are('public', 'businesses', 'authenticated', array['SELECT'], 'authenticated can only SELECT');

-- updated_at trigger (no client update path exists, so it is tested as the owner)
select trigger_is('public', 'businesses', 'businesses_set_updated_at', 'public', 'handle_updated_at',
  'businesses_set_updated_at calls handle_updated_at');
alter table public.businesses disable trigger businesses_set_updated_at;
update public.businesses set updated_at = '2000-01-01' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
alter table public.businesses enable trigger businesses_set_updated_at;
update public.businesses set name = 'Café Ana' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is((select updated_at from public.businesses where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), now(),
  'the trigger sets updated_at on update');

-- ---------------------------------------------------------------------------
-- Client access, as Ana
-- ---------------------------------------------------------------------------
select tests.authenticate_as('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select results_eq('select name from public.businesses', array['Café Ana'], 'Ana sees only her own business');
select throws_ok($$insert into public.businesses (user_id, name, industry, status)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Direct', 'retail', 'active')$$,
  '42501', 'permission denied for table businesses', 'Ana cannot insert a business directly');
select throws_ok($$update public.businesses set status = 'active' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '42501', 'permission denied for table businesses', 'Ana cannot update her business');
select throws_ok($$delete from public.businesses where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '42501', 'permission denied for table businesses', 'Ana cannot delete her business');

select tests.authenticate_as('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
select is_empty('select * from public.businesses', 'a user without a business sees none');

select tests.authenticate_as_anon();
select throws_ok('select * from public.businesses', '42501', 'permission denied for table businesses', 'anon cannot read businesses');

-- ---------------------------------------------------------------------------
-- Cascade from auth.users through profiles
-- ---------------------------------------------------------------------------
select tests.clear_authentication();
delete from auth.users where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select is((select count(*)::integer from public.businesses where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0,
  'deleting the auth user deletes the business');
select is((select count(*)::integer from public.businesses where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1,
  'other businesses are untouched');

select * from finish();
rollback;
