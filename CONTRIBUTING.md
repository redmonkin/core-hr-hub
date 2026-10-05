# Contributing to Peoplo

Thanks for helping improve Peoplo. This guide covers how to get set up and what a good pull request looks like. Please follow the [code of conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Bugs**: search existing issues first, then open one using the bug report template.
- **Features**: open an issue to discuss the idea before writing a lot of code, and check [docs/ROADMAP.md](docs/ROADMAP.md) to see if it's already planned.
- **Security issues**: don't open a public issue. Follow [SECURITY.md](SECURITY.md).

## Development setup

Follow [Local development](README.md#local-development) in the README. You'll need your own Supabase project; the [self-hosting guide](docs/self-hosting.md) covers applying the migrations and deploying the edge functions to it. Never point a development copy at a production project.

## Making changes

1. Fork the repo and create a branch from `main`.
2. Keep each pull request focused on one change.
3. Run the same checks CI runs before pushing:

   ```sh
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

   If you change migrations, also run the database tests against a local Postgres 15+ (`supabase/tests/run.sh`; set `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` as needed).

4. Open a pull request and fill in the template. Include desktop and phone screenshots for UI changes.

## Conventions

[CLAUDE.md](CLAUDE.md) describes the architecture in detail. The rules that matter most:

- **Access is decided in the database.** Every table has row-level security. Organisation-wide access goes through `public.can('<module>', 'view' | 'manage')`; your own rows through `get_my_employee_id()` / `auth.uid()`; your team's through `is_manager_of()`. Never rely on hiding something in the UI.
- **New tables ship with RLS** and a restrictive `"Deny blocked users"` policy in the same migration. CI rejects migrations containing `USING (true)`; if a table is genuinely public, explain why in a comment and ask for explicit review.
- **New modules or permission levels** go into the `app_module` enum, `src/lib/permissions.ts` and the settings matrix together, with database tests in `supabase/tests/permissions.test.sql`.
- **Migrations are append-only.** Add a new timestamped file in `supabase/migrations/` rather than editing one that has already been released.
- **Sensitive changes are guarded by triggers** (for example, employees can't approve their own leave). If you add a workflow with approval or financial impact, add a guard trigger and a test.
- **Edge functions** handle CORS `OPTIONS` preflight, authenticate callers with `authenticateCaller()` from `_shared/auth.ts` (or `verifyCronSecret()` for scheduled functions), check permissions with `userCan()`, load data from the database rather than trusting the request body, and escape every value put into email HTML with `escapeHtml()`.
- **UI** uses the shadcn/ui components in `src/components/ui/` and the Tailwind tokens in `src/index.css`. Don't hardcode colours. Status badges use `statusBadgeClass()` / `formatStatus()` from `src/lib/statusStyles.ts`. Every screen must work at 390px wide; tables get a card layout below `sm`, and icon-only buttons need an `aria-label`.
- **Currency** is ₹ formatted with the `en-IN` locale; dates are shown as `MMM d, yyyy`.

## Commit messages

Write a short imperative subject line (for example, "Add half-day leave to the leave calendar"), followed by a body explaining *why* when it isn't obvious.

## License

By contributing, you agree that your contributions are licensed under the [AGPL-3.0](LICENSE), the same license as the project.
