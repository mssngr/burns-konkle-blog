-- The send-outbox function runs as service_role. Hosted projects don't grant
-- service_role execute on functions whose public grant was revoked, so the
-- secret check failed with "permission denied" and every email stayed queued.
grant execute on function public.outbox_secret_ok(text) to service_role;
grant select, update on public.outbox to service_role;
