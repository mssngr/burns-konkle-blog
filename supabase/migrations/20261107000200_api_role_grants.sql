-- Newer hosted Supabase projects don't grant the API roles access to tables in
-- `public` by default, so every read through the API failed with "permission denied".
-- Grant the usual table access; row-level security on every table still decides
-- which rows each person can see or change.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;

-- Keep family roles fixed: only names and sign-in emails can change (see core migration).
revoke update on public.family from anon, authenticated;
grant update (display_name, email) on public.family to authenticated;
