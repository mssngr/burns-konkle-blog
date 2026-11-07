-- Fixes found while building Settings.

-- 1. Through the API, pg-safeupdate (preloaded for the authenticator role) rejects a
--    DELETE with no WHERE clause, so "Clear test bookings" failed with
--    "DELETE requires a WHERE clause". Same deletes, each with an explicit `where true`.
create or replace function public.family_clear_test_data() returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_admin();
  delete from public.bookings where true;
  delete from public.meal_signups where true;
  delete from public.offers where true;
  delete from public.notes where true;
  delete from public.outbox where true;
  delete from public.visitors v where not exists (select 1 from public.flags f where f.visitor_id = v.id);
  perform private.log('settings.clear_test_data', 'Cleared test bookings, sign-ups, offers, notes and emails (flags kept)');
end $$;

-- 2. "Last updated" on the rules page moved on every rules write, including reordering
--    and removing, which also added a "rules_updated_at" entry to the activity log each
--    time. Now it moves only when wording changes or a rule is added (or comes back):
--    exactly the rows whose `updated_at` private.rules_before_update() set to now().
create or replace function private.rules_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  if exists (select 1 from public.rules where updated_at = now()) then
    update public.settings set value = to_jsonb(now()) where key = 'rules_updated_at';
  end if;
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
