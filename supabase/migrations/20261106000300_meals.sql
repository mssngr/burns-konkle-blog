-- Meal Train: drop-offs in the cooler out front, one person per slot.

create table public.meal_dates (
  date date primary key,
  created_by text,
  created_at timestamptz not null default now()
);
alter table public.meal_dates enable row level security;
create policy "anyone reads meal dates" on public.meal_dates for select using (true);
create policy "admins manage meal dates" on public.meal_dates for all using (private.is_admin()) with check (private.is_admin());
create trigger meal_dates_log after insert or delete on public.meal_dates for each row execute function private.log_config_change();

create table public.meal_signups (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default private.random_token(),
  date date not null,
  slot_key text not null,
  visitor_id uuid not null references public.visitors,
  name text not null,
  -- draft = yellow (not confirmed), submitted = orange (confirmed, waiting), approved = purple
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'denied', 'cancelled', 'expired')),
  dish text,
  dietary_ok boolean not null default false,
  decision_note text,
  decided_by text,
  decided_at timestamptz,
  cancel_note text,
  cancelled_by text,
  cancelled_at timestamptz,
  offer_id uuid,
  reminders_sent text[] not null default '{}',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
alter table public.meal_signups enable row level security;
create unique index one_meal_per_slot on public.meal_signups (date, slot_key) where status in ('draft', 'submitted', 'approved');
create policy "family reads meal signups" on public.meal_signups for select using (private.is_family());

create function private.meal_slot(k text) returns jsonb
language sql stable as $$
  select s from jsonb_array_elements(private.setting('meal_slots')) s where s ->> 'key' = k
$$;

create function private.meal_start(d date, k text) returns timestamptz
language sql stable as $$ select (d + (private.meal_slot(k) ->> 'start')::time) at time zone private.tz() $$;

create function private.meal_end(d date, k text) returns timestamptz
language sql stable as $$ select (d + (private.meal_slot(k) ->> 'end')::time) at time zone private.tz() $$;

create function private.meal_vars(m public.meal_signups) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'name', m.name,
    'first name', private.first_name(m.name),
    'slot', private.meal_slot(m.slot_key) ->> 'label',
    'date', private.fmt_date(private.meal_start(m.date, m.slot_key)),
    'time window', private.fmt_time(private.meal_start(m.date, m.slot_key)) || '–' || private.fmt_time(private.meal_end(m.date, m.slot_key)),
    'dish', coalesce(m.dish, 'a meal'),
    'dietary needs', private.setting('dietary_summary') #>> '{}',
    'link', private.site_url() || '/meals/signup/?t=' || m.token,
    'family link', private.site_url() || '/family/meals/?id=' || m.id)
$$;

/** Public Meal Train calendar. The name shows only on approved slots. */
create function public.meal_calendar(p_from date, p_days int default 14) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare out jsonb := '[]'; d date; s jsonb; m public.meal_signups; st text; why text; st_ts timestamptz; en_ts timestamptz;
begin
  p_days := least(greatest(p_days, 1), 62);
  for d in select generate_series(p_from, p_from + p_days - 1, interval '1 day')::date loop
    for s in select * from jsonb_array_elements(private.setting('meal_slots')) loop
      st_ts := private.meal_start(d, s ->> 'key');
      en_ts := private.meal_end(d, s ->> 'key');
      select * into m from public.meal_signups where date = d and slot_key = s ->> 'key' and status in ('draft', 'submitted', 'approved');
      why := null;
      if private.is_paused() then why := 'paused';
      elsif not exists (select 1 from public.meal_dates where date = d) then why := 'not_open';
      elsif private.is_blocked('meals', st_ts, en_ts) then why := 'blocked';
      elsif st_ts <= now() and m.id is null then why := 'past';
      end if;
      st := case
        when m.status = 'approved' then 'purple'
        when why is not null then 'red'
        when m.status = 'submitted' then 'orange'
        when m.status = 'draft' then 'yellow'
        else 'green' end;
      -- Red outranks everything except a booked slot that already happened or is locked in.
      if why in ('paused', 'blocked') and m.status <> 'approved' then st := 'red'; end if;
      out := out || jsonb_build_object('date', d, 'slot', s ->> 'key', 'label', s ->> 'label',
        'start', st_ts, 'end', en_ts, 's', st, 'r', why,
        'name', case when m.status = 'approved' then m.name end);
    end loop;
  end loop;
  return jsonb_build_object('slots', out, 'paused', private.is_paused(), 'blackout', private.in_blackout());
end $$;

create function private.meal_by_token(p_token text) returns public.meal_signups
language plpgsql stable security definer set search_path = '' as $$
declare m public.meal_signups;
begin
  select * into m from public.meal_signups where token = p_token;
  if not found then raise exception 'We couldn''t find that sign-up. Please check your link.' using errcode = 'P0001'; end if;
  return m;
end $$;

create function public.create_meal_signup(p_date date, p_slot text, p_name text, p_email text, p_phone text default null,
                                          p_consent boolean default false, p_offer_token text default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare vid uuid; m public.meal_signups; oid uuid;
begin
  perform private.require_open_hours();
  if not coalesce(p_consent, false) then
    raise exception 'Please agree to receive emails about your sign-up' using errcode = 'P0001';
  end if;
  if private.meal_slot(p_slot) is null then raise exception 'Please pick a slot' using errcode = 'P0001'; end if;
  if private.is_paused() then raise exception 'Sign-ups are paused right now. Please check back soon.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.meal_dates where date = p_date) then
    raise exception 'That date isn''t open for meals' using errcode = 'P0001';
  end if;
  if private.meal_start(p_date, p_slot) <= now() then raise exception 'That slot has already started' using errcode = 'P0001'; end if;
  if private.is_blocked('meals', private.meal_start(p_date, p_slot), private.meal_end(p_date, p_slot)) then
    raise exception 'That slot isn''t available' using errcode = 'P0001';
  end if;
  vid := private.upsert_visitor(p_name, p_email, p_phone, p_consent);
  perform private.require_not_banned(vid);
  if p_offer_token is not null then select id into oid from public.offers where token = p_offer_token; end if;
  begin
    insert into public.meal_signups (date, slot_key, visitor_id, name, offer_id)
    values (p_date, p_slot, vid, trim(p_name), oid) returning * into m;
  exception when unique_violation then
    raise exception 'Someone just took that slot. Please pick another.' using errcode = 'P0001';
  end;
  perform private.email_guest('meal_signup', vid, private.meal_vars(m));
  perform private.email_family('family_meal_signup', private.meal_vars(m));
  perform private.log('meal.signup', format('%s signed up for %s, %s', m.name, private.meal_vars(m) ->> 'slot', private.meal_vars(m) ->> 'date'),
                      jsonb_build_object('meal_id', m.id), 'guest: ' || m.name);
  return jsonb_build_object('token', m.token);
end $$;

create function public.get_meal_signup(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m public.meal_signups;
begin
  m := private.meal_by_token(p_token);
  return jsonb_build_object(
    'id', m.id, 'token', m.token, 'status', m.status, 'name', m.name, 'date', m.date, 'slot', m.slot_key,
    'label', private.meal_slot(m.slot_key) ->> 'label',
    'start', private.meal_start(m.date, m.slot_key), 'end', private.meal_end(m.date, m.slot_key),
    'dish', m.dish, 'dietary_ok', m.dietary_ok,
    'decision_note', case when m.status = 'denied' then m.decision_note end,
    'expires_at', case when m.status = 'draft' then least(
       m.created_at + make_interval(hours => (private.setting('meal_confirm_hours'))::int),
       private.meal_start(m.date, m.slot_key)) end);
end $$;

create function public.confirm_meal_signup(p_token text, p_dish text, p_dietary_ok boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare m public.meal_signups;
begin
  perform private.require_open_hours();
  m := private.meal_by_token(p_token);
  if m.status <> 'draft' then raise exception 'This sign-up was already confirmed or closed' using errcode = 'P0001'; end if;
  if coalesce(trim(p_dish), '') = '' then raise exception 'Please tell us what you''ll bring' using errcode = 'P0001'; end if;
  if not coalesce(p_dietary_ok, false) then raise exception 'Please confirm it follows the dietary needs' using errcode = 'P0001'; end if;
  update public.meal_signups set status = 'submitted', dish = trim(p_dish), dietary_ok = true, confirmed_at = now()
   where id = m.id returning * into m;
  perform private.email_family('family_meal_confirmed', private.meal_vars(m));
  perform private.log('meal.confirmed', format('%s confirmed %s for %s', m.name, m.dish, private.meal_vars(m) ->> 'date'),
                      jsonb_build_object('meal_id', m.id), 'guest: ' || m.name);
end $$;

create function private.cancel_meal(m public.meal_signups, p_note text, by_guest boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v jsonb; actor text := case when by_guest then 'guest: ' || m.name else private.person() end;
begin
  if m.id is null then raise exception 'Sign-up not found' using errcode = 'P0001'; end if;
  if m.status not in ('draft', 'submitted', 'approved') then raise exception 'This sign-up is already closed' using errcode = 'P0001'; end if;
  update public.meal_signups set status = 'cancelled', cancelled_at = now(), cancelled_by = actor,
         cancel_note = nullif(trim(coalesce(p_note, '')), '') where id = m.id returning * into m;
  v := private.meal_vars(m) || jsonb_build_object('note', coalesce(m.cancel_note, 'none'));
  if by_guest then
    perform private.email_family('family_meal_cancelled', v);
    perform private.email_guest('meal_guest_cancelled', m.visitor_id, v);
  else
    perform private.email_guest('meal_family_cancelled', m.visitor_id, v);
  end if;
  perform private.log('meal.cancelled', format('Cancelled %s''s Meal Train slot: %s, %s', m.name, v ->> 'slot', v ->> 'date'),
                      jsonb_build_object('meal_id', m.id, 'note', p_note), actor);
end $$;

create function public.cancel_meal_signup(p_token text, p_note text default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin perform private.cancel_meal(private.meal_by_token(p_token), p_note, true); end $$;

/** Any of the four approves or denies a confirmed sign-up. */
create function public.family_decide_meal(p_meal uuid, p_approve boolean, p_note text default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me text := private.require_family(); m public.meal_signups;
begin
  select * into m from public.meal_signups where id = p_meal for update;
  if not found or m.status not in ('draft', 'submitted') then raise exception 'This sign-up isn''t waiting' using errcode = 'P0001'; end if;
  if p_approve and m.status <> 'submitted' then
    raise exception 'Wait until they confirm what they''ll bring' using errcode = 'P0001';
  end if;
  update public.meal_signups set status = case when p_approve then 'approved' else 'denied' end,
         decision_note = nullif(trim(coalesce(p_note, '')), ''), decided_by = me, decided_at = now()
   where id = m.id returning * into m;
  perform private.email_guest(case when p_approve then 'meal_approved' else 'meal_denied' end, m.visitor_id,
                              private.meal_vars(m) || jsonb_build_object('note', coalesce(m.decision_note, 'none')));
  perform private.log(case when p_approve then 'meal.approved' else 'meal.denied' end,
                      format('%s %s''s Meal Train slot: %s, %s', case when p_approve then 'Approved' else 'Denied' end,
                             m.name, private.meal_vars(m) ->> 'slot', private.meal_vars(m) ->> 'date'),
                      jsonb_build_object('meal_id', m.id, 'note', p_note));
end $$;

create function public.family_cancel_meal(p_meal uuid, p_note text default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare m public.meal_signups;
begin
  perform private.require_family();
  select * into m from public.meal_signups where id = p_meal;
  perform private.cancel_meal(m, p_note, false);
end $$;
