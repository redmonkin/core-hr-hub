# Peoplo Roadmap

Status: as of 2026-10-06. Nothing below is a permanent commitment; the maintainers revisit it as priorities shift. Ideas and requests are welcome as [GitHub issues](https://github.com/redmonkin/core-hr-hub/issues).

## Next

- **v1.2.0 release**: tag the work listed under [Unreleased](../CHANGELOG.md#unreleased) and publish it on GitHub Releases, so self-hosters get the update notice.
- **Features page screenshots**: re-capture them from a demo workspace (the current ones show a cookie banner and real email addresses).
- **Branded auth emails**: customise Supabase's invitation and password-reset templates (**Authentication → Emails → Templates**) to match Peoplo.

## To do: hosted instance and operations

Needed before the hosted instance (peoplo.redmonk.in) grows.

- [ ] **Database backups.** Move the project to a plan with daily backups, or run `npx supabase db dump` on a schedule to private storage. Don't use GitHub Actions artifacts: on a public repository others can download them.
- [ ] **Uptime and error monitoring.** An uptime monitor on the home page and one edge function; error tracking later (needs a CSP update in `vercel.json`).
- [ ] **Privacy policy and terms review.** Have a lawyer review `/privacy-policy` and `/terms-of-service` for India's DPDP Act 2023 (and GDPR for EU employees). Let self-hosters point the links at their own documents.
- [ ] **Free-plan pausing.** Supabase pauses free projects after about a week without activity; production workspaces should be on a paid plan.

## Ideas, not yet designed

- Data export for admins (all records as Excel or JSON).
- Single sign-on (Google Workspace / Microsoft) for invited users.
- Leave accrual rules and carry-forward.
- Statutory reports (PF, ESI, professional tax) and Form 16 generation.
