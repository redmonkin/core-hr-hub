# Changelog

All notable changes to Peoplo are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). Releases up to v1.1.1 are described on [GitHub Releases](https://github.com/redmonkin/core-hr-hub/releases).

When you update a self-hosted copy, read the **Upgrade notes** of every version since yours: they list new migrations, secrets and settings. The steps are in [Updating to a new version](docs/self-hosting.md#updating-to-a-new-version).

## [Unreleased]

### Onboarding, simplified

- **One step to add and invite**: adding an employee in Onboarding creates their record and emails them an invitation to set up their account. The separate "invite to self-onboard" flow, the employee-submitted onboarding request and the Requests tab are gone.
- **Pending shows who hasn't joined yet**: each new hire's invitation state (sent, link expired, not sent, cancelled) with **Resend** and **Cancel invitation**, plus who joined in the last 30 days.
- **Joining is automatic**: when the new hire opens the link and chooses a password (a new welcome screen), their invitation is accepted, their record becomes active, leave balances are created, and whoever invited them is notified. "Mark as joined" is still available for people who won't use the app.
- **Invite anyone without an account** from their row in Employees.
- The Add employee form no longer asks for a base salary; set pay in **Employees → Edit → Salary**, which covers the full structure (allowances and deductions).
- **One invitation email**, with a working link: previously Supabase's email and ours were both sent, and the second made the first link invalid. Resending to someone who never set up their account now works.
- The daily onboarding reminder only tells HR about new hires whose link expired or who were never invited, instead of emailing every pending hire a link they couldn't use.

### Upgrade notes (onboarding)

- Apply `20261006100000_onboarding_invites.sql` and redeploy `invite-employee` and `onboarding-reminders`. The `onboarding-request-notification` function is no longer used and can be deleted from your project.

### Offboarding emails

- **Department-wise offboarding checklist** (IT, HR, Finance, Facilities/Admin), edited from Onboarding → Leaving → **Edit checklist**.
- When HR starts an offboarding or approves a resignation, they **pick who gets the checklist email**: anyone in the team (the reporting manager and department managers are suggested) and outside addresses such as it@company.com, with an optional note and a **preview**. Replies go to the HR person who sent it. A **reminder** goes to the same people on the last working day, and the email can be resent from the Leaving tab.
- **Resignations are emailed** to HR and the reporting manager, with a confirmation to the employee; approvals (with the confirmed last day) and declines are emailed to the employee.
- The in-app tick-box checklist is replaced by the emailed checklist; teams confirm by replying to the email.

### Upgrade notes (offboarding emails)

- Apply `20261009100000_offboarding_emails.sql`, deploy `offboarding-email` and `offboarding-reminders`, and schedule the reminder (see the self-hosting guide).


- **Start offboarding** from an employee's row in Employees: reason, notice date and last working day. They stay active through their notice period and show as "Leaving <date>".
- **Resignations**: employees can resign from their profile with a proposed last day; HR approves (confirming the date) or declines with a note. Employees can withdraw until it's approved.
- **Leaving tab** in Onboarding: resignations to review, everyone leaving with a checklist (each assigned asset to return, which ticks itself when the asset is returned, plus reimbursements, leave, final payroll, handover and exit interview, and your own items), and who left in the last 90 days.
- **Automatic on the last day**: the morning after the last working day the person is marked offboarded, their sign-in is blocked and pending leave is cancelled; HR and their manager are notified. HR can also complete it on the day, change the date, or cancel.
- **Payroll** no longer pays people who have left, and prorates the final month to the last working day. Reports count leavers by their last working day.
- Employee **status is now set by the workflows** (joining and offboarding) and shown read-only when editing; the unused **Inactive** status and the bulk "Set as active / inactive" actions are gone.

### Upgrade notes (offboarding)

- Apply `20261008100000_offboarding.sql`, redeploy `generate-monthly-payroll`, and schedule the daily job: `select cron.schedule('process-employee-exits', '30 0 * * *', $$select public.process_employee_exits()$$);`

### Bank details

- Employee bank details now include the **IFSC code** (Employees → Edit → Personal). It's checked for the standard 11-character format and shown on payslips.

### Upgrade notes (bank details)

- Apply `20261007100000_bank_ifsc.sql`.

### Payroll at month end

- Payroll is now generated automatically on the **last day of each month** (previously the 27th).
- Payslip PDFs are dated to the **last day of their pay month** ("Generated on 30 September 2026"), not the day they were downloaded.

### Upgrade notes (payroll)

- Reschedule the payroll job: `select cron.schedule('monthly-payroll-generation', '0 9 $ * *', ...)` with the same command as before (see [Scheduled jobs](docs/self-hosting.md)). Scheduling a job with an existing name replaces it.

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
