# Self-hosting Peoplo

This guide takes you from nothing to your own running copy of Peoplo. It takes about an hour, most of it waiting for DNS.

Each Peoplo deployment is **one company's workspace**. Accounts are invite-only and can be restricted to your email domain, so there is no public sign-up page to protect.

You'll set up three things:

1. **Supabase**: the database, sign-in, file storage, server functions and scheduled jobs.
2. **Resend**: sends email (invitations, approvals, reminders, password resets).
3. **A static host** for the website. This guide uses Vercel; any static host works.

## Contents

- [What you need](#what-you-need)
- [Part 1: Supabase](#part-1-supabase)
- [Part 2: Resend (email)](#part-2-resend-email)
- [Part 3: Push notifications (optional)](#part-3-push-notifications-optional)
- [Part 4: Deploy the server functions](#part-4-deploy-the-server-functions)
- [Part 5: Supabase Auth settings](#part-5-supabase-auth-settings)
- [Part 6: Scheduled jobs](#part-6-scheduled-jobs)
- [Part 7: Deploy the website](#part-7-deploy-the-website)
- [Part 8: Create the first admin](#part-8-create-the-first-admin)
- [Part 9: Check everything works](#part-9-check-everything-works)
- [Updating to a new version](#updating-to-a-new-version)
- [Troubleshooting](#troubleshooting)
- [Third-party services](#third-party-services)

## What you need

- A computer with [Git](https://git-scm.com/downloads) and [Node.js](https://nodejs.org) 20 or newer.
- A [Supabase](https://supabase.com) account (the free plan is enough to start).
- A [Resend](https://resend.com) account (the free plan is enough to start).
- A domain whose DNS records you can edit, for sending email (for example `example.com`).
- A [Vercel](https://vercel.com) account, or another static host.

Get the code and install its dependencies:

```sh
git clone https://github.com/redmonkin/core-hr-hub.git peoplo
cd peoplo
npm install
```

All Supabase commands below use `npx supabase ...`, which runs the [Supabase CLI](https://supabase.com/docs/guides/cli) without installing it. If you prefer, [install it](https://supabase.com/docs/guides/cli/getting-started) and drop the `npx`.

## Part 1: Supabase

### 1.1 Create a project

1. Sign in to the [Supabase dashboard](https://supabase.com/dashboard) and click **New project**.
2. Give the project a name (for example `peoplo`) and set a **database password**. Save it in your password manager; you'll need it in step 1.4.
3. Pick the **region** closest to your team, and click **Create new project**.

### 1.2 Note your project's details

| Value | Where to find it | Looks like |
| --- | --- | --- |
| Project ref | **Project Settings → General → Project ID** | `abcdefghijklmnopqrst` |
| Project URL | **Project Settings → Data API** | `https://abcdefghijklmnopqrst.supabase.co` |
| Anon key | **Project Settings → API Keys** (the `anon` `public` key) | `eyJhbGciOi...` |
| Service role key | Same page, the `service_role` `secret` key | `eyJhbGciOi...` |

The anon key is public by design and goes into the website. The **service role key bypasses every access rule**: never put it in the website or commit it anywhere.

### 1.3 Turn on the scheduling extensions

In **Database → Extensions**, enable `pg_cron` and `pg_net`. They run the reminders and the monthly payroll job in [Part 6](#part-6-scheduled-jobs).

### 1.4 Create the database

Link the CLI to your project and apply every migration in `supabase/migrations/`:

```sh
npx supabase login
npx supabase link --project-ref <your-project-ref>   # asks for the database password
npx supabase db push
```

This creates all tables, the access rules (row-level security), the module permissions, the invite-only sign-up guard, storage buckets and the data-integrity triggers. It creates no sample data.

> Applying migrations by pasting them into the SQL Editor is not recommended: long files can be cut short when pasted, which applies only part of a migration. Use `db push`.

## Part 2: Resend (email)

Peoplo sends two kinds of email: **app email** (leave approvals, reminders, payslip notices) through the Resend API from the server functions, and **account email** (invitations, password resets) from Supabase Auth, which you'll point at Resend's SMTP server in [5.2](#52-send-account-email-through-resend).

### 2.1 Add and verify your sending domain

1. In Resend, open **Domains → Add domain**. Use a subdomain such as `mail.example.com` so your main domain's reputation is unaffected.
2. Add the DNS records Resend shows (SPF, DKIM, and the MX record for bounces) at your DNS provider.
3. Optionally add a DMARC record, for example `_dmarc.mail.example.com TXT "v=DMARC1; p=none;"`.
4. Wait until Resend shows the domain as **Verified**.

### 2.2 Create an API key

**API Keys → Create API key**, with **Sending access**. Copy it; it's shown once.

### 2.3 Choose a sender address

Pick an address on the verified domain, for example `Peoplo <hr@mail.example.com>`. This becomes `RESEND_FROM_EMAIL`.

## Part 3: Push notifications (optional)

Peoplo is a progressive web app and can send push notifications (approvals, reminders) to phones and desktops. Skip this part if you only want email.

Generate a VAPID key pair:

```sh
npx web-push generate-vapid-keys
```

Keep both keys. The **public** key goes into the website (`VITE_VAPID_PUBLIC_KEY`) and the server functions (`VAPID_PUBLIC_KEY`); the **private** key only into the server functions (`VAPID_PRIVATE_KEY`).

## Part 4: Deploy the server functions

Set the function secrets. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions automatically; don't set them yourself. The full list is in [`supabase/functions/.env.example`](../supabase/functions/.env.example).

```sh
npx supabase secrets set \
  RESEND_API_KEY="re_..." \
  RESEND_FROM_EMAIL="Peoplo <hr@mail.example.com>" \
  APP_URL="https://hr.example.com" \
  CRON_SECRET="$(openssl rand -hex 32)"

# Optional, for push notifications (Part 3)
npx supabase secrets set VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_CONTACT_EMAIL="hr@example.com"
```

- `APP_URL` is your website's address, with `https://` and no trailing slash. Links in emails use it, and invitations only redirect to this host (plus `localhost` for development). Add other hosts, such as a preview domain, with `EXTRA_REDIRECT_HOSTS` (comma-separated; prefix with `*.` for subdomains).
- `CRON_SECRET` protects the scheduled functions. **Write the value down**: the scheduled jobs in [Part 6](#part-6-scheduled-jobs) send it. Without it, scheduled functions refuse every request.

Then deploy every function:

```sh
npx supabase functions deploy
```

`supabase/config.toml` marks the functions that authenticate callers themselves (`verify_jwt = false`); the CLI applies those settings for you.

## Part 5: Supabase Auth settings

All in the Supabase dashboard under **Authentication**.

### 5.1 Website address and redirects

**URL Configuration**:

- **Site URL**: your website's address, e.g. `https://hr.example.com`.
- **Redirect URLs**: add `https://hr.example.com/**` (and `http://localhost:9002/**` if you develop locally).

### 5.2 Send account email through Resend

Supabase's built-in email is rate-limited and meant for testing. Under **Emails → SMTP Settings**, enable custom SMTP:

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key |
| Sender email | an address on your verified domain |
| Sender name | `Peoplo` (or your company name) |

### 5.3 Turn off public sign-up

Under **Sign In / Providers**, turn **Allow new users to sign up** off. Peoplo is invite-only: a database trigger already rejects any account without a pending invitation, but turning this off avoids confusing errors on the sign-in page. Invitations still work, because they're sent by the `invite-employee` function with the service role.

### 5.4 Restrict accounts to your email domain (recommended)

After you sign in as admin ([Part 8](#part-8-create-the-first-admin)), open **Settings → Domain whitelist** in Peoplo and add your company's email domain(s). Invitations and account emails outside these domains are then rejected by the database.

## Part 6: Scheduled jobs

These jobs call the scheduled functions. They aren't in the migrations because they contain your project URL and secret. In the **SQL Editor**, replace `<project-ref>` and `<CRON_SECRET>` and run:

```sql
-- Attendance reminders: every 10 minutes during working hours, Monday to Saturday (UTC)
select cron.schedule('attendance-reminders-job', '*/10 8-19 * * 1-6', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/attendance-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb);
$$);

-- KPI and goal reminders: daily at 09:00 UTC
select cron.schedule('daily-goal-reminders', '0 9 * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/goal-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb);
$$);

-- Onboarding reminders: daily at 09:00 UTC
select cron.schedule('onboarding-reminders-daily', '0 9 * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/onboarding-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb);
$$);

-- This week's company events: Mondays at 08:00 UTC
select cron.schedule('weekly-event-notifications', '0 8 * * 1', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/event-notification',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb);
$$);

-- Generate this month's payroll records: the 27th at 09:00 UTC
select cron.schedule('monthly-payroll-generation', '0 9 27 * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/generate-monthly-payroll',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb);
$$);
```

Times are in UTC; shift the hours for your time zone. To list or remove jobs: `select * from cron.job;` and `select cron.unschedule('job-name');`.

## Part 7: Deploy the website

The website is a static build configured with environment variables at build time (see [`.env.example`](../.env.example)):

| Variable | Value | Required |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Project URL from [1.2](#12-note-your-projects-details) | Yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key | Yes |
| `VITE_SUPABASE_PROJECT_ID` | Project ref | Yes |
| `VITE_VAPID_PUBLIC_KEY` | VAPID public key from [Part 3](#part-3-push-notifications-optional) | For push notifications |
| `VITE_REPO_URL` | Your fork's URL, if you changed the code (see [License](#license-and-your-changes)) | No |

### On Vercel

1. **Add New → Project**, import your fork of the repository.
2. Vercel detects Vite. Add the variables above under **Environment Variables**.
3. Deploy. `vercel.json` already rewrites app routes to `index.html` and sets security headers. Its Content Security Policy allows `*.supabase.co`; if you use a custom Supabase domain, add it to `connect-src`.
4. Add your domain under **Settings → Domains**, and make sure it matches `APP_URL` and the Auth Site URL.

### On another host

Run `npm run build` with the variables set, and serve the `dist/` folder. Configure the host to serve `index.html` for any path that isn't a file (Netlify: `public/_redirects` is included; nginx: `try_files $uri /index.html;`).

## Part 8: Create the first admin

There's no public sign-up, so the first admin is invited from the database:

1. In the **SQL Editor**:

   ```sql
   insert into public.user_invitations (email, roles)
   values ('you@example.com', '{admin}');
   ```

2. In **Authentication → Users**, click **Invite user** and enter the same address.
3. Open the email, set a password and sign in.

Then set up your company in **Settings** (departments, leave types, employee IDs, domain whitelist, office locations and branding) and invite everyone else from **Onboarding**. Roles set default access per module; **Settings → Users & access → Extra access** grants one person more. The last admin can't be removed, so you can't lock yourself out.

## Part 9: Check everything works

1. Use **Forgot password?** on the sign-in page; the reset email should arrive from your sender address.
2. Invite a second email address you own from **Onboarding**, accept it, submit the onboarding form, and approve it as admin.
3. As that employee, clock in and apply for a day's leave. The manager (or admin) should get an email and an in-app notification.
4. Approve the leave; the employee should be notified.
5. The next day, check the scheduled jobs ran: `select * from cron.job_run_details order by start_time desc limit 20;`.

## Updating to a new version

```sh
git pull                          # or sync your fork
npm install
npx supabase db push              # applies any new migrations
npx supabase functions deploy     # redeploys the server functions
```

Then redeploy the website (Vercel does this when you push). Read [`CHANGELOG.md`](../CHANGELOG.md) first: each version's **Upgrade notes** list new secrets, settings or manual steps.

## Troubleshooting

**Invitations or password-reset emails don't arrive.** These come from Supabase Auth. Check the SMTP settings in [5.2](#52-send-account-email-through-resend) (username `resend`, password the API key), that the sender is on your verified domain, and **Authentication → Logs**.

**"Only email addresses from approved domains..."** The address isn't covered by **Settings → Domain whitelist**. Add its domain there.

**"Sign-ups are invite-only".** There's no pending invitation for that address. Invite it from **Onboarding** (or, for the first admin, [Part 8](#part-8-create-the-first-admin)).

**No approval or reminder emails.** Open **Edge Functions → (function) → Logs**. Usually `RESEND_API_KEY` or `RESEND_FROM_EMAIL` isn't set, or the domain isn't verified yet. Resend's **Emails** page shows what it accepted.

**Emails arrive but links point to the wrong site.** `APP_URL` doesn't match your website exactly (`https`, no trailing slash).

**Scheduled reminders never go out.** Check the jobs exist (`select * from cron.job;`) and their runs (`select * from cron.job_run_details order by start_time desc;`). A 401 in `net._http_response` means the `x-cron-secret` in the job doesn't match the `CRON_SECRET` function secret.

**Pages other than the home page show 404.** The host isn't rewriting unknown paths to `index.html` ([Part 7](#on-another-host)).

**Push notifications never arrive.** `VITE_VAPID_PUBLIC_KEY` (website) and `VAPID_PUBLIC_KEY` (functions) must be the same key, and the site must be served over HTTPS.

**The project stopped responding after a quiet week.** Supabase pauses free-plan projects after inactivity. Restore it from the dashboard, or use a paid plan for anything your company relies on. The free plan also has no automatic backups.

## Third-party services

| Service | Used for | Needed? |
| --- | --- | --- |
| [Supabase](https://supabase.com) | Database, sign-in, file storage, server functions and scheduled jobs | Yes |
| [Resend](https://resend.com) | App email through its API, account email through its SMTP server | For any email. Without it the app works but nothing is emailed |
| Static hosting (Vercel, Netlify, Cloudflare Pages, nginx...) | Serving the website | Yes, any of them |
| Web Push (the browser vendors' push services) | Push notifications | Optional, only with VAPID keys |
| [GitHub Releases API](https://docs.github.com/rest/releases) | The in-app "What's new" page and update notice (`version-check` function) | Called automatically; falls back to the bundled changelog |

Peoplo uses no analytics, advertising or tracking services.

## License and your changes

Peoplo is licensed under the [AGPL-3.0](../LICENSE). Running it for your own company's staff doesn't require publishing anything. If you modify it and let people use your modified version over a network, you must offer them its source code. The app's sidebar has a **Source code** link for this; set `VITE_REPO_URL` to your fork so it points at your changes.
