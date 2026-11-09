-- TASK-027: location_evaluations, RLS and privileges (database.md §13).
begin;
\ir ../helpers/setup.psql

select plan(10);

select tests.create_user('ana@example.com', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select tests.create_user('ben@example.com', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

-- Ana stores an evaluation through her own session; user_id comes from auth.uid().
select tests.authenticate_as('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select lives_ok($$insert into public.location_evaluations (input, result) values ('{"a":1}', '{"zones":[]}')$$,
  'a user stores an evaluation');
select results_eq('select user_id from public.location_evaluations',
  array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid], 'the evaluation belongs to its author');
select throws_ok($$insert into public.location_evaluations (user_id, input, result)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '{}', '{}')$$,
  '42501', null, 'a user cannot store an evaluation for someone else');
select throws_ok($$insert into public.location_evaluations (input, result) values ('[]', '{}')$$,
  '23514', null, 'input must be an object');
select throws_ok($$update public.location_evaluations set result = '{}'$$, '42501', null, 'evaluations cannot be updated');
select throws_ok($$delete from public.location_evaluations$$, '42501', null, 'evaluations cannot be deleted');

-- Ben sees nothing of Ana's.
select tests.authenticate_as('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select is_empty('select * from public.location_evaluations', 'a user cannot read another user''s evaluations');

select tests.authenticate_as_anon();
select throws_ok('select * from public.location_evaluations', '42501', null, 'anon cannot read evaluations');
select throws_ok($$insert into public.location_evaluations (input, result) values ('{}', '{}')$$,
  '42501', null, 'anon cannot store evaluations');

-- Deleting the Auth user deletes the evaluations.
select tests.clear_authentication();
delete from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is_empty('select * from public.location_evaluations', 'evaluations are deleted with their user');

select * from finish();
rollback;
