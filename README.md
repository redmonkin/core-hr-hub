<div align="center">

<img src="src/assets/hr-hub-logo.svg" alt="" width="72" height="72" />

# Peoplo

**Open-source HR for growing teams.**

People, onboarding, attendance, leave, payroll, performance, reimbursements and assets, in one secure app you can host yourself. Built on React and Supabase, with payroll in ₹.

[Website](https://peoplo.redmonk.in) · [Self-hosting](docs/self-hosting.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md)

[![CI](https://github.com/redmonkin/core-hr-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/redmonkin/core-hr-hub/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-0284C7.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/redmonkin/core-hr-hub?style=flat&color=0284C7)](https://github.com/redmonkin/core-hr-hub/stargazers)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-0284C7.svg)](CONTRIBUTING.md)

</div>

## Features

- **People & departments**: one record per person with job details, manager, documents, assets and history.
- **Invite-only onboarding**: add a new hire once and they're emailed a link to set up their account; Pending shows who hasn't joined yet. Accounts can be limited to your company's email domains.
- **Attendance**: clock in and out with location and breaks, working schedules, and reminders.
- **Leave & holidays**: leave types and balances, manager approvals, a team calendar and company holidays.
- **Payroll & payslips**: salary structures, monthly payroll runs, PF and other deductions, and branded payslip PDFs.
- **Performance**: KPIs, review cycles with self and manager ratings, and team analytics.
- **Reimbursements**: claims with receipts, manager approval and payment tracking.
- **Assets**: equipment, who has it, and assignment history.
- **Reports**: headcount, attendance, leave balances, payroll and assets, exportable to CSV and PDF.
- **Permissions per module**: roles set default view/manage access for each module, and you can give one person extra access (for example, Assets only).
- **Notifications**: in-app, email and web push. Installable as a PWA on phones.

Each deployment is one company's workspace.

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query |
| Backend | [Supabase](https://supabase.com): Postgres with row-level security, Auth, Storage, Edge Functions (Deno) |
| Email | [Resend](https://resend.com) |
| Scheduling | `pg_cron` + `pg_net` for reminders and monthly payroll |

The browser talks to Supabase directly. Row-level security decides what each person can read and write, based on their module permissions; database triggers guard sensitive changes (no self-approval, no backdated attendance). Edge functions handle anything that needs the service role: invitations, email, push notifications and scheduled jobs.

## Local development

Requirements: Node.js 20+ and a Supabase project (the free tier is fine). The [self-hosting guide](docs/self-hosting.md) explains how to set the project up.

```sh
git clone https://github.com/redmonkin/core-hr-hub.git peoplo
cd peoplo
npm install
cp .env.example .env   # fill in your Supabase URL, anon key and project ref
npm run dev            # http://localhost:9002
```

Useful scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build into `dist/` |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript checks (Vite's build does not typecheck) |
| `npm test` | Unit tests (Vitest) |
| `supabase/tests/run.sh` | Database tests for the access rules, against a local Postgres |

CI runs lint, typecheck, unit tests, the database tests and a build on every pull request.

A `docker-compose.yml` is included for running a local Supabase-compatible stack; its default secrets are public demo values, so change them before exposing it anywhere.

## Self-hosting

Peoplo runs on a single [Supabase](https://supabase.com) project, [Resend](https://resend.com) for email, and any static host for the website. **[The self-hosting guide](docs/self-hosting.md)** walks through every step:

1. Create a Supabase project, enable `pg_cron` and `pg_net`, and apply the migrations (`supabase db push`).
2. Verify a sending domain in Resend and create an API key.
3. Set the function secrets (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_URL`, `CRON_SECRET`, optional VAPID keys) and deploy the edge functions.
4. Configure Supabase Auth: site and redirect URLs, custom SMTP through Resend, and turn off public sign-up.
5. Schedule the reminder and payroll jobs.
6. Build the frontend with the variables from [`.env.example`](.env.example) and deploy it (Vercel works out of the box with `vercel.json`).
7. Invite yourself as the first admin.

It also covers checking that everything works, updating to a new version and troubleshooting.

## Project structure

```
src/
  pages/            Route components
  components/       Feature components by module, shadcn/ui in ui/, marketing pages in landing/
  hooks/            Data hooks (TanStack Query), usePermissions, ...
  lib/              Permissions, payroll proration, payslip PDFs, status styles, ...
  integrations/     Generated Supabase client and database types
supabase/
  migrations/       SQL migrations, applied in timestamp order
  functions/        Deno edge functions (_shared/ holds auth, CORS, HTML-escaping and secret helpers)
  tests/            Database tests for row-level security and triggers
docs/               Self-hosting guide and roadmap
```

[`CLAUDE.md`](CLAUDE.md) documents the architecture in more depth: the permission model, invite-only accounts and the security conventions every change must follow.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request, and see [docs/ROADMAP.md](docs/ROADMAP.md) for what's planned. Please follow the [code of conduct](CODE_OF_CONDUCT.md).

## Security

Please don't report vulnerabilities in public issues. See [SECURITY.md](SECURITY.md).

## License

Peoplo is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only). You may use, modify and self-host it freely, including for your own company's staff. If you run a modified version as a service for others, you must make your modified source code available to its users; the app's **Source code** link (set `VITE_REPO_URL` to your fork) is the easiest way to do that.

Versions released before the license change remain available under the MIT license they were released with.
