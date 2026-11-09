-- TASK-009: finish_onboarding (database.md §7.1, §7.4, §7.5, §8.4, §8.5).
-- Concurrency is covered by an integration test against the local stack.
begin;
\ir ../helpers/setup.psql

select plan(43);

-- Fixtures (the trigger creates the profiles):
--   Ana, Ben: personal information saved, onboarding incomplete.
--   Cal: personal information missing.
--   Dan: personal information saved, but a business already exists (an
--        inconsistent state that only the owner can create).
select tests.create_user('ana@example.com', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select tests.create_user('ben@example.com', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select tests.create_user('cal@example.com', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
select tests.create_user('dan@example.com', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
update public.profiles set full_name = 'Ana', birth_date = '1996-01-01' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update public.profiles set full_name = 'Ben', birth_date = '1986-01-01' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
update public.profiles set full_name = 'Dan', birth_date = '1976-01-01' where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
insert into public.businesses (user_id, name, industry, status)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Dan Existing', 'retail', 'active');

-- ---------------------------------------------------------------------------
-- Definition and privileges
-- ---------------------------------------------------------------------------
select function_returns('public', 'finish_onboarding', array['text', 'text', 'text'], 'uuid',
  'finish_onboarding(text, text, text) returns uuid');
select is(pg_get_function_identity_arguments('public.finish_onboarding(text, text, text)'::regprocedure),
  'p_business_name text, p_industry text, p_status text', 'the function takes no user id parameter');
select is((select prosecdef from pg_proc where oid = 'public.finish_onboarding(text, text, text)'::regprocedure), true,
  'finish_onboarding is SECURITY DEFINER');
select is((select proconfig from pg_proc where oid = 'public.finish_onboarding(text, text, text)'::regprocedure),
  array['search_path=""'], 'finish_onboarding sets an empty search_path');
select is((select proowner::regrole::text from pg_proc where oid = 'public.finish_onboarding(text, text, text)'::regprocedure),
  'postgres', 'finish_onboarding is owned by postgres');
select ok(not has_function_privilege('public', 'public.finish_onboarding(text, text, text)', 'EXECUTE'),
  'PUBLIC cannot execute finish_onboarding');
select ok(not has_function_privilege('anon', 'public.finish_onboarding(text, text, text)', 'EXECUTE'),
  'anon cannot execute finish_onboarding');
select ok(has_function_privilege('authenticated', 'public.finish_onboarding(text, text, text)', 'EXECUTE'),
  'authenticated can execute finish_onboarding');
select ok(
  not exists (
    select 1
    from unnest(array[
      'food_beverage', 'clothing_accessories', 'technology_electronics', 'beauty_personal_care', 'health',
      'education', 'professional_services', 'construction_maintenance', 'retail', 'other'
    ]) as code
    where (select prosrc from pg_proc where oid = 'public.finish_onboarding(text, text, text)'::regprocedure) like '%' || code || '%'
  ),
  'the industry list does not appear in the function body'
);

-- Exactly two SECURITY DEFINER functions exist in public (database.md §8.5).
select is(
  (select array_agg(proname::text order by proname) from pg_proc where pronamespace = 'public'::regnamespace and prosecdef),
  array['finish_onboarding', 'handle_new_user'],
  'the only SECURITY DEFINER functions are finish_onboarding and handle_new_user'
);

-- ---------------------------------------------------------------------------
-- Invalid input, as Ben: contract codes, nothing persisted
-- ---------------------------------------------------------------------------
select tests.authenticate_as('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

select throws_ok($$select public.finish_onboarding(null, 'retail', 'active')$$, 'P0001', 'invalid_business_name',
  'a NULL business name raises invalid_business_name');
select throws_ok($$select public.finish_onboarding('', 'retail', 'active')$$, 'P0001', 'invalid_business_name',
  'an empty business name raises invalid_business_name');
select throws_ok($$select public.finish_onboarding('   ', 'retail', 'active')$$, 'P0001', 'invalid_business_name',
  'a whitespace-only business name raises invalid_business_name');
select throws_ok($$select public.finish_onboarding(repeat('x', 121), 'retail', 'active')$$, 'P0001', 'invalid_business_name',
  'a 121-character business name raises invalid_business_name');
select throws_ok($$select public.finish_onboarding('Ben Tech', null, 'active')$$, 'P0001', 'invalid_industry',
  'a NULL industry raises invalid_industry');
select throws_ok($$select public.finish_onboarding('Ben Tech', 'restaurants', 'active')$$, 'P0001', 'invalid_industry',
  'an unknown industry raises invalid_industry');
select throws_ok($$select public.finish_onboarding('Ben Tech', 'retail', null)$$, 'P0001', 'invalid_status',
  'a NULL status raises invalid_status');
select throws_ok($$select public.finish_onboarding('Ben Tech', 'retail', 'closed')$$, 'P0001', 'invalid_status',
  'an unknown status raises invalid_status');
select throws_ok($$select public.finish_onboarding('Ben Tech', 'retail', 'Active')$$, 'P0001', 'invalid_status',
  'statuses are case-sensitive');

select is_empty('select * from public.businesses', 'failed calls create no business');
select is((select onboarding_completed_at from public.profiles), null, 'failed calls leave onboarding incomplete');

-- ---------------------------------------------------------------------------
-- Success: planning (Ana) and active (Ben)
-- ---------------------------------------------------------------------------
select tests.authenticate_as('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.finish_onboarding(E'  Café  de Ana \n', 'food_beverage', 'planning') as ana_business_id \gset

select is((select id from public.businesses), :'ana_business_id'::uuid, 'the function returns the new business id');
select is((select array[name, industry, status] from public.businesses),
  array['Café  de Ana', 'food_beverage', 'planning'],
  'the business is stored with the trimmed name and the status sent by the client');
select is((select onboarding_completed_at from public.profiles), now(), 'onboarding is marked as completed');
select is((select created_at from public.businesses), (select onboarding_completed_at from public.profiles),
  'the business and the completion share the same timestamp');

select throws_ok($$select public.finish_onboarding('Another', 'retail', 'active')$$, 'P0001', 'onboarding_already_completed',
  'a repeated call raises onboarding_already_completed');
select throws_ok($$select public.finish_onboarding('Another', 'not_an_industry', 'active')$$, 'P0001', 'onboarding_already_completed',
  'profile state is checked before business content');
select throws_ok($$select public.save_personal_information('Changed', '1990-01-01')$$, 'P0001', 'onboarding_already_completed',
  'personal information is locked after completion');

select tests.authenticate_as('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select lives_ok($$select public.finish_onboarding('Ben Tech', 'technology_electronics', 'active')$$,
  'a business with status active can be created');
select is((select array[name, status] from public.businesses), array['Ben Tech', 'active'],
  'Ben sees only his own business, with status active');

-- ---------------------------------------------------------------------------
-- Profile state
-- ---------------------------------------------------------------------------
select tests.authenticate_as('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
select throws_ok($$select public.finish_onboarding('Cal Shop', 'retail', 'active')$$, 'P0001', 'personal_info_incomplete',
  'missing personal information raises personal_info_incomplete');
select throws_ok($$select public.finish_onboarding(null, 'retail', 'active')$$, 'P0001', 'invalid_business_name',
  'missing arguments are checked before profile state');

select tests.authenticate_as('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
select throws_ok($$select public.finish_onboarding('Dan Second', 'retail', 'active')$$, 'P0001', 'business_already_exists',
  'an existing business raises business_already_exists');

select tests.authenticate_as('ffffffff-ffff-4fff-8fff-ffffffffffff');
select throws_ok($$select public.finish_onboarding('Nobody', 'retail', 'active')$$, 'P0001', 'profile_not_found',
  'a caller without a profile receives profile_not_found');

select tests.authenticate_as(null);
select throws_ok($$select public.finish_onboarding('Nobody', 'retail', 'active')$$, 'P0001', 'not_authenticated',
  'a call without a user raises not_authenticated');
select throws_ok($$select public.finish_onboarding(null, null, null)$$, 'P0001', 'not_authenticated',
  'authentication is checked first');

select tests.authenticate_as_anon();
select throws_ok($$select public.finish_onboarding('Anon', 'retail', 'active')$$, '42501',
  'permission denied for function finish_onboarding', 'anon cannot execute the function');

-- ---------------------------------------------------------------------------
-- Effects, checked as the owner
-- ---------------------------------------------------------------------------
select tests.clear_authentication();
select is((select count(*)::integer from public.businesses where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1,
  'Ana has exactly one business after the repeated call');
select is((select onboarding_completed_at from public.profiles where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'), null,
  'Cal''s onboarding stays incomplete');
select is_empty($$select 1 from public.businesses where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'$$,
  'Cal has no business');
select is((select onboarding_completed_at from public.profiles where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), null,
  'the failed call rolled back Dan''s completion');
select is((select array_agg(name) from public.businesses where user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  array['Dan Existing'], 'Dan still has only the original business');
select is((select count(*)::integer from public.businesses where user_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'), 0,
  'no business was created for an identity without a profile');

select * from finish();
rollback;
