-- TASK-008: save_personal_information (database.md §7.1, §7.2 Path A, §7.3, §7.5, §8.4).
begin;
\ir ../helpers/setup.psql

select plan(33);

select tests.create_user('ana@example.com', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select tests.create_user('ben@example.com', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
-- Ben has completed onboarding.
update public.profiles set full_name = 'Ben', birth_date = '1986-02-01', onboarding_completed_at = now()
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

-- ---------------------------------------------------------------------------
-- Definition and privileges
-- ---------------------------------------------------------------------------
select function_returns('public', 'save_personal_information', array['text', 'date'], 'void',
  'save_personal_information(text, date) returns void');
select is(pg_get_function_identity_arguments('public.save_personal_information(text, date)'::regprocedure),
  'p_full_name text, p_birth_date date', 'the function takes no user id parameter');
select is((select prosecdef from pg_proc where oid = 'public.save_personal_information(text, date)'::regprocedure), false,
  'save_personal_information is SECURITY INVOKER');
select is((select proconfig from pg_proc where oid = 'public.save_personal_information(text, date)'::regprocedure),
  array['search_path=""'], 'save_personal_information sets an empty search_path');
select ok(not has_function_privilege('public', 'public.save_personal_information(text, date)', 'EXECUTE'),
  'PUBLIC cannot execute save_personal_information');
select ok(not has_function_privilege('anon', 'public.save_personal_information(text, date)', 'EXECUTE'),
  'anon cannot execute save_personal_information');
select ok(has_function_privilege('authenticated', 'public.save_personal_information(text, date)', 'EXECUTE'),
  'authenticated can execute save_personal_information');

-- ---------------------------------------------------------------------------
-- Valid saves, as Ana
-- ---------------------------------------------------------------------------
select tests.authenticate_as('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

select lives_ok($$select public.save_personal_information(E'  Ana María \t', '1990-05-14')$$, 'a valid save succeeds');
select is((select array[full_name, birth_date::text] from public.profiles), array['Ana María', '1990-05-14'],
  'the name is stored trimmed, with internal whitespace preserved');
select lives_ok($$select public.save_personal_information('Ana María', '1990-05-14')$$, 'repeating the same save succeeds');
select is((select array[full_name, birth_date::text] from public.profiles), array['Ana María', '1990-05-14'],
  'repeating the same save leaves the same state');

select lives_ok($$select public.save_personal_information('A', (current_date - interval '16 years')::date)$$,
  'a 1-character name and a date of birth giving age 16 today are accepted');
select lives_ok($$select public.save_personal_information(repeat('x', 100), (current_date - interval '101 years' + interval '1 day')::date)$$,
  'a 100-character name and a date of birth giving age 100 today are accepted');
select is((select char_length(full_name) from public.profiles), 100, 'the 100-character name is stored');

-- ---------------------------------------------------------------------------
-- Invalid input: contract codes, nothing written
-- ---------------------------------------------------------------------------
select lives_ok($$select public.save_personal_information('Ana', '1990-05-14')$$, 'reset to a known state');

select throws_ok($$select public.save_personal_information(null, '1990-05-14')$$, 'P0001', 'invalid_full_name', 'a NULL name raises invalid_full_name');
select throws_ok($$select public.save_personal_information('', '1990-05-14')$$, 'P0001', 'invalid_full_name', 'an empty name raises invalid_full_name');
select throws_ok($$select public.save_personal_information('   ', '1990-05-14')$$, 'P0001', 'invalid_full_name',
  'a whitespace-only name raises invalid_full_name');
select throws_ok($$select public.save_personal_information(repeat('x', 101), '1990-05-14')$$, 'P0001', 'invalid_full_name',
  'a 101-character name raises invalid_full_name');
select throws_ok($$select public.save_personal_information('Ana', null)$$, 'P0001', 'invalid_birth_date', 'a NULL date of birth raises invalid_birth_date');
select throws_ok($$select public.save_personal_information('Ana', (current_date - interval '16 years' + interval '1 day')::date)$$, 'P0001', 'invalid_birth_date',
  'a date of birth giving age 15 today raises invalid_birth_date');
select throws_ok($$select public.save_personal_information('Ana', (current_date - interval '101 years')::date)$$, 'P0001', 'invalid_birth_date',
  'a date of birth giving age 101 today raises invalid_birth_date');
select is((select array[full_name, birth_date::text] from public.profiles), array['Ana', '1990-05-14'], 'failed saves change nothing');
select is((select onboarding_completed_at from public.profiles), null, 'the function never sets onboarding_completed_at');

-- ---------------------------------------------------------------------------
-- Profile state
-- ---------------------------------------------------------------------------
select tests.authenticate_as('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select throws_ok($$select public.save_personal_information('Benjamin', '1985-01-01')$$, 'P0001', 'onboarding_already_completed',
  'after completion the call raises onboarding_already_completed');

-- A signed-in identity without a profile.
select tests.authenticate_as('ffffffff-ffff-4fff-8fff-ffffffffffff');
select throws_ok($$select public.save_personal_information('Nobody', '1990-05-14')$$, 'P0001', 'profile_not_found',
  'a caller without a profile receives profile_not_found');

-- The authenticated role without a user in the request context.
select tests.authenticate_as(null);
select throws_ok($$select public.save_personal_information('Nobody', '1990-05-14')$$, 'P0001', 'not_authenticated',
  'a call without a user raises not_authenticated');

select tests.authenticate_as_anon();
select throws_ok($$select public.save_personal_information('Ana', '1990-05-14')$$, '42501',
  'permission denied for function save_personal_information', 'anon cannot execute the function');

-- ---------------------------------------------------------------------------
-- Effects, checked as the owner
-- ---------------------------------------------------------------------------
select tests.clear_authentication();
select is((select array[full_name, birth_date::text] from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  array['Ben', '1986-02-01'], 'Ben''s completed profile is unchanged');
select is((select array[full_name, birth_date::text] from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  array['Ana', '1990-05-14'], 'Ana''s profile holds her last valid save');

-- Ana's saves never touch Ben's row: backdate Ben's updated_at (trigger off),
-- save as Ana, and check that it did not move.
alter table public.profiles disable trigger profiles_set_updated_at;
update public.profiles set updated_at = '2000-01-01' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
alter table public.profiles enable trigger profiles_set_updated_at;
select tests.authenticate_as('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select lives_ok($$select public.save_personal_information('Ana', '1990-05-15')$$, 'Ana saves again');
select tests.clear_authentication();
select is((select updated_at from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), '2000-01-01'::timestamptz,
  'Ana''s save does not write Ben''s row');
select is((select birth_date from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), '1990-05-15'::date, 'Ana''s save is stored on her row');

select * from finish();
rollback;
