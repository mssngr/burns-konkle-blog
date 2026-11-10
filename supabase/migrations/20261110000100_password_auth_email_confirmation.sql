-- Passwords instead of emailed codes, and no two-step verification.
--
-- Anyone can now sign up with an email and password. Until they confirm that
-- email (by clicking a link we send), they can look around but can't change
-- anything. Family accounts are matched by email, so a family account also
-- stays locked until its email is confirmed: otherwise anyone could register a
-- family member's address and read guests' private details.
--
-- Supabase's own "confirm email" setting blocks sign-in until confirmed, so it
-- can't give us "look but don't touch". We track confirmation ourselves instead
-- and send the link through the existing outbox.

-- ------------------------------------------------------ email confirmation

create table private.email_confirmations (
  user_id uuid primary key references auth.users on delete cascade,
  -- The address the token was sent to. Changing the account's email makes a new row state.
  email text not null,
  token text not null default private.random_token(),
  confirmed_at timestamptz,
  last_sent_at timestamptz not null default now()
);

/** Queue the confirmation email for this row. */
create function private.send_confirmation_email(c private.email_confirmations) returns void
language plpgsql security definer set search_path = '' as $$
declare fam text := private.setting('family_name') #>> '{}';
begin
  insert into public.outbox (template, to_email, subject, body)
  values (
    'email_confirmation', c.email,
    'Please confirm your email',
    format(E'Welcome to the %s family site! Please confirm your email by opening this link:\n\n%s/confirm/?t=%s\n\nUntil you do, you can look around but can''t make changes. If you didn''t sign up, you can ignore this email.',
           fam, private.site_url(), c.token)
  );
end $$;

/** Every new account gets a confirmation link. */
create function private.on_user_created() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c private.email_confirmations;
begin
  insert into private.email_confirmations (user_id, email)
  values (new.id, lower(new.email)) returning * into c;
  perform private.send_confirmation_email(c);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.on_user_created();

/** A changed email address has to be confirmed again. */
create function private.on_user_email_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c private.email_confirmations;
begin
  if lower(new.email) is not distinct from lower(old.email) then return new; end if;
  insert into private.email_confirmations (user_id, email)
  values (new.id, lower(new.email))
  on conflict (user_id) do update
    set email = excluded.email, token = private.random_token(), confirmed_at = null, last_sent_at = now()
  returning * into c;
  perform private.send_confirmation_email(c);
  return new;
end $$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function private.on_user_email_changed();

-- Everyone who already signed in proved their email with an emailed code.
insert into private.email_confirmations (user_id, email, confirmed_at)
select id, lower(email), coalesce(email_confirmed_at, now()) from auth.users where email is not null
on conflict do nothing;

/** Has the signed-in user confirmed the email they're signed in with? */
create function private.is_confirmed() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.email_confirmations c
    where c.user_id = auth.uid() and c.confirmed_at is not null
      and c.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;

/** Open the link from the email. Works signed in or not. */
create function public.confirm_email(p_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update private.email_confirmations set confirmed_at = coalesce(confirmed_at, now())
  where token = p_token and p_token <> '';
  get diagnostics n = row_count;
  return n > 0;
end $$;

/** Send the confirmation link again (at most once a minute). */
create function public.resend_confirmation() returns void
language plpgsql security definer set search_path = '' as $$
declare c private.email_confirmations;
begin
  select * into c from private.email_confirmations where user_id = auth.uid();
  if not found then raise exception 'Please sign in first' using errcode = 'P0001'; end if;
  if c.confirmed_at is not null and c.email = lower(coalesce(auth.jwt() ->> 'email', '')) then return; end if;
  if c.last_sent_at > now() - interval '1 minute' then
    raise exception 'We just sent a link. Please check your email, or try again in a minute.' using errcode = 'P0001';
  end if;
  update private.email_confirmations set last_sent_at = now() where user_id = c.user_id returning * into c;
  perform private.send_confirmation_email(c);
end $$;

-- ------------------------------------------------- who is in the family now

/** The family member signed in by email, confirmed or not. */
alter function private.person_unverified() rename to person_by_email;

/** The family member signed in with a confirmed email, or null. Used for every read and change. */
create or replace function private.person() returns text
language sql stable security definer set search_path = '' as $$
  select case when private.is_confirmed() then private.person_by_email() end
$$;

/** Same as before, but tells an unconfirmed family member what to do instead of just refusing. */
create or replace function private.require_family() returns text
language plpgsql stable as $$
declare p text := private.person();
begin
  if p is null then
    if private.person_by_email() is not null then
      raise exception 'Please confirm your email first. We sent you a link.' using errcode = 'P0001';
    end if;
    raise exception 'Family sign-in required' using errcode = '42501';
  end if;
  return p;
end $$;

/** Who am I? Works before the email is confirmed so the site can say what's missing. */
create or replace function public.my_family_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when f.person is null then null else jsonb_build_object(
    'person', f.person,
    'display_name', f.display_name,
    'role', f.role,
    'confirmed', private.is_confirmed()
  ) end
  from (select private.person_by_email() as p) me
  left join public.family f on f.person = me.p
$$;

/** Is the signed-in account's email confirmed? Guests use this too. */
create function public.my_email_confirmed() returns boolean
language sql stable security definer set search_path = '' as $$ select private.is_confirmed() $$;

-- ---------------------------------------------------------- guest profiles

-- Anyone signed in can read their own profile; saving one needs a confirmed email.
drop policy "own profile insert" on public.profiles;
drop policy "own profile update" on public.profiles;
create policy "own profile insert" on public.profiles for insert
  with check (user_id = auth.uid() and private.is_confirmed());
create policy "own profile update" on public.profiles for update
  using (user_id = auth.uid() and private.is_confirmed())
  with check (user_id = auth.uid() and private.is_confirmed());

/** Profile holders approved in the last N days, with every rule still current, skip the rules. */
create or replace function private.recent_agreement_source(p_profile uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select b.id from public.bookings b
  where p_profile is not null and private.is_confirmed()
    and b.profile_id = p_profile and b.status = 'approved'
    and b.ends_at >= now() - make_interval(days => (private.setting('profile_skip_days'))::int)
    and private.rules_complete(b.id)
  order by b.ends_at desc limit 1
$$;

-- ------------------------------------------------------ admins see all accounts

/** Every account on the site, for Admins. */
create function public.admin_accounts() returns table (
  user_id uuid,
  email text,
  name text,
  kind text,
  role text,
  confirmed boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
  select u.id, u.email::text,
         coalesce(f.display_name, p.name),
         case when f.person is not null then 'family' else 'guest' end,
         f.role,
         (c.confirmed_at is not null and c.email = lower(u.email)),
         u.created_at, u.last_sign_in_at
  from auth.users u
  left join private.email_confirmations c on c.user_id = u.id
  left join public.family f on f.email is not null and lower(f.email) = lower(u.email)
  left join public.profiles p on p.user_id = u.id
  order by (f.person is null), f.person, u.created_at;
end $$;
