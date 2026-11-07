-- When a guest answered a change the family proposed, nobody on the family was emailed.
-- Email the admins whether the guest accepts or declines.

insert into public.message_templates (key, audience, position, description, subject, body) values
('family_change_accepted', 'family', 19, 'Guest accepts the family''s proposed change', '[name] accepted the change',
 '[name] accepted the proposed change to their [type name]. It is now: [when]. [family link]'),
('family_change_declined', 'family', 20, 'Guest declines the family''s proposed change', '[name] declined the change',
 '[name] declined the proposed change to their [type name]. The booking still stands as before: [when]. [family link]')
on conflict (key) do nothing;

create or replace function public.respond_visit_change(p_token text, p_accept boolean) returns void
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

  perform private.email_family(case when p_accept then 'family_change_accepted' else 'family_change_declined' end,
                               private.booking_vars(b));
  perform private.log(case when p_accept then 'visit.change_accepted' else 'visit.change_declined' end,
                      format('%s %s the family''s proposed change', b.name, case when p_accept then 'accepted' else 'declined' end),
                      jsonb_build_object('booking_id', b.id), 'guest: ' || b.name);
end $$;
