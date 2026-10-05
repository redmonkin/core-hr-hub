# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Peoplo: open-source HR software for growing teams (people and departments, invite-only onboarding, attendance, leave and holidays, payroll and payslips, performance, reimbursements, assets, reports). Licensed AGPL-3.0. Originally scaffolded via Lovable; a Vite + React + TypeScript SPA backed by Supabase (Postgres + Auth + Storage + Edge Functions). Each deployment is **one company's workspace**; there is no multi-tenancy.

## Commands

- `npm run dev`: Vite dev server on port 9002.
- `npm run build`: production build into `dist/` (Vite does not typecheck).
- `npm run lint`: ESLint.
- `npm run typecheck`: `tsc` for the app and node configs.
- `npm test`: Vitest unit tests (`src/**/*.test.ts`).
- `supabase/tests/run.sh`: database tests (`permissions.test.sql`) against a plain Postgres, using `supabase_stub.sql` to stand in for Supabase's `auth`/`storage` schemas. Set `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`.

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, the database tests and a build; `check-migrations.yml` rejects new migrations containing `USING (true)`.

Supabase CLI manages migrations and functions for the linked project (`npx supabase link --project-ref <ref>`; the upstream deployment is `ppdsxgkmnmjfwmpnamts`). Migrations live in `supabase/migrations/` (timestamp-prefixed, append-only); edge functions in `supabase/functions/<name>/index.ts` with shared helpers in `_shared/`. Self-hosting steps are in `docs/self-hosting.md`; function secrets in `supabase/functions/.env.example`; frontend variables in `.env.example`.

## Architecture

**Routing (`src/App.tsx`)**: public marketing routes (`/`, `/features`, `/how-it-works`, `/pricing`, `/security`, legal pages, `/auth`, `/reset-password`) and app routes wrapped in `ProtectedRoute` + `DashboardLayout`. Auth state comes from `useAuth()` (`src/contexts/AuthContext.tsx`). `ProtectedRoute` shows an in-shell "not available yet" state to invited people who aren't linked to an employee record and have no module access; `DashboardLayout` hides the modules they can't use.

**Data layer**: all data access goes through the Supabase client (`src/integrations/supabase/client.ts`, generated; `types.ts` holds DB types). TanStack Query for fetching and mutations, in `src/hooks/use*.ts`. Client code talks to Postgres via PostgREST directly; RLS decides what each request can see. When embedding a table that has more than one foreign key to the same target (e.g. `employees` → `departments`, or `employees` → `employees` for managers), name the relationship (`departments!employees_department_id_fkey(...)`) or embed through the FK column (`manager:manager_id(...)`); unqualified embeds fail with PGRST201.

**Permission model** (`20261003100000_module_permissions.sql`):
- Roles (`app_role`: `admin`, `hr`, `manager`, `employee`) live in `user_roles`. `role_permissions` gives each role a level (`view` < `manage`) per module (`app_module`: employees, onboarding, attendance, leaves, reimbursements, performance, assets, payroll, calendar, settings). `user_permissions` grants one person extra access on top.
- SQL helpers used in policies: `can(module, level)`, `is_admin()`, `has_any_module_access()`, `is_active_member()`, `is_not_blocked()`, plus `get_my_employee_id()` and `is_manager_of(employee_id)` for own and team rows. `get_my_permissions()` returns the caller's effective levels as JSON for the UI. Service-role-only: `user_can(user_id, module, level)` and `users_with_module_access(module, level)` (used by edge functions to pick notification recipients).
- Frontend: `usePermissions()` (`src/hooks/usePermissions.ts`) and `hasModuleAccess()` / `canAccessSettings()` (`src/lib/permissions.ts`) mirror the database for showing and hiding UI. They never grant access by themselves.
- A trigger prevents removing the last admin.

**Invite-only accounts and onboarding** (`20261003100100_invite_only_accounts.sql`, `20261006100000_onboarding_invites.sql`): HR adds a new hire in **Onboarding**, which inserts the `employees` row (status `onboarding`) and calls the `invite-employee` function. That function creates or reuses the `user_invitations` row for that employee (`employee_id`, `last_sent_at`, `send_count`) and emails a sign-up link (Supabase `generateLink`, sent through Resend; `inviteUserByEmail` when Resend isn't configured) that lands on `/reset-password?welcome=1` to choose a password. A `BEFORE INSERT` trigger on `auth.users` (`enforce_invite_only_signup`) rejects accounts without an open invitation; `handle_new_user` assigns the invited roles, sets `accepted_user_id` and links the employee record. The invitation is only *accepted* when the person confirms / first signs in (`on_auth_user_activated` → `complete_invitation()`), which also moves the employee to `active` and notifies the inviter. Leave balances are created by a trigger whenever an employee becomes active. `invite-employee` also cancels invitations (revokes and deletes the never-used account). Email domains can be restricted via the `domain_whitelist` organisation setting, enforced in the database. The old self-service onboarding requests (`onboarding_requests`) are no longer used by the app.

**RLS** (`20261003100200_rls_module_permissions.sql`, `20261003100250_storage_policies.sql`): every table's policies are defined in one place on top of the permission model, plus a restrictive `"Deny blocked users"` policy per table and on `storage.objects`. `employee_directory` is a view exposing only safe fields to active members.

**Integrity guards** (`20261003100300_integrity_guards.sql`): triggers that apply only to end-user requests (`is_end_user_request()`, so the service role and SQL editor are unaffected) and skip people with `manage` access: leave and reimbursement requests always start `pending` and only approvers change their status; attendance can't be backdated or edited after clock-out; KPI/goal ratings only by their owner (`guard_rating_ownership`); review acknowledgement and onboarding document paths are checked. Bank details live in `employee_bank_details`, not `employees`.

**Edge functions** (Deno): user-triggered notifications (`leave-*`, `reimbursement-*`, `review-*`, `onboarding-notification`), `invite-employee` (send / resend / cancel invitations), `send-push-notification` (web push, VAPID), `version-check` (GitHub releases), and scheduled `attendance-reminders`, `goal-reminders`, `onboarding-reminders`, `event-notification`, `generate-monthly-payroll`. Shared helpers in `_shared/`: `authenticateCaller()` (verifies the JWT, rejects blocked users, returns a service-role client), `userCan()`, `usersWithModuleAccess()`, `getEmployeeIdForUser()` (`auth.ts`); `corsHeaders`/`jsonResponse` (`cors.ts`); `escapeHtml` (`html.ts`); `verifyCronSecret()` (`secrets.ts`, constant-time check of the `x-cron-secret` header against `CRON_SECRET`). Functions marked `verify_jwt = false` in `supabase/config.toml` must authenticate callers themselves. Email goes through Resend (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`); links use `APP_URL`.

**UI stack**: shadcn/ui (`src/components/ui/`) on Radix, Tailwind (`tailwind.config.ts`, tokens in `src/index.css`), `lucide-react`. Feature components by module under `src/components/<module>/`. Marketing pages share `PublicHeader`, `Footer`, `PublicCtaSection` (`src/components/layout/`) and the CSS-only 3D/motion pieces in `src/components/landing/` (respect `prefers-reduced-motion` via `motion-decor`). Public URLs (repo, license, guides) come from `src/lib/site.ts` (`VITE_REPO_URL` overrides the repo).

**Design conventions**: Inter; primary `hsl(201 96% 32%)` (`#0369a1`); `muted-foreground` is a mid-grey for secondary text. Currency is ₹ with `en-IN` formatting; dates `MMM d, yyyy` (date-fns, parse `yyyy-MM-dd` strings with `parseISO`, never `new Date(str)`). Status badges via `statusBadgeClass()` / `formatStatus()` / `pluralizeDays()` (`src/lib/statusStyles.ts`). Every screen must work at 390px: tables switch to cards below `sm`, dialog actions go in `DialogFooter` (sticky on mobile), icon-only buttons need `aria-label`. PWA via `vite-plugin-pwa` with `public/sw-push.js` for push.

## Security conventions

- New tables ship with RLS in the same migration: a restrictive `"Deny blocked users"` policy and policies built on `can()`, `get_my_employee_id()` and `is_manager_of()`. Never `USING (true)` without a comment and explicit review.
- Adding a module or permission level means updating the `app_module` enum, `role_permissions` defaults, `src/lib/permissions.ts` (`MODULES`) and `supabase/tests/permissions.test.sql` together.
- Workflows with approval or financial impact get a guard trigger (follow the `guard_*` functions) and a database test.
- Edge functions: handle `OPTIONS`, authenticate with `authenticateCaller()` or `verifyCronSecret()`, check `userCan()`, load records by id from the database instead of trusting request bodies, choose recipients server-side, and escape everything in email HTML.
- Never expose the service role key to the browser. Never interpolate user input into SQL in migrations or RPCs.
- Keep the in-app **Source code** link (AGPL-3.0 §13) working.

## Project memory

Planning notes from the Lovable era live in `.lovable/plan.md`. Trust the migrations and this file where they disagree.
