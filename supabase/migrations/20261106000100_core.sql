-- Core: family accounts, settings, visitors & flags, activity log, email outbox.
-- Every table has RLS on. Guests never read tables directly: they go through
-- SECURITY DEFINER functions that take an unguessable token. Family members
-- read through RLS policies that require a signed-in account with a confirmed
-- email listed in `family`.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------- family

create table public.family (
  person text primary key check (person in ('gabriel', 'micala', 'vincent', 'samantha')),
  display_name text not null,
  role text not null check (role in ('admin', 'elevated')),
  -- Sign-in email. Set by an Admin (or once, by hand, in the SQL editor).
  -- Never committed: this repo is public.
  email text unique
);
alter table public.family enable row level security;

insert into public.family (person, display_name, role) values
  ('gabriel', 'Gabriel', 'admin'),
  ('micala', 'Micala', 'admin'),
  ('vincent', 'Vincent', 'elevated'),
  ('samantha', 'Samantha', 'elevated');

/** The family member signed in, ignoring two-step verification. */
create function private.person_unverified() returns text
language sql stable security definer set search_path = '' as $$
  select f.person from public.family f
  where f.email is not null
    and lower(f.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

/** The family member signed in with two-step verification, or null. */
create function private.person() returns text
language sql stable security definer set search_path = '' as $$
  select case when coalesce(auth.jwt() ->> 'aal', '') = 'aal2' then private.person_unverified() end
$$;

create function private.role() returns text
language sql stable security definer set search_path = '' as $$
  select f.role from public.family f where f.person = private.person()
$$;

create function private.is_family() returns boolean
language sql stable as $$ select private.person() is not null $$;

create function private.is_admin() returns boolean
language sql stable as $$ select coalesce(private.role() = 'admin', false) $$;

create function private.require_family() returns text
language plpgsql stable as $$
declare p text := private.person();
begin
  if p is null then raise exception 'Family sign-in required' using errcode = '42501'; end if;
  return p;
end $$;

create function private.require_admin() returns text
language plpgsql stable as $$
declare p text := private.require_family();
begin
  if not private.is_admin() then raise exception 'Only Gabriel or Micala can do that' using errcode = '42501'; end if;
  return p;
end $$;

create policy "family can read family" on public.family for select using (private.is_family());
create policy "admins edit family" on public.family for update using (private.is_admin()) with check (private.is_admin());
-- Roles are fixed by the spec; only names and sign-in emails can change.
revoke update on public.family from anon, authenticated;
grant update (display_name, email) on public.family to authenticated;
create unique index family_email_lower on public.family (lower(email));

/** Who am I? Works before two-step verification so the UI can ask for it. */
create function public.my_family_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when f.person is null then null else jsonb_build_object(
    'person', f.person,
    'display_name', f.display_name,
    'role', f.role,
    'verified', coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
  ) end
  from (select private.person_unverified() as p) me
  left join public.family f on f.person = me.p
$$;

-- -------------------------------------------------------------- settings

create table public.settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.settings enable row level security;
-- Settings are public on purpose (hours, slot times, dietary needs). Nothing private lives here.
create policy "anyone reads settings" on public.settings for select using (true);
create policy "admins edit settings" on public.settings for update using (private.is_admin()) with check (private.is_admin());

insert into public.settings (key, value, description) values
  ('site_url', '"http://localhost:4321"', 'Base URL used in links inside emails'),
  ('family_name', '"Burns-Konkle"', 'Shown in emails'),
  ('time_zone', '"America/Denver"', 'All times are Mountain Time'),
  ('visiting_hours', '{"start": "09:00", "end": "19:00"}', 'House visits start and end inside these hours; stays and outings arrive, depart, pick up and drop off inside them'),
  ('blackout', jsonb_build_object('start', '00:00', 'end', '04:00', 'message', 'Booking is closed from midnight to 4 AM Mountain Time so the family can rest. Please come back after 4 AM. Thank you!'), 'No new requests, sign-ups, or changes during these hours'),
  ('cutoff_hours', '3', 'Requests must start at least this many hours ahead. Meal Train exempt.'),
  ('increment_minutes', '15', 'Bookings start and end on these increments'),
  ('weekly_cap', '25', 'Unique visitors per week (Sunday through Saturday)'),
  ('incomplete_reminder_hours', '2', 'Remind a guest with an unfinished request after this many hours'),
  ('incomplete_expiry_hours', '24', 'Release an unfinished request after this many hours (or at the cutoff)'),
  ('profile_skip_days', '15', 'Profile holders approved this recently skip the rules and general questions'),
  ('meal_slots', '[{"key": "morning", "label": "Morning", "start": "09:00", "end": "11:00"}, {"key": "midday", "label": "Midday", "start": "13:00", "end": "15:00"}, {"key": "evening", "label": "Early evening", "start": "17:00", "end": "19:00"}]', 'Meal Train slots'),
  ('meal_confirm_hours', '24', 'Release an unconfirmed Meal Train sign-up after this many hours (or at the slot start)'),
  ('dietary_needs', '["No bananas or coconut oil (for Micala).", "No raw or undercooked meat or fish in a finished dish. All meat and fish well done.", "Nothing cooked with alcohol. It does not all cook out.", "No artificial sweeteners. Sugar, honey, maple syrup, or skipping the sweetness are all fine!"]', 'Shown word for word on the Meal Train'),
  ('dietary_thanks', '"Thank you so much! We deeply appreciate you."', 'Line under the dietary needs'),
  ('dietary_summary', '"no bananas or coconut oil; no raw or undercooked meat or fish (all well done); nothing cooked with alcohol; no artificial sweeteners (sugar, honey, maple syrup, or skipping the sweetness are all fine)"', 'Short version used inside the Meal Train sign-up email'),
  ('photo_notice', '"Photos & privacy: No pictures without permission, and nothing posted to social media. No pictures of the baby or Vincent posted, ever. Always ask consent before taking your own pictures in the home or featuring either kiddo. Thank you for respecting this boundary!"', 'Notice at the top of every calendar page'),
  ('visit_reminders', '[{"minutes": 2880, "template": "visit_reminder_48h"}, {"minutes": 1440, "template": "visit_reminder_24h"}, {"minutes": 720, "template": "visit_reminder_12h"}, {"minutes": 120, "template": "visit_reminder_2h"}, {"minutes": 15, "template": "visit_reminder_15m"}]', 'Reminders before an approved visit, stay arrival, or outing pickup'),
  ('meal_reminders', '[{"minutes": 1440, "template": "meal_reminder_24h"}, {"minutes": 60, "template": "meal_reminder_1h"}]', 'Reminders before a Meal Train drop-off'),
  ('test_mode', 'true', 'Show a test-mode banner while family tests the site'),
  ('paused', 'false', 'Site-wide pause: every open time is red and no new requests are accepted');

create function private.setting(k text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select value from public.settings where key = k
$$;

create function private.tz() returns text
language sql stable as $$ select coalesce(private.setting('time_zone') #>> '{}', 'America/Denver') $$;

/** Local wall-clock time in Mountain Time. */
create function private.local(ts timestamptz) returns timestamp
language sql stable as $$ select ts at time zone private.tz() $$;

create function private.site_url() returns text
language sql stable as $$ select rtrim(private.setting('site_url') #>> '{}', '/') $$;

create function private.in_blackout(at_time timestamptz default now()) returns boolean
language sql stable as $$
  select private.local(at_time)::time >= (private.setting('blackout') ->> 'start')::time
     and private.local(at_time)::time < (private.setting('blackout') ->> 'end')::time
$$;

create function private.require_open_hours() returns void
language plpgsql stable as $$
begin
  if private.in_blackout() then
    raise exception '%', private.setting('blackout') ->> 'message' using errcode = 'P0001', hint = 'blackout';
  end if;
end $$;

create function private.is_paused() returns boolean
language sql stable as $$ select coalesce((private.setting('paused'))::boolean, false) $$;

-- ------------------------------------------------------------- activity

create table public.activity (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  summary text not null,
  details jsonb not null default '{}'
);
alter table public.activity enable row level security;
create policy "admins read activity" on public.activity for select using (private.is_admin());
create index activity_at on public.activity (at desc);

create function private.log(action text, summary text, details jsonb default '{}', actor text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.activity (actor, action, summary, details)
  values (coalesce(actor, private.person(), 'system'), action, summary, coalesce(details, '{}'))
$$;

/** Log admin edits to configuration tables (rules, settings, booking types, …). */
create function private.log_config_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  row_id text := coalesce(to_jsonb(new) ->> 'key', to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'person',
                          to_jsonb(old) ->> 'key', to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'person', '?');
begin
  -- Only family edits (not seeds, not system jobs) are worth logging.
  if private.person() is null then return coalesce(new, old); end if;
  perform private.log(
    'settings.' || lower(tg_op),
    format('%s %s in %s', case tg_op when 'INSERT' then 'Added' when 'DELETE' then 'Removed' else 'Changed' end, row_id, tg_table_name),
    jsonb_build_object('table', tg_table_name, 'old', to_jsonb(old), 'new', to_jsonb(new)));
  return coalesce(new, old);
end $$;

create function private.touch_updated() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if to_jsonb(new) ? 'updated_by' then
    new := jsonb_populate_record(new, jsonb_build_object('updated_by', private.person()));
  end if;
  return new;
end $$;

create trigger settings_touch before update on public.settings for each row execute function private.touch_updated();
create trigger settings_log after insert or update or delete on public.settings for each row execute function private.log_config_change();
create trigger family_log after update on public.family for each row execute function private.log_config_change();

-- ------------------------------------------------------- visitors & flags

-- A guest is identified by name + email together.
create function private.name_key(n text) returns text
language sql immutable as $$ select lower(regexp_replace(trim(coalesce(n, '')), '\s+', ' ', 'g')) $$;

create table public.visitors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text not null,
  email_key text not null,
  banned_until timestamptz,
  banned_forever boolean not null default false,
  created_at timestamptz not null default now(),
  unique (name_key, email_key)
);
alter table public.visitors enable row level security;
create policy "family reads visitors" on public.visitors for select using (private.is_family());

-- Contact details are Admin-only, so they live apart from names.
create table public.visitor_contacts (
  visitor_id uuid primary key references public.visitors on delete cascade,
  email text not null,
  phone text,
  email_consent boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.visitor_contacts enable row level security;
create policy "admins read contacts" on public.visitor_contacts for select using (private.is_admin());

create table public.flags (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.visitors on delete cascade,
  flagged_by text not null references public.family,
  note text not null check (length(trim(note)) > 0),
  booking_id uuid,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by text references public.family
);
alter table public.flags enable row level security;
create policy "family reads flags" on public.flags for select using (private.is_family());

create view public.visitor_flags with (security_invoker = true) as
  select v.id as visitor_id, v.name, v.banned_until, v.banned_forever,
         count(f.id) filter (where f.removed_at is null)::int as flag_count
  from public.visitors v left join public.flags f on f.visitor_id = v.id
  group by v.id;

create function private.flag_count(vid uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.flags where visitor_id = vid and removed_at is null
$$;

/** Find or create the visitor for this name + email, and keep their contact details current. */
create function private.upsert_visitor(p_name text, p_email text, p_phone text, p_consent boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare vid uuid; nk text := private.name_key(p_name); ek text := lower(trim(coalesce(p_email, '')));
begin
  if nk = '' then raise exception 'Please enter your name' using errcode = 'P0001'; end if;
  if ek !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please enter a valid email address' using errcode = 'P0001'; end if;
  insert into public.visitors (name, name_key, email_key) values (trim(p_name), nk, ek)
  on conflict (name_key, email_key) do update set name = excluded.name
  returning id into vid;
  insert into public.visitor_contacts (visitor_id, email, phone, email_consent)
  values (vid, trim(p_email), nullif(trim(coalesce(p_phone, '')), ''), coalesce(p_consent, false))
  on conflict (visitor_id) do update set
    email = excluded.email,
    phone = coalesce(excluded.phone, public.visitor_contacts.phone),
    email_consent = excluded.email_consent or public.visitor_contacts.email_consent,
    updated_at = now();
  return vid;
end $$;

/** Raise if this visitor can't request anything right now. */
create function private.require_not_banned(vid uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare v public.visitors;
begin
  select * into v from public.visitors where id = vid;
  if v.banned_forever or (v.banned_until is not null and v.banned_until > now()) then
    raise exception 'You''re not able to book through this site. If you have questions, please reach out to the family directly.'
      using errcode = 'P0001', hint = 'banned';
  end if;
end $$;

-- --------------------------------------------------------------- outbox

create table public.message_templates (
  key text primary key,
  audience text not null check (audience in ('family', 'guest')),
  description text not null,
  subject text not null,
  body text not null,
  position int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.message_templates enable row level security;
create policy "admins read templates" on public.message_templates for select using (private.is_admin());
create policy "admins edit templates" on public.message_templates for update using (private.is_admin()) with check (private.is_admin());
create trigger templates_touch before update on public.message_templates for each row execute function private.touch_updated();
create trigger templates_log after update on public.message_templates for each row execute function private.log_config_change();

create table public.outbox (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  template text not null,
  to_email text not null,
  to_name text,
  to_person text references public.family,
  subject text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'logged')),
  attempts int not null default 0,
  sent_at timestamptz,
  error text
);
alter table public.outbox enable row level security;
create policy "admins read outbox" on public.outbox for select using (private.is_admin());
create index outbox_queued on public.outbox (id) where status = 'queued';

/** Fill [placeholders] from vars. Unknown placeholders are left as-is. */
create function private.render(tpl text, vars jsonb) returns text
language plpgsql immutable as $$
declare k text; v text; out text := tpl;
begin
  for k, v in select key, coalesce(value #>> '{}', '') from jsonb_each(coalesce(vars, '{}')) loop
    out := replace(out, '[' || k || ']', v);
  end loop;
  return out;
end $$;

create function private.first_name(n text) returns text
language sql immutable as $$ select split_part(trim(coalesce(n, '')), ' ', 1) $$;

/** Queue an email to a guest. */
create function private.email_guest(tpl_key text, p_visitor uuid, vars jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.message_templates; c public.visitor_contacts; v public.visitors; allv jsonb;
begin
  select * into t from public.message_templates where key = tpl_key;
  if not found then raise warning 'missing template %', tpl_key; return; end if;
  select * into c from public.visitor_contacts where visitor_id = p_visitor;
  select * into v from public.visitors where id = p_visitor;
  if c.email is null or not c.email_consent then return; end if;
  allv := jsonb_build_object('first name', private.first_name(v.name), 'name', v.name,
                             'family', private.setting('family_name') #>> '{}') || coalesce(vars, '{}');
  insert into public.outbox (template, to_email, to_name, subject, body)
  values (tpl_key, c.email, v.name, private.render(t.subject, allv), private.render(t.body, allv));
end $$;

/**
 * Queue an email to the family. `only` limits recipients (e.g. admins only);
 * the person who caused the event is skipped when `skip_self` is set.
 */
create function private.email_family(tpl_key text, vars jsonb, only_roles text[] default array['admin', 'elevated'], skip_self boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.message_templates; f public.family; me text := private.person(); allv jsonb;
begin
  select * into t from public.message_templates where key = tpl_key;
  if not found then raise warning 'missing template %', tpl_key; return; end if;
  allv := jsonb_build_object('family', private.setting('family_name') #>> '{}') || coalesce(vars, '{}');
  for f in select * from public.family where email is not null and role = any(only_roles) loop
    continue when skip_self and f.person = me;
    insert into public.outbox (template, to_email, to_name, to_person, subject, body)
    values (tpl_key, f.email, f.display_name, f.person, private.render(t.subject, allv), private.render(t.body, allv));
  end loop;
end $$;

/** Display helpers for email text, all in Mountain Time. */
create function private.fmt_date(ts timestamptz) returns text
language sql stable as $$ select trim(to_char(private.local(ts), 'Dy, Mon FMDD')) $$;

create function private.fmt_time(ts timestamptz) returns text
language sql stable as $$ select replace(trim(to_char(private.local(ts), 'FMHH12:MI AM')), ':00', '') $$;

create function private.fmt_dt(ts timestamptz) returns text
language sql stable as $$ select private.fmt_date(ts) || ' at ' || private.fmt_time(ts) $$;

create function private.fmt_range(s timestamptz, e timestamptz) returns text
language sql stable as $$
  select case when private.local(s)::date = private.local(e)::date
    then private.fmt_date(s) || ', ' || private.fmt_time(s) || '–' || private.fmt_time(e)
    else private.fmt_dt(s) || ' to ' || private.fmt_dt(e) end
$$;

create function private.random_token() returns text
language sql volatile as $$ select encode(extensions.gen_random_bytes(24), 'hex') $$;
