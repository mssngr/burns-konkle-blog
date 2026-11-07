-- Updates UI: let the family remove photos from the public `updates` bucket.
-- Storage deletes only rows the caller can also SELECT, so "family deletes update photos"
-- did nothing on its own: photos of edited or deleted posts were left behind.
-- (Anyone can still view them through the public URL; this policy only covers the API.)
create policy "family sees update photos" on storage.objects for select to authenticated
  using (bucket_id = 'updates' and private.is_family());
