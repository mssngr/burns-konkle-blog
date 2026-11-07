-- Visitation rules, booking types, the visit calendar, and every visit action.

-- ----------------------------------------------------------------- rules

create table public.rules (
  id uuid primary key default gen_random_uuid(),
  position int not null,
  title text not null,
  body text not null,
  kind text not null default 'rule' check (kind in ('rule', 'confirmation')),
  active boolean not null default true,
  revision int not null default 1,
  created_at timestamptz not null default now(),
  -- When the wording last changed (drives "Updated" labels and "Last updated").
  updated_at timestamptz not null default now()
);
alter table public.rules enable row level security;
create policy "anyone reads active rules" on public.rules for select using (active or private.is_admin());
create policy "admins add rules" on public.rules for insert with check (private.is_admin());
create policy "admins edit rules" on public.rules for update using (private.is_admin()) with check (private.is_admin());
create policy "admins delete rules" on public.rules for delete using (private.is_admin());

insert into public.rules (position, title, body, kind) values
  (1, 'Shoes', 'Please remove your shoes at the door.', 'rule'),
  (2, 'Handwashing', 'Wash your hands when you arrive, before and after eating, after entering the restroom regardless of use or gender, and after sneezing or coughing.', 'rule'),
  (3, 'Food', 'Please serve yourself food with utensils, not hands, to avoid cross-contamination.', 'rule'),
  (4, 'Illness', 'Do not come if you are sick, even with a cold.', 'rule'),
  (5, 'Symptoms', 'No one in your group may have had a fever, diarrhea, vomiting, rashes, or persistent coughing or sneezing within 72 hours of arrival.', 'rule'),
  (6, 'Vaccinations', 'Everyone in your group must have had COVID and flu vaccinations within the last 2 years.', 'rule'),
  (7, 'Smoking', 'No smoking within 72 hours of visiting or during your visit, and no clothing, including coats, that hasn''t been washed since smoking. This includes vapes, cigarettes, and weed. Micala has asthma and the baby has brand-new lungs. Secondhand smoke kills.', 'rule'),
  (8, 'Alcohol and drugs', 'No outside alcohol and no drugs at all. All alcohol in the home must be offered by Gabriel or Micala before anyone drinks it. Please help enforce this if you see someone else breaking it. Likely, everyone reading knows who these rules are for. Thank you!', 'rule'),
  (9, 'The baby', 'The baby does not leave the home without Micala and/or Gabriel for any reason, without clear approval and boundaries.', 'rule'),
  (10, 'Photos and privacy', 'Absolutely no pictures are to be taken without permission or posted to social media. Micala and Gabriel would like the chance to decide for themselves who sees their home and themselves, and they do not want ANY pictures of the baby posted, nor Vincent for that matter, beyond what was posted in times past. If and when they change their minds, they will post their own pictures. Always ask consent before taking your own pictures while in the home or featuring either kiddo. We take this one seriously and will ask people to leave if we feel uncomfortable. Thank you for respecting this boundary!', 'rule'),
  (11, 'No additional visitors', 'List everyone you plan to arrive with or expose Vincent to. This is a boundary we will hold firmly. Postpartum is not a good time for surprises of any sort. Thank you for understanding!', 'rule'),
  (12, 'Arrival time', 'Please do not show up more than 10 minutes early without notice and approval.', 'rule'),
  (13, 'Final confirmation', 'I have shared these rules with everyone coming with me, and they agree to follow them too.', 'confirmation');

insert into public.settings (key, value, description) values
  ('rules_updated_at', to_jsonb(now()), 'Shown as "Last updated" on the rules page');

create function private.rules_before_update() returns trigger
language plpgsql as $$
begin
  if new.title is distinct from old.title or new.body is distinct from old.body
     or (new.active and not old.active) then
    new.revision := old.revision + 1;
    new.updated_at := now();
  end if;
  return new;
end $$;
create trigger rules_revision before update on public.rules for each row execute function private.rules_before_update();
create trigger rules_log after insert or update or delete on public.rules for each row execute function private.log_config_change();

-- ------------------------------------------------- booking types & limits

create table public.capacity_groups (
  key text primary key,
  label text not null,
  max_people int not null check (max_people > 0),
  type_ids int[] not null,
  position int not null default 0
);
alter table public.capacity_groups enable row level security;
create policy "anyone reads limits" on public.capacity_groups for select using (true);
create policy "admins edit limits" on public.capacity_groups for update using (private.is_admin()) with check (private.is_admin());
create trigger capacity_log after update on public.capacity_groups for each row execute function private.log_config_change();

insert into public.capacity_groups (key, label, max_people, type_ids, position) values
  ('stay', 'Staying at the house at one time', 3, '{1}', 1),
  ('house', 'In the home at once (visits plus anyone staying)', 5, '{1,2}', 2),
  ('colorado', 'In Colorado at once (trips plus anyone staying at or visiting the house)', 10, '{1,2,3}', 3),
  ('vincent', 'With Vincent at once, including kids', 10, '{4,5}', 4);

create table public.booking_types (
  id int primary key,
  position int not null,
  name text not null,
  -- Used inside sentences: "Your request for [type] on …"
  short_name text not null,
  description text not null,
  limit_group text not null references public.capacity_groups,
  limit_text text not null,
  -- null = as long as the trip or outing
  max_minutes int,
  length_text text not null,
  approval text not null check (approval in ('approve', 'acknowledge')),
  -- within: start and end inside visiting hours, same day.
  -- endpoints: arrival/departure (pickup/drop-off) inside visiting hours; may run overnight.
  -- none: any time (trips to Colorado).
  hours_rule text not null check (hours_rule in ('within', 'endpoints', 'none')),
  start_label text not null default 'Start',
  end_label text not null default 'End',
  questions jsonb not null default '[]',
  active boolean not null default true
);
alter table public.booking_types enable row level security;
create policy "anyone reads booking types" on public.booking_types for select using (true);
create policy "admins edit booking types" on public.booking_types for update using (private.is_admin()) with check (private.is_admin());
create trigger types_log after update on public.booking_types for each row execute function private.log_config_change();

insert into public.booking_types (id, position, name, short_name, description, limit_group, limit_text, max_minutes, length_text, approval, hours_rule, start_label, end_label, questions) values
  (1, 1, 'Stay at the house', 'a stay at the house', 'Stay overnight with the family.', 'stay',
   '3 at one time', 2880, '48 hours; longer needs an additional request', 'approve', 'endpoints', 'Arrival', 'Departure',
   '[{"key": "others_in_town", "label": "Anyone else you''ll see while you''re in town", "kind": "textarea", "required": false}]'),
  (2, 2, 'Visit the house', 'a visit to the house', 'Come over for a visit.', 'house',
   '5 in the home at once, including kids and anyone staying at the house', 120, '2 hours; longer needs an additional request', 'approve', 'within', 'Arrival', 'Departure',
   '[]'),
  (3, 3, 'Visit Colorado, not staying at the house', 'your Colorado trip', 'Let the family know you''re in town. In-home visits during the trip are booked separately.', 'colorado',
   '10, including anyone staying at or visiting the house', null, 'Length of the trip', 'acknowledge', 'none', 'Arrive in Colorado', 'Leave Colorado',
   '[{"key": "area", "label": "The city or area you''re staying in (no address needed)", "kind": "text", "required": true},
     {"key": "hoped_visits", "label": "Which in-home visits you hope to request (each one is booked separately)", "kind": "textarea", "required": false}]'),
  (4, 4, 'Take Vincent out, staying in Denver', 'an outing with Vincent', 'Spend up to 6 hours with Vincent around Denver.', 'vincent',
   '10, including kids and everyone involved', 360, '6 hours', 'approve', 'endpoints', 'Pickup', 'Drop-off',
   '[{"key": "places", "label": "Each place you''ll go in Denver", "kind": "textarea", "required": true},
     {"key": "driver", "label": "Who is driving", "kind": "text", "required": true}]'),
  (5, 5, 'Take Vincent out for more than 6 hours, including overnights', 'a long outing with Vincent', 'A longer outing or an overnight with Vincent. Every person and every location must be listed.', 'vincent',
   '10 total', null, 'Length of the outing', 'approve', 'endpoints', 'Pickup', 'Return',
   '[{"key": "locations", "label": "Every location with its address, in order", "kind": "textarea", "required": true},
     {"key": "sleep", "label": "Where Vincent will sleep, with the address", "kind": "textarea", "required": true},
     {"key": "people_at_locations", "label": "Every person who lives at or will be at each location", "kind": "textarea", "required": true},
     {"key": "others_around", "label": "Anyone else Vincent will be around", "kind": "textarea", "required": false},
     {"key": "driver", "label": "Who is driving", "kind": "text", "required": true},
     {"key": "group_phone", "label": "The best phone number to reach the group", "kind": "text", "required": true}]');

-- --------------------------------------------------------------- bookings

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default private.random_token(),
  type_id int not null references public.booking_types,
  visitor_id uuid not null references public.visitors,
  profile_id uuid references auth.users on delete set null,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- draft = yellow, submitted = orange, approved = blue/purple
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'denied', 'cancelled', 'expired')),
  attendees jsonb not null default '[]',
  attendee_keys text[] not null default '{}',
  headcount int not null default 0,
  answers jsonb not null default '{}',
  preapproved_by text references public.family,
  preapproved_at timestamptz,
  decision_note text,
  decided_by text,
  decided_at timestamptz,
  cancel_note text,
  cancelled_by text,
  cancelled_at timestamptz,
  healthy_at timestamptz,
  offer_id uuid,
  incomplete_reminded_at timestamptz,
  reminders_sent text[] not null default '{}',
  rules_reagree_needed boolean not null default false,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.bookings enable row level security;
create index bookings_time on public.bookings (starts_at, ends_at) where status in ('draft', 'submitted', 'approved');
create index bookings_visitor on public.bookings (visitor_id);
create policy "family reads bookings" on public.bookings for select using (private.is_family());
create policy "profile holders read their bookings" on public.bookings for select using (profile_id is not null and profile_id = auth.uid());

create function private.bookings_before_write() returns trigger
language plpgsql as $$
begin
  new.attendee_keys := coalesce((
    select array_agg(distinct private.name_key(a ->> 'name'))
    from jsonb_array_elements(new.attendees) a
    where private.name_key(a ->> 'name') <> ''), '{}');
  if cardinality(new.attendee_keys) = 0 then
    -- Before the questions are answered, the requester stands in for the group.
    new.attendee_keys := array[private.name_key(new.name)];
  end if;
  new.headcount := greatest(jsonb_array_length(new.attendees), 0);
  new.updated_at := now();
  return new;
end $$;
create trigger bookings_keys before insert or update on public.bookings for each row execute function private.bookings_before_write();

-- Flagged visitors need 3 of the 4 to approve; votes live here.
create table public.booking_approvals (
  booking_id uuid not null references public.bookings on delete cascade,
  person text not null references public.family,
  at timestamptz not null default now(),
  primary key (booking_id, person)
);
alter table public.booking_approvals enable row level security;
create policy "family reads approvals" on public.booking_approvals for select using (private.is_family());

create table public.booking_changes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings on delete cascade,
  proposed_by text not null, -- 'guest' or a family person
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  attendees jsonb,
  note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  decision_note text
);
alter table public.booking_changes enable row level security;
create unique index one_pending_change on public.booking_changes (booking_id) where status = 'pending';
create policy "family reads changes" on public.booking_changes for select using (private.is_family());

create table public.rule_agreements (
  booking_id uuid not null references public.bookings on delete cascade,
  rule_id uuid not null references public.rules on delete cascade,
  revision int not null,
  agreed_at timestamptz not null default now(),
  primary key (booking_id, rule_id)
);
alter table public.rule_agreements enable row level security;
create policy "family reads agreements" on public.rule_agreements for select using (private.is_family());

-- ----------------------------------------------------------------- blocks

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  calendar text not null default 'all' check (calendar in ('visits', 'meals', 'all')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  repeat text not null default 'none' check (repeat in ('none', 'daily', 'weekly')),
  repeat_until date,
  note text, -- private: Admins only
  created_by text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.blocks enable row level security;
create policy "admins manage blocks" on public.blocks for all using (private.is_admin()) with check (private.is_admin());
create trigger blocks_log after insert or update or delete on public.blocks for each row execute function private.log_config_change();

/** Every occurrence of every block on a calendar that touches [from_ts, to_ts). */
create function private.block_intervals(cal text, from_ts timestamptz, to_ts timestamptz)
returns table (block_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with b as (
    select bl.*, case bl.repeat when 'daily' then 1 when 'weekly' then 7 else 0 end as step,
           private.local(bl.starts_at) as ls, private.local(bl.ends_at) as le
    from public.blocks bl
    where cal = 'all' or bl.calendar = cal or bl.calendar = 'all'
  ),
  occ as (
    select b.id, b.starts_at as s, b.ends_at as e from b where b.step = 0
    union all
    select b.id,
           (b.ls + make_interval(days => n * b.step)) at time zone private.tz(),
           (b.le + make_interval(days => n * b.step)) at time zone private.tz()
    from b,
         generate_series(
           greatest(0, floor((private.local(from_ts)::date - b.ls::date - 1)::numeric / nullif(b.step, 0))::int),
           floor((least(private.local(to_ts)::date, coalesce(b.repeat_until, private.local(to_ts)::date)) - b.ls::date)::numeric / nullif(b.step, 0))::int
         ) n
    where b.step > 0
  )
  select id, s, e from occ where s < to_ts and e > from_ts
$$;

create function private.is_blocked(cal text, s timestamptz, e timestamptz) returns boolean
language sql stable as $$ select exists (select 1 from private.block_intervals(cal, s, e)) $$;

/** Public: block times for a calendar, without the private notes. */
create function public.blocked_times(p_calendar text, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select starts_at, ends_at from private.block_intervals(p_calendar, p_from, p_to) order by 1
$$;

-- ----------------------------------------------------------- limits math

/** Most distinct people at once in a limit group over [s, e), optionally adding a candidate group. */
create function private.peak(g text, s timestamptz, e timestamptz, extra text[] default '{}', exclude uuid default null)
returns int language sql stable security definer set search_path = '' as $$
  with grp as (select type_ids from public.capacity_groups where key = g),
  bk as (
    select b.starts_at, b.ends_at, b.attendee_keys
    from public.bookings b, grp
    where b.status = 'approved' and b.type_id = any (grp.type_ids)
      and b.starts_at < e and b.ends_at > s
      and (exclude is null or b.id <> exclude)
  ),
  pts as (select s as p union select starts_at from bk where starts_at > s)
  select coalesce(max((
    select count(*) from (
      select unnest(bk.attendee_keys) from bk where bk.starts_at <= pts.p and bk.ends_at > pts.p
      union
      select unnest(extra)
    ) u)), 0)::int
  from pts
$$;

create function private.week_start(ts timestamptz) returns date
language sql stable as $$ select private.local(ts)::date - extract(dow from private.local(ts))::int $$;

/** Distinct people (by name) with an approved booking touching the week that starts on this Sunday. */
create function private.week_keys(wk date, exclude uuid default null) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct k), '{}')
  from public.bookings b, unnest(b.attendee_keys) k
  where b.status = 'approved'
    and (exclude is null or b.id <> exclude)
    and b.starts_at < (wk + 7)::timestamp at time zone private.tz()
    and b.ends_at > wk::timestamp at time zone private.tz()
$$;

create function private.weeks_between(s timestamptz, e timestamptz) returns setof date
language sql stable as $$
  select generate_series(private.week_start(s), private.week_start(e - interval '1 second'), interval '7 days')::date
$$;

/** Visiting-hours rule for a booking type (used by shorten; check_window has its own copy with the same rules). */
create function private.check_hours(p_type int, s timestamptz, e timestamptz) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  t public.booking_types;
  hs time := (private.setting('visiting_hours') ->> 'start')::time;
  he time := (private.setting('visiting_hours') ->> 'end')::time;
begin
  select * into t from public.booking_types where id = p_type;
  if t.hours_rule = 'within' and (
       private.local(s)::date <> private.local(e)::date
       or private.local(s)::time < hs or private.local(e)::time > he) then
    raise exception 'House visits start and end between % and % Mountain Time', to_char(hs, 'FMHH12 AM'), to_char(he, 'FMHH12 AM') using errcode = 'P0001';
  end if;
  if t.hours_rule = 'endpoints' and (
       private.local(s)::time < hs or private.local(s)::time > he
       or private.local(e)::time < hs or private.local(e)::time > he) then
    raise exception '% and % times need to be between % and % Mountain Time', t.start_label, lower(t.end_label), to_char(hs, 'FMHH12 AM'), to_char(he, 'FMHH12 AM') using errcode = 'P0001';
  end if;
end $$;

/**
 * Validate a requested time for a booking type. Raises a friendly message.
 * `requester` is a name key used for the weekly cap; pass null to skip the cap.
 */
create function private.check_window(p_type int, s timestamptz, e timestamptz, requester text, exclude uuid default null, is_new boolean default true)
returns void language plpgsql stable security definer set search_path = '' as $$
declare
  t public.booking_types;
  hs time := (private.setting('visiting_hours') ->> 'start')::time;
  he time := (private.setting('visiting_hours') ->> 'end')::time;
  inc int := (private.setting('increment_minutes'))::int;
  cutoff interval := make_interval(hours => (private.setting('cutoff_hours'))::int);
  cap int := (private.setting('weekly_cap'))::int;
  g public.capacity_groups;
  wk date;
  keys text[];
begin
  select * into t from public.booking_types where id = p_type and active;
  if not found then raise exception 'Please choose a booking type' using errcode = 'P0001'; end if;
  if s is null or e is null or e <= s then raise exception 'Please choose a start and an end time' using errcode = 'P0001'; end if;
  if extract(epoch from s)::bigint % (inc * 60) <> 0 or extract(epoch from e)::bigint % (inc * 60) <> 0 then
    raise exception 'Times start and end on %-minute increments', inc using errcode = 'P0001';
  end if;
  if t.max_minutes is not null and e - s > make_interval(mins => t.max_minutes) then
    raise exception '% can be up to %. For longer, please send an additional request.', t.name, t.length_text using errcode = 'P0001';
  end if;
  if t.hours_rule = 'within' and (
       private.local(s)::date <> private.local(e)::date
       or private.local(s)::time < hs or private.local(e)::time > he) then
    raise exception 'House visits start and end between % and % Mountain Time', to_char(hs, 'FMHH12 AM'), to_char(he, 'FMHH12 AM') using errcode = 'P0001';
  end if;
  if t.hours_rule = 'endpoints' and (
       private.local(s)::time < hs or private.local(s)::time > he
       or private.local(e)::time < hs or private.local(e)::time > he) then
    raise exception '% and % times need to be between % and % Mountain Time', t.start_label, lower(t.end_label), to_char(hs, 'FMHH12 AM'), to_char(he, 'FMHH12 AM') using errcode = 'P0001';
  end if;
  if is_new and s < now() + cutoff then
    raise exception 'Requests need to start at least % hours from now', private.setting('cutoff_hours') using errcode = 'P0001';
  end if;
  if private.is_paused() then
    raise exception 'Booking is paused right now. Please check back soon.' using errcode = 'P0001';
  end if;
  if private.is_blocked('visits', s, e) then
    raise exception 'That time isn''t available. Please pick another time.' using errcode = 'P0001';
  end if;
  for g in select * from public.capacity_groups where p_type = any (type_ids) loop
    if private.peak(g.key, s, e, '{}', exclude) >= g.max_people then
      raise exception 'That time is already full. Please pick another time.' using errcode = 'P0001';
    end if;
  end loop;
  if requester is not null then
    for wk in select private.weeks_between(s, e) loop
      keys := private.week_keys(wk, exclude);
      if cardinality(keys) >= cap and not requester = any (keys) then
        raise exception 'The week of % is full (% visitors). Please pick another week.', to_char(wk, 'FMMon FMDD'), cap using errcode = 'P0001';
      end if;
    end loop;
  end if;
end $$;

/** Raise unless approving this booking (with these people and times) stays under every limit. */
create function private.check_room(b public.bookings) returns void
language plpgsql stable security definer set search_path = '' as $$
declare g public.capacity_groups; wk date; n int; cap int := (private.setting('weekly_cap'))::int;
begin
  for g in select * from public.capacity_groups where b.type_id = any (type_ids) loop
    n := private.peak(g.key, b.starts_at, b.ends_at, b.attendee_keys, b.id);
    if n > g.max_people then
      raise exception 'Approving this would put % people over the limit for "%" (max %). Deny it with a note instead.', n, g.label, g.max_people
        using errcode = 'P0001', hint = 'over_limit';
    end if;
  end loop;
  for wk in select private.weeks_between(b.starts_at, b.ends_at) loop
    select count(*) into n from (
      select unnest(private.week_keys(wk, b.id)) union select unnest(b.attendee_keys)) u;
    if n > cap then
      raise exception 'Approving this would put the week of % over % visitors. Deny it with a note instead.', to_char(wk, 'FMMon FMDD'), cap
        using errcode = 'P0001', hint = 'over_cap';
    end if;
  end loop;
end $$;

-- --------------------------------------------------------- the calendar

/**
 * Public calendar for one booking type: a state for every slot inside visiting hours.
 * States: red, purple, orange, yellow, blue, green (first that applies wins).
 */
create function public.visit_calendar(p_type int, p_from date, p_days int default 7)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  hs time := (private.setting('visiting_hours') ->> 'start')::time;
  he time := (private.setting('visiting_hours') ->> 'end')::time;
  inc interval := make_interval(mins => (private.setting('increment_minutes'))::int);
  cutoff timestamptz := now() + make_interval(hours => (private.setting('cutoff_hours'))::int);
  cap int := (private.setting('weekly_cap'))::int;
  paused boolean := private.is_paused();
  types int[];
  from_ts timestamptz;
  to_ts timestamptz;
  out jsonb := '[]';
  weeks jsonb := '{}';
  d date;
  p timestamptz;
  st text;
  why text;
begin
  p_days := least(greatest(p_days, 1), 42);
  select array_agg(distinct x) into types
  from public.capacity_groups g, unnest(g.type_ids) x where p_type = any (g.type_ids);
  from_ts := p_from::timestamp at time zone private.tz();
  to_ts := (p_from + p_days)::timestamp at time zone private.tz();

  for d in select generate_series(p_from, p_from + p_days - 1, interval '1 day')::date loop
    if not weeks ? private.week_start(d::timestamp at time zone private.tz())::text then
      weeks := weeks || jsonb_build_object(private.week_start(d::timestamp at time zone private.tz())::text,
        cardinality(private.week_keys(private.week_start(d::timestamp at time zone private.tz()))));
    end if;
    for p in select generate_series((d + hs)::timestamp at time zone private.tz(),
                                    (d + he)::timestamp at time zone private.tz() - inc, inc) loop
      why := null;
      if paused then why := 'paused';
      elsif p < cutoff then why := 'closed';
      elsif private.is_blocked('visits', p, p + inc) then why := 'blocked';
      elsif (weeks ->> private.week_start(p)::text)::int >= cap then why := 'week_full';
      end if;
      if why is not null then st := 'red';
      elsif exists (select 1 from public.capacity_groups g where p_type = any (g.type_ids)
                    and private.peak(g.key, p, p + inc) >= g.max_people) then st := 'purple';
      elsif exists (select 1 from public.bookings b where b.status = 'submitted' and b.type_id = any (types)
                    and b.starts_at < p + inc and b.ends_at > p) then st := 'orange';
      elsif exists (select 1 from public.bookings b where b.status = 'draft' and b.type_id = any (types)
                    and b.starts_at < p + inc and b.ends_at > p) then st := 'yellow';
      elsif exists (select 1 from public.bookings b where b.status = 'approved' and b.type_id = any (types)
                    and b.starts_at < p + inc and b.ends_at > p) then st := 'blue';
      else st := 'green';
      end if;
      out := out || jsonb_build_object('t', p, 's', st, 'r', why);
    end loop;
  end loop;

  return jsonb_build_object(
    'type', p_type,
    'from', from_ts,
    'to', to_ts,
    'paused', paused,
    'blackout', private.in_blackout(),
    'weeks', weeks,
    'weekly_cap', cap,
    'slots', out);
end $$;

-- ------------------------------------------------------- shared helpers

create function private.booking_vars(b public.bookings) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', b.name,
    'first name', private.first_name(b.name),
    -- [a type] = "a stay at the house"; [type] = "stay at the house" (for "your [type]")
    'a type', t.short_name,
    'type', regexp_replace(t.short_name, '^(a|an|your) ', '', 'i'),
    'type name', t.name,
    'date', private.fmt_date(b.starts_at),
    'time', private.fmt_time(b.starts_at),
    'dates', private.fmt_date(b.starts_at) || ' – ' || private.fmt_date(b.ends_at),
    'when', private.fmt_range(b.starts_at, b.ends_at),
    'number', greatest(b.headcount, 1),
    'link', private.site_url() || '/visits/request/?t=' || b.token,
    'healthy link', private.site_url() || '/visits/request/?t=' || b.token || '&do=healthy',
    'cancel link', private.site_url() || '/visits/request/?t=' || b.token || '&do=cancel',
    'rules link', private.site_url() || '/rules/',
    'family link', private.site_url() || '/family/visits/?id=' || b.id)
  from public.booking_types t where t.id = b.type_id
$$;

create function private.rules_complete(p_booking uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.rules r
    left join public.rule_agreements a on a.rule_id = r.id and a.booking_id = p_booking
    where r.active and (a.rule_id is null or a.revision < r.revision))
$$;

create function private.answers_complete(b public.bookings) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare t public.booking_types; q jsonb;
begin
  select * into t from public.booking_types where id = b.type_id;
  if jsonb_array_length(b.attendees) = 0 then return false; end if;
  if exists (select 1 from jsonb_array_elements(b.attendees) a
             where coalesce(trim(a ->> 'name'), '') = '' or coalesce(trim(a ->> 'relationship'), '') = '') then
    return false;
  end if;
  if coalesce(trim(b.answers ->> 'bring'), '') = '' then return false; end if;
  for q in select * from jsonb_array_elements(t.questions) loop
    if (q ->> 'required')::boolean and coalesce(trim(b.answers ->> (q ->> 'key')), '') = '' then return false; end if;
  end loop;
  return true;
end $$;

create function private.booking_by_token(p_token text) returns public.bookings
language plpgsql stable security definer set search_path = '' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where token = p_token;
  if not found then raise exception 'We couldn''t find that request. Please check your link.' using errcode = 'P0001'; end if;
  return b;
end $$;

/** Profile holders approved in the last N days, with every rule still current, skip the rules. */
create function private.recent_agreement_source(p_profile uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select b.id from public.bookings b
  where p_profile is not null and b.profile_id = p_profile and b.status = 'approved'
    and b.ends_at >= now() - make_interval(days => (private.setting('profile_skip_days'))::int)
    and private.rules_complete(b.id)
  order by b.ends_at desc limit 1
$$;

-- ------------------------------------------------------------ guest API

/** Step 3 of "Book a Visit": save the request (yellow). Returns the private token. */
create function public.create_visit_request(
  p_type int, p_starts_at timestamptz, p_ends_at timestamptz,
  p_name text, p_email text, p_phone text default null, p_consent boolean default false,
  p_offer_token text default null
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  vid uuid;
  b public.bookings;
  src uuid;
  src_b public.bookings;
  oid uuid;
begin
  perform private.require_open_hours();
  if not coalesce(p_consent, false) then
    raise exception 'Please agree to receive emails about your request' using errcode = 'P0001';
  end if;
  vid := private.upsert_visitor(p_name, p_email, p_phone, p_consent);
  perform private.require_not_banned(vid);
  perform private.check_window(p_type, p_starts_at, p_ends_at, private.name_key(p_name));
  if p_offer_token is not null then
    select id into oid from public.offers where token = p_offer_token;
  end if;

  insert into public.bookings (type_id, visitor_id, profile_id, name, starts_at, ends_at, offer_id)
  values (p_type, vid, auth.uid(), trim(p_name), p_starts_at, p_ends_at, oid)
  returning * into b;

  -- Profile shortcut: copy rule agreements and general answers from a recent approved visit.
  src := private.recent_agreement_source(auth.uid());
  if src is not null then
    insert into public.rule_agreements (booking_id, rule_id, revision)
    select b.id, rule_id, revision from public.rule_agreements where booking_id = src;
    select * into src_b from public.bookings where id = src;
    update public.bookings
       set answers = jsonb_strip_nulls(jsonb_build_object('bring', src_b.answers ->> 'bring', 'notes', src_b.answers ->> 'notes')),
           attendees = src_b.attendees
     where id = b.id returning * into b;
  end if;

  perform private.email_guest('visit_saved', vid, private.booking_vars(b));
  perform private.email_family('family_visit_started', private.booking_vars(b));
  perform private.log('visit.started', format('%s started a request: %s, %s', b.name, (select name from public.booking_types where id = b.type_id), private.fmt_range(b.starts_at, b.ends_at)),
                      jsonb_build_object('booking_id', b.id), 'guest: ' || b.name);
  return jsonb_build_object('token', b.token, 'skipped_rules', src is not null);
end $$;

/** Everything a guest sees on their private request page. */
create function public.get_visit_request(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare b public.bookings; t public.booking_types; last_agreed timestamptz; ch public.booking_changes;
begin
  b := private.booking_by_token(p_token);
  select * into t from public.booking_types where id = b.type_id;
  select max(agreed_at) into last_agreed from public.rule_agreements where booking_id = b.id;
  select * into ch from public.booking_changes where booking_id = b.id and status = 'pending';
  return jsonb_build_object(
    'id', b.id,
    'token', b.token,
    'status', b.status,
    'name', b.name,
    'type', to_jsonb(t),
    'starts_at', b.starts_at,
    'ends_at', b.ends_at,
    'attendees', b.attendees,
    'answers', b.answers,
    'decision_note', case when b.status = 'denied' then b.decision_note end,
    'cancel_note', b.cancel_note,
    'healthy_at', b.healthy_at,
    'rules_complete', private.rules_complete(b.id),
    'answers_complete', private.answers_complete(b),
    'rules_reagree_needed', b.rules_reagree_needed,
    'max_people', (select max_people from public.capacity_groups where key = t.limit_group),
    'rules', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'title', r.title, 'body', r.body, 'kind', r.kind,
        'agreed', a.rule_id is not null and a.revision >= r.revision,
        'label', case
          when last_agreed is null then null
          when a.rule_id is null then 'New'
          when a.revision < r.revision then 'Updated' end
      ) order by r.position), '[]')
      from public.rules r
      left join public.rule_agreements a on a.rule_id = r.id and a.booking_id = b.id
      where r.active),
    'pending_change', case when ch.id is null then null else jsonb_build_object(
      'id', ch.id, 'proposed_by', case when ch.proposed_by = 'guest' then 'guest' else 'family' end,
      'starts_at', ch.starts_at, 'ends_at', ch.ends_at, 'attendees', ch.attendees, 'note', ch.note) end
  );
end $$;

create function public.agree_rule(p_token text, p_rule uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare b public.bookings; r public.rules;
begin
  b := private.booking_by_token(p_token);
  if b.status not in ('draft', 'submitted', 'approved') then
    raise exception 'This request is closed' using errcode = 'P0001';
  end if;
  select * into r from public.rules where id = p_rule and active;
  if not found then raise exception 'That rule has changed. Please reload the page.' using errcode = 'P0001'; end if;
  insert into public.rule_agreements (booking_id, rule_id, revision) values (b.id, r.id, r.revision)
  on conflict (booking_id, rule_id) do update set revision = excluded.revision, agreed_at = now();
  if b.rules_reagree_needed and private.rules_complete(b.id) then
    update public.bookings set rules_reagree_needed = false where id = b.id;
    perform private.log('visit.rules_reagreed', format('%s agreed to the updated rules', b.name),
                        jsonb_build_object('booking_id', b.id), 'guest: ' || b.name);
  end if;
end $$;

create function private.clean_attendees(p jsonb) returns jsonb
language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'name', trim(a ->> 'name'),
    'age', nullif(trim(coalesce(a ->> 'age', '')), ''),
    'relationship', trim(coalesce(a ->> 'relationship', ''))))), '[]')
  from jsonb_array_elements(coalesce(p, '[]')) a
  where trim(coalesce(a ->> 'name', '')) <> ''
$$;

create function public.save_visit_answers(p_token text, p_attendees jsonb, p_answers jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare b public.bookings; t public.booking_types; mx int; att jsonb := private.clean_attendees(p_attendees);
begin
  b := private.booking_by_token(p_token);
  if b.status not in ('draft', 'submitted') then
    raise exception 'This request can''t be edited anymore. You can propose a change instead.' using errcode = 'P0001';
  end if;
  select * into t from public.booking_types where id = b.type_id;
  select max_people into mx from public.capacity_groups where key = t.limit_group;
  if jsonb_array_length(att) > mx then
    raise exception '% allows up to % people. Please send a separate request for the rest of your group.', t.name, mx using errcode = 'P0001';
  end if;
  update public.bookings set attendees = att, answers = coalesce(p_answers, '{}') where id = b.id returning * into b;
  return jsonb_build_object('answers_complete', private.answers_complete(b));
end $$;

/** Approve if every needed vote is in. Returns true when it became approved. */
create function private.finalize_approval(p_booking uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare b public.bookings; t public.booking_types; needed int; votes int; wk date; n int; cap int := (private.setting('weekly_cap'))::int;
begin
  select * into b from public.bookings where id = p_booking for update;
  if b.status <> 'submitted' then return false; end if;
  select * into t from public.booking_types where id = b.type_id;
  needed := case when private.flag_count(b.visitor_id) = 1 then 3 else 1 end;
  select count(*) into votes from public.booking_approvals where booking_id = b.id;
  if needed = 1 then votes := greatest(votes, case when b.preapproved_by is not null then 1 else 0 end); end if;
  if votes < needed then return false; end if;
  -- In-home visits wait for an acknowledged Colorado trip.
  if b.type_id in (1, 2) and exists (
      select 1 from public.bookings tr where tr.visitor_id = b.visitor_id and tr.type_id = 3
        and tr.status in ('draft', 'submitted') and tr.starts_at < b.ends_at and tr.ends_at > b.starts_at) then
    raise exception 'This visit is during a Colorado trip that hasn''t been acknowledged yet. Acknowledge the trip first.' using errcode = 'P0001';
  end if;
  perform private.check_room(b);
  update public.bookings set status = 'approved', decided_at = now(),
         decided_by = coalesce(private.person(), b.preapproved_by)
   where id = b.id returning * into b;
  perform private.email_guest(case when t.approval = 'acknowledge' then 'visit_acknowledged' else 'visit_approved' end,
                              b.visitor_id, private.booking_vars(b));
  perform private.log(case when t.approval = 'acknowledge' then 'visit.acknowledged' else 'visit.approved' end,
                      format('%s %s: %s, %s', case when t.approval = 'acknowledge' then 'Acknowledged' else 'Approved' end,
                             b.name, t.name, private.fmt_range(b.starts_at, b.ends_at)),
                      jsonb_build_object('booking_id', b.id), coalesce(private.person(), b.preapproved_by));
  -- Let the family know when a week fills up.
  for wk in select private.weeks_between(b.starts_at, b.ends_at) loop
    n := cardinality(private.week_keys(wk));
    if n >= cap and not exists (select 1 from public.activity where action = 'week.full' and details ->> 'week' = wk::text) then
      perform private.email_family('family_week_full', jsonb_build_object('date', to_char(wk, 'FMMon FMDD')));
      perform private.log('week.full', format('The week of %s reached %s visitors', to_char(wk, 'FMMon FMDD'), cap),
                          jsonb_build_object('week', wk), 'system');
    end if;
  end loop;
  return true;
end $$;

create function public.submit_visit_request(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare b public.bookings; t public.booking_types; approved boolean := false; flagged boolean;
begin
  perform private.require_open_hours();
  b := private.booking_by_token(p_token);
  if b.status <> 'draft' then
    raise exception 'This request was already sent' using errcode = 'P0001';
  end if;
  perform private.require_not_banned(b.visitor_id);
  if not private.rules_complete(b.id) then raise exception 'Please agree to every rule first' using errcode = 'P0001'; end if;
  if not private.answers_complete(b) then raise exception 'Please answer every question first' using errcode = 'P0001'; end if;
  select * into t from public.booking_types where id = b.type_id;
  update public.bookings set status = 'submitted', submitted_at = now() where id = b.id returning * into b;
  flagged := private.flag_count(b.visitor_id) = 1;

  perform private.email_guest('visit_submitted', b.visitor_id, private.booking_vars(b));
  if flagged then
    perform private.email_family('family_flagged_request', private.booking_vars(b));
  elsif t.approval = 'acknowledge' then
    perform private.email_family('family_trip_submitted', private.booking_vars(b));
  else
    perform private.email_family('family_visit_ready', private.booking_vars(b));
  end if;
  perform private.log('visit.submitted', format('%s finished a request: %s, %s', b.name, t.name, private.fmt_range(b.starts_at, b.ends_at)),
                      jsonb_build_object('booking_id', b.id), 'guest: ' || b.name);

  -- A held (early) approval is released now that everything is finished.
  if b.preapproved_by is not null then
    begin
      approved := private.finalize_approval(b.id);
    exception when others then
      approved := false; -- stays orange; the family sees why on the dashboard
    end;
  end if;
  return jsonb_build_object('status', case when approved then 'approved' else 'submitted' end);
end $$;

create function public.confirm_healthy(p_token text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare b public.bookings;
begin
  b := private.booking_by_token(p_token);
  update public.bookings set healthy_at = now() where id = b.id;
  perform private.log('visit.healthy', format('%s confirmed everyone is healthy', b.name), jsonb_build_object('booking_id', b.id), 'guest: ' || b.name);
end $$;

/** Cancel (no new times) or shorten (new times inside the old ones). Either side; no approval needed. */
create function private.cancel_or_shorten(b public.bookings, p_starts_at timestamptz, p_ends_at timestamptz, p_note text, by_guest boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v jsonb; shortened boolean := p_starts_at is not null and p_ends_at is not null; actor text;
begin
  if b.id is null then raise exception 'Booking not found' using errcode = 'P0001'; end if;
  if b.status not in ('draft', 'submitted', 'approved') then
    raise exception 'This booking is already closed' using errcode = 'P0001';
  end if;
  actor := case when by_guest then 'guest: ' || b.name else private.person() end;
  if shortened then
    if p_starts_at < b.starts_at or p_ends_at > b.ends_at or p_ends_at <= p_starts_at
       or (p_starts_at = b.starts_at and p_ends_at = b.ends_at) then
      raise exception 'A shorter booking has to fit inside the original times' using errcode = 'P0001';
    end if;
    if extract(epoch from p_starts_at)::bigint % ((private.setting('increment_minutes'))::int * 60) <> 0
       or extract(epoch from p_ends_at)::bigint % ((private.setting('increment_minutes'))::int * 60) <> 0 then
      raise exception 'Times start and end on %-minute increments', private.setting('increment_minutes') using errcode = 'P0001';
    end if;
    perform private.check_hours(b.type_id, p_starts_at, p_ends_at);
    update public.bookings set starts_at = p_starts_at, ends_at = p_ends_at, cancel_note = nullif(trim(coalesce(p_note, '')), '')
     where id = b.id returning * into b;
  else
    update public.bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = actor,
           cancel_note = nullif(trim(coalesce(p_note, '')), '')
     where id = b.id returning * into b;
    update public.booking_changes set status = 'withdrawn', decided_at = now() where booking_id = b.id and status = 'pending';
  end if;
  v := private.booking_vars(b) || jsonb_build_object(
    'cancelled/shortened', case when shortened then 'shortened' else 'cancelled' end,
    'note', coalesce(nullif(trim(coalesce(p_note, '')), ''), 'none'));
  if by_guest then
    perform private.email_family('family_guest_cancelled', v);
    perform private.email_guest('visit_guest_cancelled', b.visitor_id, v);
  else
    perform private.email_guest('visit_family_cancelled', b.visitor_id, v);
  end if;
  perform private.log(case when shortened then 'visit.shortened' else 'visit.cancelled' end,
                      format('%s %s: %s', case when shortened then 'Shortened' else 'Cancelled' end, b.name, private.fmt_range(b.starts_at, b.ends_at)),
                      jsonb_build_object('booking_id', b.id, 'note', p_note), actor);
end $$;

create function public.cancel_visit(p_token text, p_note text default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin perform private.cancel_or_shorten(private.booking_by_token(p_token), null, null, p_note, true); end $$;

create function public.shorten_visit(p_token text, p_starts_at timestamptz, p_ends_at timestamptz, p_note text default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin perform private.cancel_or_shorten(private.booking_by_token(p_token), p_starts_at, p_ends_at, p_note, true); end $$;

/** Check a proposed change against hours, limits, and the cap, as if it were the booking. */
create function private.check_change(b public.bookings, s timestamptz, e timestamptz, att jsonb) returns void
language plpgsql stable security definer set search_path = '' as $$
declare tmp public.bookings := b;
begin
  perform private.check_window(b.type_id, s, e, null, b.id, s <> b.starts_at);
  tmp.starts_at := s; tmp.ends_at := e;
  if att is not null then
    tmp.attendees := private.clean_attendees(att);
    tmp.attendee_keys := coalesce((select array_agg(distinct private.name_key(a ->> 'name')) from jsonb_array_elements(tmp.attendees) a), '{}');
  end if;
  if b.status = 'approved' then perform private.check_room(tmp); end if;
end $$;

create function private.apply_change(c public.booking_changes) returns public.bookings
language plpgsql volatile security definer set search_path = '' as $$
declare b public.bookings;
begin
  update public.bookings set starts_at = c.starts_at, ends_at = c.ends_at,
         attendees = coalesce(private.clean_attendees(c.attendees), attendees),
         reminders_sent = '{}'
   where id = c.booking_id returning * into b;
  -- Re-check against the actual new state; any overflow rolls the whole thing back.
  if b.status = 'approved' then perform private.check_room(b); end if;
  return b;
end $$;

create function public.propose_visit_change(p_token text, p_starts_at timestamptz, p_ends_at timestamptz, p_attendees jsonb default null, p_note text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare b public.bookings; v jsonb;
begin
  perform private.require_open_hours();
  b := private.booking_by_token(p_token);
  if b.status not in ('submitted', 'approved') then
    raise exception 'Only a sent or approved request can be changed' using errcode = 'P0001';
  end if;
  perform private.require_not_banned(b.visitor_id);
  if exists (select 1 from public.booking_changes where booking_id = b.id and status = 'pending') then
    raise exception 'There''s already a change waiting for an answer' using errcode = 'P0001';
  end if;
  perform private.check_change(b, p_starts_at, p_ends_at, p_attendees);
  insert into public.booking_changes (booking_id, proposed_by, starts_at, ends_at, attendees, note)
  values (b.id, 'guest', p_starts_at, p_ends_at, p_attendees, nullif(trim(coalesce(p_note, '')), ''));
  v := private.booking_vars(b) || jsonb_build_object(
    'old', private.fmt_range(b.starts_at, b.ends_at),
    'new', private.fmt_range(p_starts_at, p_ends_at) ||
           case when p_attendees is not null then format(', %s people', jsonb_array_length(private.clean_attendees(p_attendees))) else '' end);
  perform private.email_family('family_change_requested', v);
  perform private.log('visit.change_requested', format('%s proposed a change: %s', b.name, v ->> 'new'),
                      jsonb_build_object('booking_id', b.id), 'guest: ' || b.name);
end $$;

/** The guest answers a change the family proposed. */
create function public.respond_visit_change(p_token text, p_accept boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare b public.bookings; c public.booking_changes;
begin
  b := private.booking_by_token(p_token);
  select * into c from public.booking_changes where booking_id = b.id and status = 'pending' and proposed_by <> 'guest';
  if not found then raise exception 'There''s no change waiting for you' using errcode = 'P0001'; end if;
  if p_accept then
    perform private.require_open_hours();
    b := private.apply_change(c);
  end if;
  update public.booking_changes set status = case when p_accept then 'accepted' else 'declined' end,
         decided_at = now(), decided_by = 'guest' where id = c.id;

  perform private.log(case when p_accept then 'visit.change_accepted' else 'visit.change_declined' end,
                      format('%s %s the family''s proposed change', b.name, case when p_accept then 'accepted' else 'declined' end),
                      jsonb_build_object('booking_id', b.id), 'guest: ' || b.name);
end $$;

-- ----------------------------------------------------------- family API

/**
 * Approve, deny, or acknowledge a visit request.
 * Admins approve and deny. For a once-flagged visitor, any of the four adds a vote; 3 approve it.
 */
create function public.family_decide_visit(p_booking uuid, p_decision text, p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare me text := private.require_family(); b public.bookings; t public.booking_types; flagged boolean; votes int; done boolean;
begin
  select * into b from public.bookings where id = p_booking for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0001'; end if;
  select * into t from public.booking_types where id = b.type_id;
  flagged := private.flag_count(b.visitor_id) = 1;
  if not private.is_admin() and not (flagged and p_decision = 'approve') then
    raise exception 'Only Gabriel or Micala can do that' using errcode = '42501';
  end if;
  if b.status not in ('draft', 'submitted') then raise exception 'This request was already decided' using errcode = 'P0001'; end if;

  if p_decision = 'deny' then
    update public.bookings set status = 'denied', decision_note = nullif(trim(coalesce(p_note, '')), ''),
           decided_by = me, decided_at = now() where id = b.id returning * into b;
    perform private.email_guest('visit_denied', b.visitor_id,
      private.booking_vars(b) || jsonb_build_object('note', coalesce(b.decision_note, 'none')));
    perform private.log('visit.denied', format('Denied %s: %s, %s', b.name, t.name, private.fmt_range(b.starts_at, b.ends_at)),
                        jsonb_build_object('booking_id', b.id, 'note', p_note));
    return jsonb_build_object('status', 'denied');
  end if;

  if p_decision not in ('approve', 'acknowledge') then raise exception 'Unknown decision' using errcode = 'P0001'; end if;
  if b.status = 'submitted' then perform private.check_room(b); end if;
  insert into public.booking_approvals (booking_id, person) values (b.id, me) on conflict do nothing;
  select count(*) into votes from public.booking_approvals where booking_id = b.id;

  if b.status = 'draft' then
    -- Held until the guest finishes the rules and questions.
    update public.bookings set preapproved_by = coalesce(preapproved_by, me), preapproved_at = coalesce(preapproved_at, now()) where id = b.id;
    perform private.log('visit.preapproved', format('Approved %s early; held until they finish', b.name), jsonb_build_object('booking_id', b.id));
    return jsonb_build_object('status', 'held', 'votes', votes, 'needed', case when flagged then 3 else 1 end);
  end if;

  done := private.finalize_approval(b.id);
  if not done then
    perform private.log('visit.vote', format('Voted to approve %s (%s of 3)', b.name, votes), jsonb_build_object('booking_id', b.id));
  end if;
  return jsonb_build_object('status', case when done then 'approved' else 'waiting' end, 'votes', votes, 'needed', case when flagged then 3 else 1 end);
end $$;

create function public.family_cancel_visit(p_booking uuid, p_note text default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare b public.bookings;
begin
  perform private.require_admin();
  select * into b from public.bookings where id = p_booking;
  perform private.cancel_or_shorten(b, null, null, p_note, false);
end $$;

create function public.family_shorten_visit(p_booking uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_note text default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare b public.bookings;
begin
  perform private.require_admin();
  select * into b from public.bookings where id = p_booking;
  perform private.cancel_or_shorten(b, p_starts_at, p_ends_at, p_note, false);
end $$;

create function public.family_propose_change(p_booking uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_attendees jsonb default null, p_note text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare me text := private.require_admin(); b public.bookings;
begin
  select * into b from public.bookings where id = p_booking;
  if b.status not in ('submitted', 'approved') then raise exception 'Only a sent or approved request can be changed' using errcode = 'P0001'; end if;
  if exists (select 1 from public.booking_changes where booking_id = b.id and status = 'pending') then
    raise exception 'There''s already a change waiting for an answer' using errcode = 'P0001';
  end if;
  perform private.check_change(b, p_starts_at, p_ends_at, p_attendees);
  insert into public.booking_changes (booking_id, proposed_by, starts_at, ends_at, attendees, note)
  values (b.id, me, p_starts_at, p_ends_at, p_attendees, nullif(trim(coalesce(p_note, '')), ''));
  perform private.email_guest('visit_family_proposes', b.visitor_id, private.booking_vars(b) || jsonb_build_object(
    'new details', private.fmt_range(p_starts_at, p_ends_at), 'note', coalesce(nullif(trim(coalesce(p_note, '')), ''), 'none')));
  perform private.log('visit.change_proposed', format('Proposed a change to %s''s booking: %s', b.name, private.fmt_range(p_starts_at, p_ends_at)),
                      jsonb_build_object('booking_id', b.id));
end $$;

/** An Admin answers a change the guest proposed. */
create function public.family_respond_change(p_change uuid, p_accept boolean, p_note text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare me text := private.require_admin(); c public.booking_changes; b public.bookings; v jsonb;
begin
  select * into c from public.booking_changes where id = p_change and status = 'pending' and proposed_by = 'guest';
  if not found then raise exception 'That change isn''t waiting anymore' using errcode = 'P0001'; end if;
  select * into b from public.bookings where id = c.booking_id;
  if p_accept then b := private.apply_change(c); end if;
  update public.booking_changes set status = case when p_accept then 'accepted' else 'declined' end,
         decided_at = now(), decided_by = me, decision_note = nullif(trim(coalesce(p_note, '')), '') where id = c.id;
  v := private.booking_vars(b) || jsonb_build_object('new details', private.fmt_range(b.starts_at, b.ends_at),
                                                    'note', coalesce(nullif(trim(coalesce(p_note, '')), ''), 'none'));
  perform private.email_guest(case when p_accept then 'visit_change_approved' else 'visit_change_declined' end, b.visitor_id, v);
  perform private.log(case when p_accept then 'visit.change_approved' else 'visit.change_declined' end,
                      format('%s %s''s change', case when p_accept then 'Approved' else 'Declined' end, b.name),
                      jsonb_build_object('booking_id', b.id, 'change_id', c.id));
end $$;

-- ------------------------------------------------------------- flagging

create function public.flag_visitor(p_visitor uuid, p_note text, p_booking uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare me text := private.require_family(); v public.visitors; n int; b public.bookings;
begin
  if coalesce(trim(p_note), '') = '' then raise exception 'Please add a note explaining why' using errcode = 'P0001'; end if;
  select * into v from public.visitors where id = p_visitor;
  if not found then raise exception 'Visitor not found' using errcode = 'P0001'; end if;
  insert into public.flags (visitor_id, flagged_by, note, booking_id) values (v.id, me, trim(p_note), p_booking);
  n := private.flag_count(v.id);
  if n = 2 then
    update public.visitors set banned_until = now() + interval '30 days' where id = v.id;
    for b in select * from public.bookings where visitor_id = v.id and status in ('draft', 'submitted', 'approved') and ends_at > now() loop
      update public.bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = me, cancel_note = 'Cancelled automatically' where id = b.id;
    end loop;
    if found then perform private.email_guest('visitor_second_flag', v.id, '{}'); end if;
  elsif n >= 3 then
    update public.visitors set banned_forever = true where id = v.id;
    update public.bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = me, cancel_note = 'Cancelled automatically'
     where visitor_id = v.id and status in ('draft', 'submitted', 'approved') and ends_at > now();
  end if;
  perform private.email_family('family_visitor_flagged', jsonb_build_object(
    'flagger', (select display_name from public.family where person = me), 'name', v.name, 'number', n, 'note', trim(p_note)));
  perform private.log('visitor.flagged', format('Flagged %s (flag %s)', v.name, n), jsonb_build_object('visitor_id', v.id, 'note', p_note));
  return jsonb_build_object('flag_count', n);
end $$;

create function public.remove_flag(p_flag uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me text := private.require_admin(); f public.flags; n int;
begin
  update public.flags set removed_at = now(), removed_by = me where id = p_flag and removed_at is null returning * into f;
  if not found then raise exception 'Flag not found' using errcode = 'P0001'; end if;
  n := private.flag_count(f.visitor_id);
  update public.visitors set
    banned_forever = banned_forever and n >= 3,
    banned_until = case when n >= 2 then banned_until end
  where id = f.visitor_id;
  perform private.log('visitor.flag_removed', format('Removed a flag from %s (now %s)', (select name from public.visitors where id = f.visitor_id), n),
                      jsonb_build_object('visitor_id', f.visitor_id, 'flag_id', f.id));
end $$;

-- ----------------------------------------------------------------- pause

create table public.pause_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by text not null references public.family,
  requested_at timestamptz not null default now(),
  confirmed_by text references public.family,
  confirmed_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'withdrawn'))
);
alter table public.pause_requests enable row level security;
create policy "family reads pause requests" on public.pause_requests for select using (private.is_family());

/** Ask to pause, or confirm someone else's request. Two of the four turn the pause on. */
create function public.request_pause() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare me text := private.require_family(); pr public.pause_requests;
begin
  if private.is_paused() then return jsonb_build_object('paused', true); end if;
  select * into pr from public.pause_requests where status = 'pending' and requested_at > now() - interval '1 day'
   order by requested_at desc limit 1 for update;
  if found and pr.requested_by <> me then
    update public.pause_requests set status = 'confirmed', confirmed_by = me, confirmed_at = now() where id = pr.id;
    update public.settings set value = 'true' where key = 'paused';
    perform private.email_family('family_pause_changed', jsonb_build_object('paused/open again', 'paused'));
    perform private.log('pause.on', 'Turned on the site-wide pause', jsonb_build_object('requested_by', pr.requested_by));
    return jsonb_build_object('paused', true);
  end if;
  if found then return jsonb_build_object('paused', false, 'waiting', true); end if;
  insert into public.pause_requests (requested_by) values (me);
  perform private.email_family('family_pause_requested', jsonb_build_object(
    'requester', (select display_name from public.family where person = me),
    'link', private.site_url() || '/family/'), array['admin', 'elevated'], true);
  perform private.log('pause.requested', 'Asked to pause all bookings');
  return jsonb_build_object('paused', false, 'waiting', true);
end $$;

create function public.end_pause() returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update public.settings set value = 'false' where key = 'paused';
  update public.pause_requests set status = 'withdrawn' where status = 'pending';
  perform private.email_family('family_pause_changed', jsonb_build_object('paused/open again', 'open again'));
  perform private.log('pause.off', 'Turned off the site-wide pause');
end $$;

-- ---------------------------------------------------- rules changed later

/** When rule wording changes, every upcoming approved guest re-agrees. */
create function private.rules_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  update public.settings set value = to_jsonb(now()) where key = 'rules_updated_at';
  if private.person() is null then return null; end if;
  for b in select * from public.bookings where status = 'approved' and starts_at > now() and not rules_reagree_needed loop
    if not private.rules_complete(b.id) then
      update public.bookings set rules_reagree_needed = true where id = b.id;
      perform private.email_guest('visit_rules_updated', b.visitor_id,
        private.booking_vars(b) || jsonb_build_object('updated', private.fmt_date(now())));
    end if;
  end loop;
  return null;
end $$;
create trigger rules_changed after insert or update or delete on public.rules for each statement execute function private.rules_changed();
