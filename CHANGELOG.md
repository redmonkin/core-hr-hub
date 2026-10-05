# Changelog

All notable changes to Peoplo are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). Releases up to v1.1.1 are described on [GitHub Releases](https://github.com/redmonkin/core-hr-hub/releases).

When you update a self-hosted copy, read the **Upgrade notes** of every version since yours: they list new migrations, secrets and settings. The steps are in [Updating to a new version](docs/self-hosting.md#updating-to-a-new-version).

## [Unreleased]

### License

- Peoplo is now licensed under the **AGPL-3.0** (previously MIT). Versions released before this change remain available under MIT. The app shows a **Source code** link, configurable with `VITE_REPO_URL`.

### Features

- **Permissions per module**: roles set default view/manage access for each module (employees, onboarding, attendance, leaves, reimbursements, performance, assets, payroll, calendar, settings), and admins can give one person extra access from **Settings → Users & access**.
- **Invite-only accounts**: nobody can sign up without an invitation. Invitations are managed from **Onboarding**, can be revoked or extended, and can be limited to approved email domains.
- **Payroll**: choose the month when generating payroll; mid-month joiners are prorated. Payslip PDFs follow a standard salary-slip layout. The Payroll page has a pay-period picker that opens on the latest month with records.
- **Colleague directory** for employees, showing only safe fields.
- **New landing and features pages** presenting Peoplo as open source, with recreated 3D product previews instead of screenshots, and a self-hosting guide.

### Fixes

- Onboarding's Pending tab was always empty; the employee details dialog didn't show the manager.
- Editing an asset erased its purchase date and vendor.
- Payroll summary cards ignored the selected month; the salary form lost focus on every keystroke.
- Processed-leave filters, sorting and export didn't work; leave dates could shift by a day in some time zones.
- Reports: payroll axis in ₹, consistent headcount figures, whole-number axes.
- Calendar counts and highlights, team calendar date range, dashboard "status today" on non-working days.
- Notification delivery, and links in emails now use the configured app address.
- Mobile: every page fits a phone screen, tables become cards, dialogs keep their buttons visible, the menu closes on navigation, and pinch-zoom works again. Text contrast and screen-reader labels throughout.

### Security

- Every table's access rules were rebuilt on the module permissions and enforced with row-level security, plus a restrictive policy that locks out blocked users.
- Triggers guard sensitive changes: leave and reimbursement requests always start as pending and only the right approver can decide them; attendance can't be backdated or edited after clock-out; ratings can only be set by their owner; review acknowledgements and onboarding documents are checked.
- Bank details moved from `employees` into a separate `employee_bank_details` table, readable only by the employee and people with payroll or employee-management access.
- Storage policies follow the module permissions.
- Edge functions verify the caller and their permissions, load data from the database instead of trusting the request, escape all email HTML, and validate invite redirect URLs. Scheduled functions require the `x-cron-secret` header.

### Upgrade notes

- Apply all migrations up to `20261003100300_integrity_guards.sql` with `npx supabase db push`. It moves bank details into a new table and rebuilds every access rule; take a backup first.
- Redeploy **all** edge functions (`npx supabase functions deploy`).
- Set the function secrets `APP_URL` (your site's `https://` address), `RESEND_FROM_EMAIL` and `CRON_SECRET`. Scheduled functions refuse every call until `CRON_SECRET` is set; update your `pg_cron` jobs to send it in an `x-cron-secret` header (see [Scheduled jobs](docs/self-hosting.md#part-6-scheduled-jobs)).
- Existing users keep their roles. Turn off **Allow new users to sign up** in Supabase Auth, and set **Settings → Domain whitelist**.
- Optional: set `VITE_REPO_URL` if you run a modified fork.

[Unreleased]: https://github.com/redmonkin/core-hr-hub/compare/v1.1.1...HEAD
