# Security Policy

## Reporting a vulnerability

Please **do not** report security vulnerabilities through public GitHub issues, discussions or pull requests.

Report them privately through GitHub: go to the repository's **Security** tab and choose **Report a vulnerability**. Include:

- what the issue is and where it lives (file, edge function, table or page),
- steps to reproduce, or a proof of concept,
- the impact you believe it has (for example, which data another user could read or change).

We aim to acknowledge reports within 3 business days and will keep you updated as we investigate. Once a fix ships, we're happy to credit you in the release notes unless you'd rather stay anonymous.

## Supported versions

Security fixes land on `main` and in the next release. Self-hosted deployments should update to the latest release and apply any new migrations and edge functions (see [Updating to a new version](docs/self-hosting.md#updating-to-a-new-version)).

## Scope

In scope: this repository's frontend, SQL migrations (row-level security policies, database functions and triggers) and Supabase edge functions. Examples: one employee reading another's salary or documents, a user acting on a module they have no permission for, a blocked or uninvited account getting access, or an email template that renders unescaped input.

Out of scope: vulnerabilities in Supabase, Resend or other third-party services themselves (report those to the vendor), findings that require an already-compromised admin account or device, and missing hardening headers without a demonstrated impact.

## How Peoplo protects data

- Access is enforced by Postgres row-level security using per-module permissions, not just by the UI.
- Accounts are invite-only, can be restricted to approved email domains, and blocked users are denied everywhere by a restrictive policy.
- Triggers guard sensitive changes: no self-approval of leave or reimbursements, no backdated attendance, ratings only by their owner, bank details in a separate table.
- Edge functions verify the caller, check module permissions, and escape all values in email HTML. Scheduled functions require a secret header.

## Notes for self-hosters

- The Supabase **anon/publishable key** is public by design and is embedded in the website. Never expose the **service role key** to the browser; it belongs only in edge function secrets.
- Keep `CRON_SECRET` long and random, and rotate it (function secret and scheduled jobs together) if it may have leaked.
- Turn off public sign-up in Supabase Auth and set **Settings → Domain whitelist** to your company's domains.
- Keep `RESEND_FROM_EMAIL` on a domain you control and have verified in Resend.
