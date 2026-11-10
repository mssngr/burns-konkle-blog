# Burns-Konkle family site

A private-by-design site for coordinating visits, meals, help, gifts, and updates around baby Burns-Konkle's arrival. Astro (static, GitHub Pages at burns-konkle.com) with Preact islands, backed by Supabase. See [docs/architecture.md](docs/architecture.md) for how it fits together.

## Modules

Everyone: Home, How this works, Visit calendar, Meal Train, Offer help, Baby registry, Baby & Micala updates, Family & friends notes, House rules.

Family (signed in with a confirmed email): Dashboard, Visits & blocks, Meal Train, Family schedule, Offers of help, Notes to publish, Visitors & flags. Gabriel and Micala also get Registry thank-yous, Sent emails, Activity log, and Settings.

## Local development

Needs [Bun](https://bun.sh), Docker, and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```sh
bun install
supabase start          # Postgres, Auth, Storage, Edge Functions, Mailpit
supabase db reset       # apply migrations + supabase/seed.sql
bun dev                 # http://localhost:4321
```

- Sign-in emails and every site email land in Mailpit at http://127.0.0.1:54324 (emails are marked "logged" in the outbox when no Resend key is set).
- Local family accounts are `gabriel@example.test`, `micala@example.test` (Admins), `vincent@example.test`, `samantha@example.test` (Elevated). Make an account at `/signin/` with that email and any password, then open the confirmation link. Emails go through the outbox, which has no mail sender locally, so read the link in Studio: `select body from outbox order by id desc limit 1`.
- Meal Train dates are open for the next 45 days locally.

## The registry

`/registry/` is the original shower registry, unchanged: items live in `src/data/registry.ts`, claims in a [Pantry](https://getpantry.cloud) basket (`registry` in production, `registry-dev` under `bun dev`, config in `src/config.ts`). Add `?family` to see anonymous guests' names. `/thanks/` is the registry thank-you list.

## Production setup (one time)

1. **Create a Supabase project** (free tier is fine). Then link and push the schema and the email function:

   ```sh
   supabase link --project-ref <project-ref>
   supabase db push
   supabase functions deploy send-outbox --no-verify-jwt
   ```

2. **Point the database at the email function** and set the site's address (SQL editor):

   ```sql
   update private.config set value = 'https://<project-ref>.supabase.co/functions/v1/send-outbox' where key = 'send_outbox_url';
   update public.settings set value = '"https://burns-konkle.com"' where key = 'site_url';
   ```

3. **Family sign-in emails.** Set each person's sign-in email once (never commit them; this repo is public):

   ```sql
   update public.family set email = '…' where person = 'gabriel';
   update public.family set email = '…' where person = 'micala';
   update public.family set email = '…' where person = 'vincent';
   update public.family set email = '…' where person = 'samantha';
   ```

   After that, Admins can change them in Settings → Family accounts.

4. **Resend** (all site emails). Create an account, verify the `burns-konkle.com` domain, then:

   ```sh
   supabase secrets set RESEND_API_KEY=re_… MAIL_FROM="Burns-Konkle Family <family@burns-konkle.com>"
   ```

   Optional: `MAIL_REPLY_TO=…` so replies reach a family inbox.

5. **Auth settings** in the Supabase dashboard:
   - Authentication → URL Configuration: Site URL `https://burns-konkle.com`, and add `https://burns-konkle.com/signin/` to Redirect URLs (the password-reset link returns there; without it people land on the home page and never see the new-password form).
   - Existing accounts have no password yet: they use "Forgot password?" on the sign-in page to set one.
   - Authentication → Emails → SMTP: use Resend's SMTP (`smtp.resend.com`, port 465, user `resend`, your API key as the password). The built-in sender is limited to a few emails an hour.
   - Authentication → Sign In / Providers → Email: leave "Confirm email" **off**. The site tracks confirmation itself so people can look around before confirming; the confirmation link is sent through the outbox (Resend), not by Supabase. Keep the default password-reset email.
   - Authentication → Multi-Factor: turn TOTP off. The site no longer uses two-step verification.

6. **GitHub** → Settings → Secrets and variables → Actions → Variables: add `PUBLIC_SUPABASE_URL` (`https://<project-ref>.supabase.co`) and `PUBLIC_SUPABASE_ANON_KEY` (the project's anon/publishable key). Pushing to `main` deploys.

7. **Open Meal Train dates** and turn off the test-mode banner (Settings → General) once the family is done testing. Settings → Test data clears practice bookings.

Later schema changes: add a file to `supabase/migrations/` and run `supabase db push`.
