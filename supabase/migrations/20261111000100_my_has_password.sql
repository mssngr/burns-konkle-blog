-- Does the signed-in account have a password?
--
-- Accounts made when sign-in used emailed codes have a null or empty password
-- hash. The site can't read auth.users, so it asks this function and shows a
-- "set a password" pop-up when the answer is false.

create function public.my_has_password() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select coalesce(u.encrypted_password, '') <> '' from auth.users u where u.id = auth.uid()),
    false
  )
$$;
