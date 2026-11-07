-- The family dashboard, scheduled jobs (expiry + reminders), and email delivery.

-- ------------------------------------------------------------- dashboard

create function public.family_dashboard() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me text := private.require_family();
  wk date := private.week_start(now());
begin
  return jsonb_build_object(
    'me', me,
    'role', private.role(),
    'paused', private.is_paused(),
    'pause_request', (select to_jsonb(p) from public.pause_requests p where status = 'pending' and requested_at > now() - interval '1 day' order by requested_at desc limit 1),
    'week', jsonb_build_object('start', wk, 'count', cardinality(private.week_keys(wk)), 'cap', (private.setting('weekly_cap'))::int),
    'visits', (
      select coalesce(jsonb_agg(x order by x.ord, x.starts_at), '[]') from (
        select b.id, b.name, b.status, b.type_id, t.name as type_name, t.approval, b.starts_at, b.ends_at, b.headcount, b.attendees, b.answers,
               b.visitor_id, b.preapproved_by, b.submitted_at, b.created_at,
               private.flag_count(b.visitor_id) as flags,
               (select coalesce(jsonb_agg(person), '[]') from public.booking_approvals a where a.booking_id = b.id) as votes,
               private.rules_complete(b.id) as rules_complete,
               private.answers_complete(b) as answers_complete,
               case b.status when 'submitted' then 0 else 1 end as ord
        from public.bookings b join public.booking_types t on t.id = b.type_id
        where b.status in ('submitted', 'draft') and b.ends_at > now()) x),
    'changes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'booking_id', b.id, 'name', b.name, 'type_name', t.name, 'proposed_by', c.proposed_by,
        'old_starts_at', b.starts_at, 'old_ends_at', b.ends_at, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
        'attendees', c.attendees, 'note', c.note, 'created_at', c.created_at) order by c.created_at), '[]')
      from public.booking_changes c join public.bookings b on b.id = c.booking_id join public.booking_types t on t.id = b.type_id
      where c.status = 'pending'),
    'meals', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'name', m.name, 'status', m.status, 'date', m.date, 'slot', m.slot_key,
        'label', private.meal_slot(m.slot_key) ->> 'label', 'start', private.meal_start(m.date, m.slot_key),
        'dish', m.dish, 'created_at', m.created_at) order by private.meal_start(m.date, m.slot_key)), '[]')
      from public.meal_signups m where m.status in ('draft', 'submitted')),
    'replies', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'offer_id', o.id, 'name', o.name, 'body', r.body, 'drafted_by', r.drafted_by, 'created_at', r.created_at,
        'approvals', (select coalesce(jsonb_agg(person), '[]') from public.offer_reply_approvals a where a.reply_id = r.id)) order by r.created_at), '[]')
      from public.offer_replies r join public.offers o on o.id = r.offer_id where r.status = 'pending'),
    'offers_new', (
      select count(*) from public.offers o where not exists (select 1 from public.offer_replies r where r.offer_id = o.id and r.status <> 'withdrawn')),
    'notes', (
      select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'name', n.name, 'body', n.body, 'photos', n.photos, 'created_at', n.created_at) order by n.created_at), '[]')
      from public.notes n where n.status = 'pending'),
    'help', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'help_description', e.help_description, 'claimed_by', e.claimed_by) order by e.starts_at), '[]')
      from public.schedule_entries e where e.help_needed and coalesce(e.ends_at, e.starts_at) > now()),
    'reagree', (
      select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'starts_at', b.starts_at, 'type_name', t.name) order by b.starts_at), '[]')
      from public.bookings b join public.booking_types t on t.id = b.type_id
      where b.status = 'approved' and b.rules_reagree_needed and b.starts_at > now()),
    'upcoming', (
      select coalesce(jsonb_agg(u order by u.starts_at), '[]') from (
        select 'visit' as kind, b.id, b.name, t.name as what, b.starts_at, b.ends_at, b.headcount, b.healthy_at
        from public.bookings b join public.booking_types t on t.id = b.type_id
        where b.status = 'approved' and b.ends_at > now() and b.starts_at < now() + interval '7 days'
        union all
        select 'meal', m.id, m.name, coalesce(m.dish, 'Meal') || ' (' || (private.meal_slot(m.slot_key) ->> 'label') || ')',
               private.meal_start(m.date, m.slot_key), private.meal_end(m.date, m.slot_key), 1, null
        from public.meal_signups m
        where m.status = 'approved' and private.meal_end(m.date, m.slot_key) > now()
          and private.meal_start(m.date, m.slot_key) < now() + interval '7 days') u)
  );
end $$;

/** Before wider sharing: clear the family's fake bookings, sign-ups, offers and notes. */
create function public.family_clear_test_data() returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  delete from public.bookings;
  delete from public.meal_signups;
  delete from public.offers;
  delete from public.notes;
  delete from public.outbox;
  delete from public.flags;
  delete from public.visitors v where not exists (select 1 from public.flags f where f.visitor_id = v.id);
  perform private.log('settings.clear_test_data', 'Cleared test bookings, sign-ups, offers, notes and emails');
end $$;

-- ---------------------------------------------------------- scheduler

/** Of the reminders that are due and not sent, send only the closest one (no flood when booked late). */
create function private.due_reminder(starts timestamptz, reminders jsonb, sent text[]) returns jsonb
language sql stable as $$
  select r from jsonb_array_elements(reminders) r
  where now() >= starts - make_interval(mins => (r ->> 'minutes')::int)
    and not (r ->> 'template') = any (sent)
  order by (r ->> 'minutes')::int asc limit 1
$$;

create function private.due_templates(starts timestamptz, reminders jsonb) returns text[]
language sql stable as $$
  select coalesce(array_agg(r ->> 'template'), '{}') from jsonb_array_elements(reminders) r
  where now() >= starts - make_interval(mins => (r ->> 'minutes')::int)
$$;

create function private.run_scheduler() returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  b public.bookings;
  m public.meal_signups;
  r jsonb;
  expiry interval := make_interval(hours => (private.setting('incomplete_expiry_hours'))::int);
  remind interval := make_interval(hours => (private.setting('incomplete_reminder_hours'))::int);
  cutoff interval := make_interval(hours => (private.setting('cutoff_hours'))::int);
  meal_hold interval := make_interval(hours => (private.setting('meal_confirm_hours'))::int);
begin
  -- Unfinished visit requests expire after 24 hours, or at the 3-hour cutoff.
  for b in update public.bookings set status = 'expired'
           where status = 'draft' and (created_at + expiry <= now() or starts_at - cutoff <= now())
           returning * loop
    perform private.email_guest('visit_expired', b.visitor_id,
      private.booking_vars(b) || jsonb_build_object('link', private.site_url() || '/visits/'));
    perform private.log('visit.expired', format('%s''s unfinished request expired', b.name), jsonb_build_object('booking_id', b.id), 'system');
  end loop;

  -- One reminder for unfinished requests.
  for b in update public.bookings set incomplete_reminded_at = now()
           where status = 'draft' and incomplete_reminded_at is null and created_at + remind <= now()
           returning * loop
    perform private.email_guest('visit_incomplete_reminder', b.visitor_id, private.booking_vars(b));
  end loop;

  -- Reminders before approved visits (not Colorado trips themselves).
  for b in select * from public.bookings where status = 'approved' and type_id <> 3 and starts_at > now()
             and starts_at < now() + interval '8 days' loop
    r := private.due_reminder(b.starts_at, private.setting('visit_reminders'), b.reminders_sent);
    if r is not null then
      update public.bookings set reminders_sent = (
        select array_agg(distinct x) from unnest(reminders_sent || private.due_templates(b.starts_at, private.setting('visit_reminders'))) x)
       where id = b.id;
      perform private.email_guest(r ->> 'template', b.visitor_id, private.booking_vars(b));
    end if;
  end loop;

  -- Unconfirmed Meal Train sign-ups expire after 24 hours, or when the slot starts.
  for m in update public.meal_signups set status = 'expired'
           where status = 'draft' and (created_at + meal_hold <= now() or private.meal_start(date, slot_key) <= now())
           returning * loop
    perform private.email_guest('meal_expired', m.visitor_id,
      private.meal_vars(m) || jsonb_build_object('link', private.site_url() || '/meals/'));
    perform private.log('meal.expired', format('%s''s Meal Train sign-up expired', m.name), jsonb_build_object('meal_id', m.id), 'system');
  end loop;

  -- Meal Train reminders.
  for m in select * from public.meal_signups where status = 'approved'
             and private.meal_start(date, slot_key) > now() and date <= (now() + interval '8 days')::date loop
    r := private.due_reminder(private.meal_start(m.date, m.slot_key), private.setting('meal_reminders'), m.reminders_sent);
    if r is not null then
      update public.meal_signups set reminders_sent = (
        select array_agg(distinct x) from unnest(reminders_sent || private.due_templates(private.meal_start(m.date, m.slot_key), private.setting('meal_reminders'))) x)
       where id = m.id;
      perform private.email_guest(r ->> 'template', m.visitor_id, private.meal_vars(m));
    end if;
  end loop;

  -- Old, unconfirmed pause requests lapse.
  update public.pause_requests set status = 'withdrawn' where status = 'pending' and requested_at < now() - interval '1 day';
end $$;

-- ------------------------------------------------------------- delivery

-- Server-only config for calling the email function. Not exposed through the API.
create table private.config (key text primary key, value text not null);
insert into private.config (key, value) values
  -- Local default: the API gateway inside the Docker network. In production set this to
  -- https://<project-ref>.supabase.co/functions/v1/send-outbox (see README).
  ('send_outbox_url', 'http://kong:8000/functions/v1/send-outbox'),
  ('cron_secret', encode(extensions.gen_random_bytes(24), 'hex'));
revoke all on private.config from anon, authenticated;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create function private.kick_outbox() returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if exists (select 1 from public.outbox where status = 'queued') then
    perform net.http_post(
      url := (select value from private.config where key = 'send_outbox_url'),
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-cron-secret', (select value from private.config where key = 'cron_secret')),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000);
  end if;
end $$;

/** Called by the send-outbox function (service role) to check the shared secret. */
create function public.outbox_secret_ok(p_secret text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.config where key = 'cron_secret' and value = p_secret)
$$;
revoke execute on function public.outbox_secret_ok(text) from public, anon, authenticated;

select cron.schedule('bk-scheduler', '* * * * *', 'select private.run_scheduler(); select private.kick_outbox();');
