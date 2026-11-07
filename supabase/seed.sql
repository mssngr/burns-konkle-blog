-- Local development only (supabase db reset). Production family emails are set in Settings → Family accounts.
update public.family set email = person || '@example.test';
insert into public.meal_dates (date)
select generate_series(current_date, current_date + 45, interval '1 day')::date on conflict do nothing;
