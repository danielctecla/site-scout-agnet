-- Smoke test for the database test harness (TASK-003): pgTAP runs, and the
-- helpers create users and impersonate `authenticated` and `anon`.
begin;
\ir ../helpers/setup.psql

select plan(9);

select tests.create_user('harness@example.com') as user_id \gset

select ok(
  exists (select 1 from auth.users where id = :'user_id' and email = 'harness@example.com'),
  'tests.create_user inserts an auth user'
);

select is(current_user::text, 'postgres', 'tests start as postgres');
select is(auth.uid(), null, 'no user before authenticating');

select tests.authenticate_as(:'user_id');
select is(current_user::text, 'authenticated', 'authenticate_as switches to the authenticated role');
select is(auth.uid(), :'user_id'::uuid, 'auth.uid() returns the impersonated user');

select tests.authenticate_as_anon();
select is(current_user::text, 'anon', 'authenticate_as_anon switches to the anon role');
select is(auth.uid(), null, 'anon has no user');

select tests.clear_authentication();
select is(current_user::text, 'postgres', 'clear_authentication returns to postgres');
select is(auth.uid(), null, 'clear_authentication removes the JWT claims');

select * from finish();
rollback;
