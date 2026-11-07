-- Offerings form, Family & Friends notes, Baby & Micala updates, Family Schedule, guest profiles.

-- ------------------------------------------------------------- offerings

create table public.offer_options (
  key text primary key,
  label text not null,
  -- meal: Meal Train; visit:N: visit calendar as booking type N; review: the family points it somewhere
  destination text not null check (destination ~ '^(meal|visit:[1-5]|review)$'),
  active boolean not null default true,
  position int not null default 0
);
alter table public.offer_options enable row level security;
create policy "anyone reads offer options" on public.offer_options for select using (active or private.is_family());
create policy "admins manage offer options" on public.offer_options for all using (private.is_admin()) with check (private.is_admin());
create trigger offer_options_log after insert or update or delete on public.offer_options for each row execute function private.log_config_change();

insert into public.offer_options (key, label, destination, position) values
  ('meal', 'Dropping off a meal', 'meal', 1),
  ('groceries', 'Picking up groceries', 'meal', 2),
  ('mom_supplies', 'Dropping off "Mom" recovery supplies for Micala', 'meal', 3),
  ('baby_gifts', 'Dropping off gifts for the baby', 'meal', 4),
  ('school', 'Taking Vincent to school', 'visit:4', 5),
  ('cleaning', 'Cleaning the home', 'visit:2', 6),
  -- Open decision; suggested default: Meal Train, as a one-off visit outside.
  ('garden', 'Watering the garden', 'meal', 7),
  ('other', 'Something else (write in)', 'review', 8);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default private.random_token(),
  visitor_id uuid not null references public.visitors,
  name text not null,
  options text[] not null default '{}',
  write_in text,
  availability text,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.offers enable row level security;
create policy "family reads offers" on public.offers for select using (private.is_family());

create table public.offer_replies (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers on delete cascade,
  drafted_by text not null references public.family,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'withdrawn')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.offer_replies enable row level security;
create policy "family reads offer replies" on public.offer_replies for select using (private.is_family());

create table public.offer_reply_approvals (
  reply_id uuid not null references public.offer_replies on delete cascade,
  person text not null references public.family,
  at timestamptz not null default now(),
  primary key (reply_id, person)
);
alter table public.offer_reply_approvals enable row level security;
create policy "family reads reply approvals" on public.offer_reply_approvals for select using (private.is_family());

create function public.submit_offer(p_name text, p_email text, p_phone text, p_consent boolean,
                                    p_options text[], p_write_in text, p_availability text, p_notes text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare vid uuid; o public.offers; labels text;
begin
  if not coalesce(p_consent, false) then raise exception 'Please agree to receive emails about your offer' using errcode = 'P0001'; end if;
  if coalesce(cardinality(p_options), 0) = 0 and coalesce(trim(p_write_in), '') = '' then
    raise exception 'Please check at least one way to help, or write one in' using errcode = 'P0001';
  end if;
  vid := private.upsert_visitor(p_name, p_email, p_phone, p_consent);
  insert into public.offers (visitor_id, name, options, write_in, availability, notes)
  values (vid, trim(p_name),
          coalesce((select array_agg(k) from unnest(p_options) k where exists (select 1 from public.offer_options where key = k and active)), '{}'),
          nullif(trim(coalesce(p_write_in, '')), ''), nullif(trim(coalesce(p_availability, '')), ''), nullif(trim(coalesce(p_notes, '')), ''))
  returning * into o;
  select string_agg(oo.label, ', ' order by oo.position) into labels from public.offer_options oo where oo.key = any (o.options);
  labels := concat_ws('; ', labels, o.write_in);
  perform private.email_guest('offer_received', vid, jsonb_build_object('link', private.site_url() || '/offer/?t=' || o.token));
  perform private.email_family('family_offer_submitted', jsonb_build_object('name', o.name, 'offers', labels,
                               'link', private.site_url() || '/family/offers/?id=' || o.id));
  perform private.log('offer.submitted', format('%s offered to help: %s', o.name, labels), jsonb_build_object('offer_id', o.id), 'guest: ' || o.name);
  return jsonb_build_object('token', o.token);
end $$;

/** The offer, for its "Schedule this" buttons. */
create function public.get_offer(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', o.name, 'options', o.options, 'write_in', o.write_in,
    'email', c.email, 'phone', c.phone, 'availability', o.availability,
    'choices', (select coalesce(jsonb_agg(jsonb_build_object('key', oo.key, 'label', oo.label, 'destination', oo.destination) order by oo.position), '[]')
                from public.offer_options oo where oo.key = any (o.options)))
  from public.offers o join public.visitor_contacts c on c.visitor_id = o.visitor_id
  where o.token = p_token
$$;

create function private.maybe_send_reply(p_reply uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare r public.offer_replies; o public.offers; n int;
begin
  select * into r from public.offer_replies where id = p_reply for update;
  if r.status <> 'pending' then return false; end if;
  select count(*) into n from public.offer_reply_approvals where reply_id = r.id and person <> r.drafted_by;
  if n < 2 then return false; end if;
  select * into o from public.offers where id = r.offer_id;
  update public.offer_replies set status = 'sent', sent_at = now() where id = r.id;
  perform private.email_guest('offer_reply', o.visitor_id, jsonb_build_object('reply', r.body));
  perform private.log('offer.reply_sent', format('Sent the family''s reply to %s', o.name), jsonb_build_object('offer_id', o.id, 'reply_id', r.id), 'system');
  return true;
end $$;

create function public.draft_offer_reply(p_offer uuid, p_body text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare me text := private.require_family(); o public.offers; rid uuid;
begin
  if coalesce(trim(p_body), '') = '' then raise exception 'Please write a reply' using errcode = 'P0001'; end if;
  select * into o from public.offers where id = p_offer;
  if not found then raise exception 'Offer not found' using errcode = 'P0001'; end if;
  update public.offer_replies set status = 'withdrawn' where offer_id = o.id and status = 'pending';
  insert into public.offer_replies (offer_id, drafted_by, body) values (o.id, me, trim(p_body)) returning id into rid;
  perform private.email_family('family_offer_reply_drafted', jsonb_build_object(
    'drafter', (select display_name from public.family where person = me), 'name', o.name,
    'link', private.site_url() || '/family/offers/?id=' || o.id), array['admin', 'elevated'], true);
  perform private.log('offer.reply_drafted', format('Drafted a reply to %s', o.name), jsonb_build_object('offer_id', o.id, 'reply_id', rid));
  return rid;
end $$;

create function public.approve_offer_reply(p_reply uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare me text := private.require_family(); r public.offer_replies; sent boolean;
begin
  select * into r from public.offer_replies where id = p_reply;
  if not found or r.status <> 'pending' then raise exception 'This reply isn''t waiting' using errcode = 'P0001'; end if;
  if r.drafted_by = me then raise exception 'Two other people need to approve your draft' using errcode = 'P0001'; end if;
  insert into public.offer_reply_approvals (reply_id, person) values (r.id, me) on conflict do nothing;
  perform private.log('offer.reply_approved', 'Approved a drafted reply', jsonb_build_object('reply_id', r.id));
  sent := private.maybe_send_reply(r.id);
  return jsonb_build_object('sent', sent);
end $$;

create function public.withdraw_offer_reply(p_reply uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me text := private.require_family();
begin
  update public.offer_replies set status = 'withdrawn' where id = p_reply and status = 'pending'
    and (drafted_by = me or private.is_admin());
  if not found then raise exception 'This reply isn''t waiting' using errcode = 'P0001'; end if;
end $$;

-- ---------------------------------------------------- family & friends notes

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  upload_token text not null default private.random_token(),
  visitor_id uuid not null references public.visitors,
  name text not null,
  body text not null,
  photos text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'published', 'held')),
  created_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz
);
alter table public.notes enable row level security;
create policy "family reads notes" on public.notes for select using (private.is_family());

create function public.submit_note(p_name text, p_email text, p_phone text, p_consent boolean, p_body text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare vid uuid; n public.notes;
begin
  if coalesce(trim(p_body), '') = '' then raise exception 'Please write a note' using errcode = 'P0001'; end if;
  vid := private.upsert_visitor(p_name, p_email, p_phone, coalesce(p_consent, false));
  insert into public.notes (visitor_id, name, body) values (vid, trim(p_name), trim(p_body)) returning * into n;
  perform private.email_guest('note_received', vid, '{}');
  perform private.email_family('family_note_submitted', jsonb_build_object('name', n.name, 'link', private.site_url() || '/family/notes/?id=' || n.id));
  perform private.log('note.submitted', format('%s sent a note', n.name), jsonb_build_object('note_id', n.id), 'guest: ' || n.name);
  return jsonb_build_object('id', n.id, 'upload_token', n.upload_token);
end $$;

/** After uploading photos to notes/<note id>/…, attach them. */
create function public.attach_note_photos(p_note uuid, p_upload_token text, p_paths text[]) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.notes set photos = (
      select coalesce((array_agg(p))[1:4], '{}') from unnest(p_paths) p where p like p_note::text || '/%')
   where id = p_note and upload_token = p_upload_token and status = 'pending' and created_at > now() - interval '1 hour';
  if not found then raise exception 'Couldn''t attach photos' using errcode = 'P0001'; end if;
end $$;

create function public.published_notes(p_limit int default 50, p_before timestamptz default null)
returns table (id uuid, name text, body text, photos text[], published_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select id, name, body, photos, decided_at from public.notes
  where status = 'published' and (p_before is null or decided_at < p_before)
  order by decided_at desc limit least(p_limit, 100)
$$;

create function public.family_decide_note(p_note uuid, p_decision text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me text := private.require_admin(); n public.notes;
begin
  if p_decision not in ('publish', 'hold') then raise exception 'Unknown decision' using errcode = 'P0001'; end if;
  update public.notes set status = case when p_decision = 'publish' then 'published' else 'held' end,
         decided_by = me, decided_at = now()
   where id = p_note returning * into n;
  if not found then raise exception 'Note not found' using errcode = 'P0001'; end if;
  if p_decision = 'publish' then
    perform private.email_guest('note_published', n.visitor_id, jsonb_build_object('link', private.site_url() || '/notes/'));
  end if;
  perform private.log('note.' || case when p_decision = 'publish' then 'published' else 'held' end,
                      format('%s %s''s note', case when p_decision = 'publish' then 'Published' else 'Held' end, n.name),
                      jsonb_build_object('note_id', n.id));
end $$;

-- ------------------------------------------------------------- updates

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author text not null references public.family default private.person(),
  kind text not null default 'message' check (kind in ('message', 'photos', 'poll', 'guess')),
  title text,
  body text,
  photos text[] not null default '{}',
  -- poll: {"question": "...", "options": ["a", "b"]}; guess: {"question": "...", "unit": "lb", "answer": null}
  game jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.posts enable row level security;
create policy "anyone reads posts" on public.posts for select using (true);
create policy "family posts" on public.posts for insert with check (private.is_family() and author = private.person());
create policy "author or admin edits" on public.posts for update
  using (author = private.person() or private.is_admin())
  with check (private.is_family() and (author = private.person() or private.is_admin()));
create policy "author or admin deletes" on public.posts for delete using (author = private.person() or private.is_admin());
create trigger posts_touch before update on public.posts for each row execute function private.touch_updated();

create table public.post_responses (
  post_id uuid not null references public.posts on delete cascade,
  -- Random per-browser id, so viewers can answer without signing in.
  responder text not null check (length(responder) between 16 and 80),
  name text,
  answer text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, responder)
);
alter table public.post_responses enable row level security;
create policy "family reads responses" on public.post_responses for select using (private.is_family());

create function private.post_results(p public.posts) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case p.kind
    when 'poll' then jsonb_build_object('counts', (
      select coalesce(jsonb_object_agg(answer, n), '{}') from (
        select answer, count(*) n from public.post_responses where post_id = p.id group by answer) x),
      'total', (select count(*) from public.post_responses where post_id = p.id))
    when 'guess' then jsonb_build_object('guesses', (
      select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(name, 'Someone'), 'answer', answer) order by created_at), '[]')
      from public.post_responses where post_id = p.id),
      'answer', p.game ->> 'answer')
    else '{}'::jsonb end
$$;

/** Results only after you've answered. */
create function public.post_results(p_post uuid, p_responder text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare p public.posts; mine text;
begin
  select * into p from public.posts where id = p_post;
  select answer into mine from public.post_responses where post_id = p_post and responder = p_responder;
  if mine is null and not private.is_family() then return jsonb_build_object('answered', false); end if;
  return jsonb_build_object('answered', mine is not null, 'mine', mine) || private.post_results(p);
end $$;

create function public.answer_post(p_post uuid, p_responder text, p_answer text, p_name text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare p public.posts;
begin
  select * into p from public.posts where id = p_post and kind in ('poll', 'guess');
  if not found then raise exception 'That post doesn''t take answers' using errcode = 'P0001'; end if;
  if coalesce(trim(p_answer), '') = '' then raise exception 'Please pick or enter an answer' using errcode = 'P0001'; end if;
  if p.kind = 'poll' and not (p.game -> 'options') ? p_answer then raise exception 'Please pick one of the options' using errcode = 'P0001'; end if;
  insert into public.post_responses (post_id, responder, name, answer)
  values (p.id, p_responder, nullif(trim(coalesce(p_name, '')), ''), left(trim(p_answer), 200))
  on conflict (post_id, responder) do nothing;
  return public.post_results(p.id, p_responder);
end $$;

-- ------------------------------------------------------- family schedule

create table public.schedule_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'event' check (kind in ('event', 'appointment', 'family', 'need')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  notes text,
  help_needed boolean not null default false,
  help_description text,
  help_requested_at timestamptz,
  claimed_by text references public.family,
  claimed_at timestamptz,
  created_by text default private.person(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.schedule_entries enable row level security;
create policy "family reads schedule" on public.schedule_entries for select using (private.is_family());
create policy "admins add schedule" on public.schedule_entries for insert with check (private.is_admin());
create policy "admins edit schedule" on public.schedule_entries for update using (private.is_admin()) with check (private.is_admin());
create policy "admins delete schedule" on public.schedule_entries for delete using (private.is_admin());
create trigger schedule_touch before update on public.schedule_entries for each row execute function private.touch_updated();

create function public.request_help(p_entry uuid, p_description text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me text := private.require_admin(); e public.schedule_entries;
begin
  if coalesce(trim(p_description), '') = '' then raise exception 'Please describe what''s needed' using errcode = 'P0001'; end if;
  update public.schedule_entries set help_needed = true, help_description = trim(p_description), help_requested_at = now(),
         claimed_by = null, claimed_at = null
   where id = p_entry returning * into e;
  if not found then raise exception 'Entry not found' using errcode = 'P0001'; end if;
  perform private.email_family('family_help_needed', jsonb_build_object(
    'entry', e.title || ' (' || e.help_description || ')', 'date', private.fmt_date(e.starts_at), 'time', private.fmt_time(e.starts_at),
    'link', private.site_url() || '/family/schedule/?id=' || e.id), array['admin', 'elevated'], true);
  perform private.log('schedule.help_requested', format('Asked for help: %s', e.title), jsonb_build_object('entry_id', e.id));
end $$;

create function public.claim_help(p_entry uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me text := private.require_family(); e public.schedule_entries;
begin
  update public.schedule_entries set claimed_by = me, claimed_at = now()
   where id = p_entry and help_needed and claimed_by is null returning * into e;
  if not found then raise exception 'Someone already claimed this, or it doesn''t need help' using errcode = 'P0001'; end if;
  perform private.email_family('family_help_claimed', jsonb_build_object(
    'claimer', (select display_name from public.family where person = me), 'entry', e.title, 'date', private.fmt_date(e.starts_at)),
    array['admin', 'elevated'], true);
  perform private.log('schedule.claimed', format('Claimed: %s', e.title), jsonb_build_object('entry_id', e.id));
end $$;

create function public.unclaim_help(p_entry uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me text := private.require_family(); e public.schedule_entries;
begin
  update public.schedule_entries set claimed_by = null, claimed_at = null
   where id = p_entry and claimed_by = me returning * into e;
  if not found then raise exception 'Only the person who claimed it can unclaim it' using errcode = 'P0001'; end if;
  perform private.log('schedule.unclaimed', format('Unclaimed: %s', e.title), jsonb_build_object('entry_id', e.id));
end $$;

-- ------------------------------------------------------------- profiles

create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade default auth.uid(),
  name text not null,
  phone text,
  -- People the guest often brings: [{name, age, relationship}]
  companions jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select using (user_id = auth.uid());
create policy "own profile insert" on public.profiles for insert with check (user_id = auth.uid());
create policy "own profile update" on public.profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated();

-- --------------------------------------------------------------- storage

insert into storage.buckets (id, name, public) values ('updates', 'updates', true) on conflict do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notes', 'notes', false, 15728640, array['image/*']) on conflict do nothing;

create policy "family uploads update photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'updates' and private.is_family());
create policy "family deletes update photos" on storage.objects for delete to authenticated
  using (bucket_id = 'updates' and private.is_family());

-- Anyone can add photos to a note they just submitted (the folder is the note id).
-- Notes are family-only under RLS, so these checks run as definer.
create function private.note_accepts_photos(folder text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.notes n
    where n.id::text = folder and n.status = 'pending' and n.created_at > now() - interval '1 hour')
    and (select count(*) from storage.objects o where o.bucket_id = 'notes' and (storage.foldername(o.name))[1] = folder) < 4
$$;

create function private.note_is_published(folder text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.notes n where n.id::text = folder and n.status = 'published')
$$;

create policy "submitters upload note photos" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'notes' and private.note_accepts_photos((storage.foldername(name))[1]));
create policy "published note photos are visible" on storage.objects for select to anon, authenticated
  using (bucket_id = 'notes' and (private.is_family() or private.note_is_published((storage.foldername(name))[1])));
