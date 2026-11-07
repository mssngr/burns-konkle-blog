-- Visits UI: fix the "New" / "Updated" rule labels on a guest's request page.
--
-- Before: once a guest had agreed to any rule, every rule they hadn't reached yet
-- was labeled "New", so a first-time guest saw "New" on rules 2–13 after
-- checking rule 1 (or after reloading part-way through).
--
-- Now: "Updated" = they agreed to an older wording. "New" = they haven't agreed
-- to it and it was added (or turned back on) after their first agreement on this
-- request. Agreements copied from a recent approved visit (the profile shortcut)
-- are stamped when the request is created, so rules added after that still show
-- "New".

create or replace function public.get_visit_request(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare b public.bookings; t public.booking_types; first_agreed timestamptz; ch public.booking_changes;
begin
  b := private.booking_by_token(p_token);
  select * into t from public.booking_types where id = b.type_id;
  select min(agreed_at) into first_agreed from public.rule_agreements where booking_id = b.id;
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
          when a.rule_id is not null and a.revision < r.revision then 'Updated'
          when a.rule_id is null and first_agreed is not null
               and greatest(r.created_at, r.updated_at) > first_agreed then 'New' end
      ) order by r.position), '[]')
      from public.rules r
      left join public.rule_agreements a on a.rule_id = r.id and a.booking_id = b.id
      where r.active),
    'pending_change', case when ch.id is null then null else jsonb_build_object(
      'id', ch.id, 'proposed_by', case when ch.proposed_by = 'guest' then 'guest' else 'family' end,
      'starts_at', ch.starts_at, 'ends_at', ch.ends_at, 'attendees', ch.attendees, 'note', ch.note) end
  );
end $$;
