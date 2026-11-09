-- Shorter "no room" errors. A guest proposing a change used to see the
-- family-facing "Approving this would put N people over the limit... Deny it
-- with a note instead." Guests now get a plain message; the family's is shorter.

create or replace function private.check_room(b public.bookings) returns void
language plpgsql stable security definer set search_path = '' as $$
declare g public.capacity_groups; wk date; n int; cap int := (private.setting('weekly_cap'))::int;
begin
  for g in select * from public.capacity_groups where b.type_id = any (type_ids) loop
    n := private.peak(g.key, b.starts_at, b.ends_at, b.attendee_keys, b.id);
    if n > g.max_people then
      raise exception 'Over the limit: % people at once (max %). Deny it with a note.', n, g.max_people
        using errcode = 'P0001', hint = 'over_limit';
    end if;
  end loop;
  for wk in select private.weeks_between(b.starts_at, b.ends_at) loop
    select count(*) into n from (
      select unnest(private.week_keys(wk, b.id)) union select unnest(b.attendee_keys)) u;
    if n > cap then
      raise exception 'The week of % would pass % visitors. Deny it with a note.', to_char(wk, 'FMMon FMDD'), cap
        using errcode = 'P0001', hint = 'over_cap';
    end if;
  end loop;
end $$;

create or replace function private.check_change(b public.bookings, s timestamptz, e timestamptz, att jsonb) returns void
language plpgsql stable security definer set search_path = '' as $$
declare tmp public.bookings := b;
begin
  perform private.check_window(b.type_id, s, e, null, b.id, s <> b.starts_at);
  tmp.starts_at := s; tmp.ends_at := e;
  if att is not null then
    tmp.attendees := private.clean_attendees(att);
    tmp.attendee_keys := coalesce((select array_agg(distinct private.name_key(a ->> 'name')) from jsonb_array_elements(tmp.attendees) a), '{}');
  end if;
  if b.status = 'approved' then
    begin
      perform private.check_room(tmp);
    exception when sqlstate 'P0001' then
      raise exception 'There isn''t room for that change. Please try other times or fewer people.' using errcode = 'P0001';
    end;
  end if;
end $$;
