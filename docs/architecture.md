# Family site architecture

A static Astro site (GitHub Pages) with Preact islands, backed by Supabase (Postgres, Auth, Storage, pg_cron, one Edge Function). The build spec lives outside the repo ("Burns-Konkle Family Website — Full Spec"); every rule and message wording in it is implemented in the database.

Decisions that differ from the spec:

- **Email instead of text messages.** Every "text" in the spec is an email sent through Resend. Guests give an email (required) and phone (optional); a guest is identified by **name + email**. The consent box reads "I agree to receive emails about my request."
- **The registry is unchanged.** `/registry/` is the old Pantry-backed claim registry, moved into the sidebar as-is. `/thanks/` is its thank-you list.

## Layout

| Path | What |
| --- | --- |
| `src/layouts/app.astro` | Shell: sidebar of modules, "How this works" link, test-mode and pause banners, optional photo notice (`photoNotice` prop), and the "set a password" pop-up for older accounts (`my_has_password`). Every page uses it. |
| `src/data/modules.ts` | Sidebar entries and icons. |
| `src/lib/supabase.ts` | Client, `rpc()`, `query()`, `errorMessage()`, photo URL helpers. |
| `src/lib/auth.ts` | `useAuth()` → `{ loading, session, family }`; `family` is `{ person, display_name, role, confirmed }`; `confirmed` is also on the state itself for guests. |
| `src/lib/time.ts` | Mountain Time helpers. **Always** use these: `fromMT(date, time)` builds an instant; `mtDate`, `mtTime`, `fmtDate`, `fmtTime`, `fmtRange`, `addDays`, `weekStart`, `clockSteps`. |
| `src/lib/ui.tsx` | `Button`, `Field`, `Input`, `TextArea`, `Select`, `Check`, `Notice`, `ErrorText`, `Loading`, `Empty`, `toast`, `Legend`, `StatusPill`, `Modal`, `useAsync`, `useAction`, `useQueryParam`, `ContactFields` + `useContact`, `PageHead`, `site(path)`. |
| `src/components/auth/` | Sign-in (email + password, reset link), email confirmation, change password, `FamilyGate` (wrap family pages), profile. |
| `src/styles/app.css` | Shell and shared classes: `.page`, `.page-narrow`, `.page-wide`, `.card`, `.cards`, `.stack`, `.row`, `.spread`, `.form-grid`, `.input`, `.actions`, `.btn-*`, `.notice-*`, `.pill-*`, `.st-<color>` (the six calendar colors), `.legend`, `.table`, `.modal`, `.meta`, `.muted`, `.small`. |
| `supabase/migrations/` | Schema, privacy (RLS), and every action as a Postgres function. |
| `supabase/functions/send-outbox/` | Sends queued emails via Resend. |

Pages are `.astro` files under `src/pages/` that render a Preact island with `client:only="preact"` (everything is per-viewer, so nothing is pre-rendered). Module-specific CSS goes in `src/styles/<module>.css`, imported from the page.

## Privacy model

- Guests never read tables. They call `SECURITY DEFINER` functions, and anything after the first step takes the unguessable `token` from their private link (`/visits/request/?t=…`, `/meals/signup/?t=…`, `/offer/?t=…`).
- Family members read tables through RLS policies that require a signed-in account whose email is in `public.family` **and** has been confirmed (a link emailed at sign-up; see `private.is_confirmed()`). Unconfirmed accounts see nothing private and can change nothing. `private.is_family()` / `private.is_admin()`.
- Guest emails and phones are in `visitor_contacts` (Admins only). Names are in `visitors`. Block notes, outbox, and activity are Admin-only.
- Public data: settings, rules, booking types, limits, meal dates, offer options, posts, published notes (`published_notes()`), calendar colors (`visit_calendar()`, `meal_calendar()`).

## Calendar colors

`visit_calendar(p_type, p_from date, p_days)` returns `{ slots: [{ t, s, r }], paused, blackout, weeks, weekly_cap }`: one entry per 15-minute slot inside visiting hours, `s` in `green | yellow | orange | blue | purple | red`, `r` is why it's red (`paused | closed | blocked | week_full`). `meal_calendar(p_from, p_days)` returns `{ slots: [{ date, slot, label, start, end, s, r, name }] }`.

## Function reference (see migrations for details)

Guests: `create_visit_request`, `get_visit_request`, `agree_rule`, `save_visit_answers`, `submit_visit_request`, `cancel_visit`, `shorten_visit`, `propose_visit_change`, `respond_visit_change`, `confirm_healthy`, `create_meal_signup`, `get_meal_signup`, `confirm_meal_signup`, `cancel_meal_signup`, `submit_offer`, `get_offer`, `submit_note`, `attach_note_photos`, `published_notes`, `answer_post`, `post_results`, `blocked_times`.

Family: `my_family_status`, `family_dashboard`, `family_decide_visit`, `family_cancel_visit`, `family_shorten_visit`, `family_propose_change`, `family_respond_change`, `flag_visitor`, `remove_flag`, `request_pause`, `end_pause`, `family_decide_meal`, `family_cancel_meal`, `draft_offer_reply`, `approve_offer_reply`, `withdraw_offer_reply`, `family_decide_note`, `request_help`, `claim_help`, `unclaim_help`, `family_clear_test_data`. Admins edit config tables directly (RLS allows it; triggers log every change).

Errors raised with `errcode = 'P0001'` carry a sentence meant for the person; `rpc()` throws it as `AppError`, and `ErrorText` shows it.

## Scheduled jobs

`pg_cron` runs `private.run_scheduler()` every minute (expire unfinished requests and sign-ups, reminders), then `private.kick_outbox()`, which calls the `send-outbox` function when emails are queued.
