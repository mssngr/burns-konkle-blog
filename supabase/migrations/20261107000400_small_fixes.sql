-- Small fixes found in pre-launch testing:
--  * "1 people" in change-request emails and the activity log
--  * a proposed change identical to the current booking is rejected
--  * notes require the email consent box, like every other guest form

create or replace function public.propose_visit_change(p_token text, p_starts_at timestamptz, p_ends_at timestamptz, p_attendees jsonb default null, p_note text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare b public.bookings; v jsonb; n int;
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
  if p_starts_at = b.starts_at and p_ends_at = b.ends_at
     and (p_attendees is null or private.clean_attendees(p_attendees) = b.attendees) then
    raise exception 'That is the same as your current booking. Change the time or who''s coming first' using errcode = 'P0001';
  end if;
  perform private.check_change(b, p_starts_at, p_ends_at, p_attendees);
  insert into public.booking_changes (booking_id, proposed_by, starts_at, ends_at, attendees, note)
  values (b.id, 'guest', p_starts_at, p_ends_at, p_attendees, nullif(trim(coalesce(p_note, '')), ''));
  n := case when p_attendees is not null then jsonb_array_length(private.clean_attendees(p_attendees)) end;
  v := private.booking_vars(b) || jsonb_build_object(
    'old', private.fmt_range(b.starts_at, b.ends_at),
    'new', private.fmt_range(p_starts_at, p_ends_at) ||
           case when n is not null then format(', %s %s', n, case when n = 1 then 'person' else 'people' end) else '' end);
  perform private.email_family('family_change_requested', v);
  perform private.log('visit.change_requested', format('%s proposed a change: %s', b.name, v ->> 'new'),
                      jsonb_build_object('booking_id', b.id), 'guest: ' || b.name);
end $$;

create or replace function public.submit_note(p_name text, p_email text, p_phone text, p_consent boolean, p_body text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare vid uuid; n public.notes;
begin
  if coalesce(trim(p_body), '') = '' then raise exception 'Please write a note' using errcode = 'P0001'; end if;
  if not coalesce(p_consent, false) then raise exception 'Please agree to receive emails about your note' using errcode = 'P0001'; end if;
  vid := private.upsert_visitor(p_name, p_email, p_phone, p_consent);
  insert into public.notes (visitor_id, name, body) values (vid, trim(p_name), trim(p_body)) returning * into n;
  perform private.email_guest('note_received', vid, '{}');
  perform private.email_family('family_note_submitted', jsonb_build_object('name', n.name, 'link', private.site_url() || '/family/notes/?id=' || n.id));
  perform private.log('note.submitted', format('%s sent a note', n.name), jsonb_build_object('note_id', n.id), 'guest: ' || n.name);
  return jsonb_build_object('id', n.id, 'upload_token', n.upload_token);
end $$;
