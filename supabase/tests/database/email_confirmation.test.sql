-- Tests for 20261110000100_password_auth_email_confirmation.sql.
-- Run with `supabase test db`.
--
-- Everything happens inside one transaction that is rolled back. To act as a
-- user, a test sets the JWT claims (what auth.uid()/auth.jwt() read) and, for
-- calls that go through the API, switches to the `authenticated` role. The
-- private.* functions are called without the role switch because the API roles
-- can't reach the private schema.

begin;
select plan(57);

-- ------------------------------------------------------------------- setup

create schema tests;
grant usage on schema tests to public; -- helpers are called while acting as API roles

/** Sign in as this user: sets the JWT claims, back at the superuser role. */
create function tests.claims(uid uuid, mail text, sid uuid) returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'email', mail, 'session_id', sid)::text, true);
end $$;

/** Signed out: no claims at all. */
create function tests.signed_out() returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

/** Who the people are. Passwords are irrelevant until a test replaces them. */
create function tests.make_user(uid uuid, mail text) returns void
language sql as $$
  insert into auth.users (id, email, encrypted_password)
  values (uid, mail, extensions.crypt('old password', extensions.gen_salt('bf')));
  insert into auth.sessions (id, user_id) values (uid, uid); -- the session id equals the user id
$$;

-- Fixed ids keep the tests readable: the last digit tells the users apart.
create function tests.id(n int) returns uuid language sql immutable as
  $$ select ('00000000-0000-0000-0000-00000000000' || n)::uuid $$;

-- Family members are matched by email, so give each one an address.
update public.family set email = person || '@example.test';

select tests.make_user(tests.id(1), 'gabriel@example.test');   -- admin, unconfirmed
select tests.make_user(tests.id(2), 'micala@example.test');    -- admin, confirmed
select tests.make_user(tests.id(3), 'vincent@example.test');   -- elevated, confirmed (not an admin)
select tests.make_user(tests.id(4), 'confirmer@example.test'); -- guest who opens the link while signed in
select tests.make_user(tests.id(5), 'stale@example.test');     -- guest whose link is 8 days old
select tests.make_user(tests.id(6), 'resetter@example.test');  -- guest who chooses a password from the link
select tests.make_user(tests.id(7), 'newbie@example.test');    -- unconfirmed guest
select tests.make_user(tests.id(8), 'mover@example.test');     -- confirmed guest who changes email
select tests.make_user(tests.id(9), 'sender@example.test');    -- unconfirmed guest asking for a new link
update private.email_confirmations set confirmed_at = now()
where user_id in (tests.id(2), tests.id(3), tests.id(8));

-- The links as first sent, for tests that need to open them.
create temp table tok as
select user_id, token from private.email_confirmations;
grant select on tok to public;

-- ------------------------------------------- unconfirmed family members

select tests.claims(tests.id(1), 'gabriel@example.test', tests.id(1));
select is(private.is_family(), false, 'an unconfirmed family member is not family');

select tests.claims(tests.id(2), 'micala@example.test', tests.id(2));
select is(private.is_family(), true, 'a confirmed family member is family');

select tests.claims(tests.id(1), 'gabriel@example.test', tests.id(1));
set local role authenticated;
select is(public.my_family_status() ->> 'confirmed', 'false', 'my_family_status says the email is not confirmed');
select is(public.my_family_status() ->> 'person', 'gabriel', 'my_family_status still says who they are, so the site can ask them to confirm');

select tests.claims(tests.id(2), 'micala@example.test', tests.id(2));
set local role authenticated;
select is(public.my_family_status() ->> 'confirmed', 'true', 'my_family_status says a confirmed member is confirmed');

select tests.claims(tests.id(1), 'gabriel@example.test', tests.id(1));
select throws_ok(
  $$ select private.require_family() $$, 'P0001',
  'Please confirm your email first. We sent you a link.',
  'require_family tells an unconfirmed family member to confirm');

select tests.claims(tests.id(4), 'confirmer@example.test', tests.id(4));
select throws_ok(
  $$ select private.require_family() $$, '42501', 'Family sign-in required',
  'require_family still refuses non-family accounts the plain way');

-- ------------------------------------------------------------ confirm_email

select tests.signed_out();
set local role anon;
select is(public.confirm_email('not-a-real-token'), 'invalid', 'a bad token is invalid');
select is(public.confirm_email(''), 'invalid', 'an empty token is invalid');

select is(
  public.confirm_email((select token from tok where user_id = tests.id(4))),
  'password_needed', 'signed out, a valid link needs a password');

select tests.claims(tests.id(3), 'vincent@example.test', tests.id(3));
set local role authenticated;
select is(
  public.confirm_email((select token from tok where user_id = tests.id(4))),
  'password_needed', 'signed in as someone else, a valid link needs a password');

select is(
  public.confirm_email((select token from tok where user_id = tests.id(2))),
  'confirmed', 'a link that was already used reports confirmed');

reset role;
select is(
  (select confirmed_at is null from private.email_confirmations where user_id = tests.id(4)),
  true, 'neither of the earlier attempts confirmed the account');

select tests.claims(tests.id(4), 'confirmer@example.test', tests.id(4));
set local role authenticated;
select is(
  public.confirm_email((select token from tok where user_id = tests.id(4))),
  'confirmed', 'signed in as the account, the link confirms it');

reset role;
select isnt(
  (select confirmed_at from private.email_confirmations where user_id = tests.id(4)),
  null, 'the confirmation was recorded');

update private.email_confirmations set last_sent_at = now() - interval '8 days' where user_id = tests.id(5);
select tests.claims(tests.id(5), 'stale@example.test', tests.id(5));
set local role authenticated;
select is(
  public.confirm_email((select token from tok where user_id = tests.id(5))),
  'invalid', 'a link older than 7 days is invalid');

-- --------------------------------------------- confirm_email_with_password

reset role;
select tests.signed_out();
set local role anon;
select throws_ok(
  format($$ select public.confirm_email_with_password(%L, 'short') $$, (select token from tok where user_id = tests.id(6))),
  'P0001', 'Use at least 8 characters.', 'a password under 8 characters is refused');

select throws_ok(
  format($$ select public.confirm_email_with_password(%L, '') $$, (select token from tok where user_id = tests.id(6))),
  'P0001', 'Use at least 8 characters.', 'an empty password is refused');

select throws_ok(
  $$ select public.confirm_email_with_password('not-a-real-token', 'a long enough password') $$,
  'P0001', 'That link didn''t work. It may be old or already used.', 'a bad token is refused');

select throws_ok(
  format($$ select public.confirm_email_with_password(%L, 'a long enough password') $$, (select token from tok where user_id = tests.id(2))),
  'P0001', 'That link didn''t work. It may be old or already used.', 'a used link is refused');

select throws_ok(
  format($$ select public.confirm_email_with_password(%L, 'a long enough password') $$, (select token from tok where user_id = tests.id(5))),
  'P0001', 'That link didn''t work. It may be old or already used.', 'a link older than 7 days is refused');

reset role;
select is(
  (select count(*)::int from auth.users where id = tests.id(6)
     and encrypted_password = extensions.crypt('old password', encrypted_password)),
  1, 'the refused attempts left the old password in place');

-- A second session for the account being reset, and one for somebody else.
insert into auth.sessions (user_id) values (tests.id(6));

set local role anon;
select is(
  public.confirm_email_with_password((select token from tok where user_id = tests.id(6)), 'a brand new password'),
  'resetter@example.test', 'choosing a password returns the email so the site can sign in');

reset role;
select is(
  (select encrypted_password = extensions.crypt('a brand new password', encrypted_password)
   from auth.users where id = tests.id(6)),
  true, 'the new password is stored');
select is(
  (select encrypted_password = extensions.crypt('old password', encrypted_password)
   from auth.users where id = tests.id(6)),
  false, 'the old password no longer works');
select is(
  (select count(*)::int from auth.sessions where user_id = tests.id(6)),
  0, 'every session of that account was deleted');
select is(
  (select count(*)::int from auth.sessions where user_id = tests.id(3)),
  1, 'other people''s sessions are untouched');
select isnt(
  (select confirmed_at from private.email_confirmations where user_id = tests.id(6)),
  null, 'the account is confirmed');

set local role anon;
select throws_ok(
  format($$ select public.confirm_email_with_password(%L, 'yet another password') $$, (select token from tok where user_id = tests.id(6))),
  'P0001', 'That link didn''t work. It may be old or already used.', 'the link cannot be used a second time');

-- ------------------------------------------------------------- is_confirmed

reset role;
select tests.claims(tests.id(2), 'micala@example.test', tests.id(2));
select is(private.is_confirmed(), true, 'a live session of a confirmed account is confirmed');

select tests.claims(tests.id(2), 'micala@example.test', gen_random_uuid());
select is(private.is_confirmed(), false, 'a session_id that is not in auth.sessions is not confirmed');

select tests.claims(tests.id(2), 'MICALA@example.test', tests.id(2));
select is(private.is_confirmed(), true, 'the email in the token is compared in lower case');

select tests.claims(tests.id(2), 'someone-else@example.test', tests.id(2));
select is(private.is_confirmed(), false, 'a token for a different email than the confirmed one is not confirmed');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "email": "micala@example.test"}';
select is(private.is_confirmed(), false, 'a token with no session_id is not confirmed');

select tests.claims(tests.id(2), 'micala@example.test', tests.id(2));
delete from auth.sessions where id = tests.id(2);
select is(private.is_confirmed(), false, 'an access token stops working once its session is deleted');

-- --------------------------------------------------- changing the email

select tests.claims(tests.id(8), 'mover@example.test', tests.id(8));
select is(private.is_confirmed(), true, 'the mover starts out confirmed');

update auth.users set email = 'Mover@Example.test' where id = tests.id(8);
select is(
  (select confirmed_at is not null from private.email_confirmations where user_id = tests.id(8)),
  true, 'changing only the letter case of the email keeps it confirmed');

update auth.users set email = 'mover-new@example.test' where id = tests.id(8);
select is(
  (select confirmed_at is null from private.email_confirmations where user_id = tests.id(8)),
  true, 'changing the email resets confirmation');
select is(
  (select email from private.email_confirmations where user_id = tests.id(8)),
  'mover-new@example.test', 'the confirmation now belongs to the new address');
select isnt(
  (select token from private.email_confirmations where user_id = tests.id(8)),
  (select token from tok where user_id = tests.id(8)), 'the link for the old address is replaced');
select is(
  (select count(*)::int from public.outbox where template = 'email_confirmation' and to_email = 'mover-new@example.test'),
  1, 'a confirmation email was queued for the new address');
select tests.claims(tests.id(8), 'mover-new@example.test', tests.id(8));
select is(private.is_confirmed(), false, 'the account is not confirmed until the new link is used');

-- ---------------------------------------------------------- admin_accounts

select tests.claims(tests.id(3), 'vincent@example.test', tests.id(3));
set local role authenticated;
select throws_ok(
  $$ select * from public.admin_accounts() $$, '42501', 'Only Gabriel or Micala can do that',
  'a non-admin family member cannot list accounts');

select tests.claims(tests.id(1), 'gabriel@example.test', tests.id(1));
set local role authenticated;
select throws_ok(
  $$ select * from public.admin_accounts() $$, 'P0001', 'Please confirm your email first. We sent you a link.',
  'an unconfirmed admin cannot list accounts');

reset role;
insert into auth.sessions (id, user_id) values (tests.id(2), tests.id(2)); -- the one deleted above
select tests.claims(tests.id(2), 'micala@example.test', tests.id(2));
set local role authenticated;
select lives_ok($$ select * from public.admin_accounts() $$, 'a confirmed admin can list accounts');
select is(
  (select confirmed from public.admin_accounts() where email = 'micala@example.test'),
  true, 'the list shows confirmed accounts as confirmed');
select is(
  (select confirmed from public.admin_accounts() where email = 'gabriel@example.test'),
  false, 'the list shows unconfirmed accounts as unconfirmed');

-- ---------------------------------------------------------- guest profiles

reset role;
select tests.claims(tests.id(7), 'newbie@example.test', tests.id(7));
set local role authenticated;
select throws_ok(
  $$ insert into public.profiles (name) values ('Newbie') $$, '42501', null,
  'an unconfirmed guest cannot create a profile');

reset role;
insert into public.profiles (user_id, name) values (tests.id(7), 'Newbie');
select tests.claims(tests.id(7), 'newbie@example.test', tests.id(7));
set local role authenticated;
update public.profiles set name = 'Changed' where user_id = tests.id(7);
reset role;
select is(
  (select name from public.profiles where user_id = tests.id(7)),
  'Newbie', 'an unconfirmed guest cannot update their profile');

-- The mover confirmed their new address, so a profile is allowed again.
update private.email_confirmations set confirmed_at = now() where user_id = tests.id(8);
select tests.claims(tests.id(8), 'mover-new@example.test', tests.id(8));
set local role authenticated;
select lives_ok(
  $$ insert into public.profiles (name) values ('Mover') $$,
  'a confirmed guest can create a profile');

-- ------------------------------------------------------ resend_confirmation

reset role;
-- Brand new accounts were just sent a link, so asking again right away is too soon.
select tests.claims(tests.id(9), 'sender@example.test', tests.id(9));
set local role authenticated;
select throws_ok(
  $$ select public.resend_confirmation() $$, 'P0001',
  'We just sent a link. Please check your email, or try again in a minute.',
  'a second link within a minute is refused');

reset role;
update private.email_confirmations set last_sent_at = now() - interval '61 seconds' where user_id = tests.id(9);
create temp table before as select token from private.email_confirmations where user_id = tests.id(9);
grant select on before to public;
select tests.claims(tests.id(9), 'sender@example.test', tests.id(9));
set local role authenticated;
select lives_ok($$ select public.resend_confirmation() $$, 'a link can be sent again after a minute');

reset role;
select is(
  (select count(*)::int from public.outbox where template = 'email_confirmation' and to_email = 'sender@example.test'),
  2, 'the second email was queued');
select is(
  (select token from private.email_confirmations where user_id = tests.id(9)),
  (select token from before), 'the new email carries the same token as the first');

-- Five emails already queued today: no more, even though the last one was long ago.
insert into public.outbox (template, to_email, subject, body)
select 'email_confirmation', 'sender@example.test', 's', 'b' from generate_series(1, 3);
update private.email_confirmations set last_sent_at = now() - interval '2 minutes' where user_id = tests.id(9);
select tests.claims(tests.id(9), 'sender@example.test', tests.id(9));
set local role authenticated;
select throws_ok(
  $$ select public.resend_confirmation() $$, 'P0001',
  'We''ve sent a few links already today. Please check your email, including spam.',
  'five emails queued in the last day is the limit');

reset role;
update public.outbox set created_at = now() - interval '25 hours'
where to_email = 'sender@example.test' and id = (select min(id) from public.outbox where to_email = 'sender@example.test');
select tests.claims(tests.id(9), 'sender@example.test', tests.id(9));
set local role authenticated;
select lives_ok($$ select public.resend_confirmation() $$, 'emails older than a day do not count toward the limit');

reset role;
select tests.signed_out();
set local role anon;
select throws_ok(
  $$ select public.resend_confirmation() $$, 'P0001', 'Please sign in first',
  'resending needs a signed-in account');

select * from finish();
rollback;
