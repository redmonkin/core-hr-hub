# CoreHR Hub

A comprehensive HR management system built with React, TypeScript, and Supabase.

## Features

- **Employee Management** - Full CRUD operations, bulk actions, manager assignments
- **Leave Management** - Request, approve, and track leave balances
- **Attendance Tracking** - Clock in/out with reminders
- **Payroll** - Salary structures, payslips, and history tracking
- **Performance Reviews** - Goals, reviews, and analytics
- **Asset Management** - Track company assets assigned to employees
- **Document Management** - Secure employee document storage
- **Notifications** - Email notifications via Resend
- **Role-Based Access** - Admin, HR, Manager, and Employee roles

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **UI Components**: shadcn/ui, Radix UI
- **State Management**: TanStack Query
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Email**: Resend

## Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)
- Resend account for email notifications (optional)

## Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd <project-directory>
npm install
```

### 2. Supabase Setup

#### Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from Settings > API

#### Run Database Migrations

All migrations are in `supabase/migrations/`. These are **schema-only** migrations that create the database structure without any test data.

1. Go to your Supabase Dashboard > SQL Editor
2. Run each migration file in chronological order (files are timestamped)

The migrations will create:
- All required tables (employees, departments, leaves, payroll, etc.)
- Row Level Security (RLS) policies
- Database functions and triggers
- Storage buckets for documents

#### Seed Data (Optional)

For development/testing, you can optionally run the seed file to populate sample data:

```bash
# Using Make (recommended)
make seed

# Or manually via Supabase SQL Editor
# Copy contents of supabase/seed.sql and run in SQL Editor
```

The seed file (`supabase/seed.sql`) includes:
- Sample departments (Engineering, HR, Finance, etc.)
- Leave types (Annual, Sick, Casual, etc.)
- Company holidays (adjust dates as needed)
- Sample assets for testing

**Note:** Do NOT run seed data on production databases. It's meant for development only.

#### Enable Required Extensions

In SQL Editor, run:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

#### Configure Authentication

1. Go to Authentication > Providers
2. Enable Email provider (enabled by default)
3. (Optional) Configure OAuth providers (Google, GitHub, etc.)
4. Turn off **Allow new users to sign up**. Accounts are invite-only: a database
   trigger rejects any account without a pending invitation regardless, but
   turning this off avoids confusing errors.
5. Go to Authentication > URL Configuration:
   - Set Site URL to your deployment URL
   - Add redirect URLs for your domains

#### Storage Setup

The migrations create an `employee-documents` bucket. Verify it exists:
1. Go to Storage in your Supabase dashboard
2. Confirm `employee-documents` bucket exists with proper policies

### 3. Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
```

**Where to find these values:**
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings > API** (or **Project Settings > API**)
4. You'll find:
   - **Project URL** → Use for `VITE_SUPABASE_URL`
   - **Project Reference ID** → Use for `VITE_SUPABASE_PROJECT_ID` (the alphanumeric string in your project URL)
   - **anon/public key** → Use for `VITE_SUPABASE_PUBLISHABLE_KEY`

### 4. Edge Functions Setup

Edge functions are in `supabase/functions/`. Deploy them using Supabase CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Deploy all functions
supabase functions deploy
```

#### Edge Function Secrets

Set these secrets in your Supabase dashboard (**Settings > Edge Functions > Secrets**):

| Secret Name | Description | Where to Find |
|-------------|-------------|---------------|
| `RESEND_API_KEY` | API key for email notifications | [resend.com](https://resend.com) → API Keys |
| `SUPABASE_URL` | Your Supabase project URL | Settings > API → Project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon/public key | Settings > API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key | Settings > API → service_role key (keep secret!) |
| `CRON_SECRET` | Random string for cron security, sent by cron jobs in the `x-cron-secret` header. Cron functions refuse every request while it is unset | Generate your own (e.g., `openssl rand -hex 32`) |
| `APP_URL` | Public URL of the web app, used for links in emails. `invite-employee` only accepts invite redirect URLs on this host or its subdomains (plus `localhost`/`127.0.0.1`) | Your deployment URL, e.g. `https://hr.example.com` |
| `EXTRA_REDIRECT_HOSTS` | Optional. Comma-separated extra hosts allowed as invite redirect targets, e.g. a preview domain. Entries match exactly; prefix with `*.` to allow subdomains (`*.preview.example.com`) | Your own hosting setup |

> **Note:** The `service_role` key has full database access and bypasses RLS. Never expose it in client-side code.

### 5. Cron Jobs (Optional)

For automated reminders and notifications, set up cron jobs manually via the SQL Editor. 

> **Important:** Cron jobs are NOT included in migrations because they contain project-specific URLs and secrets. You must set these up manually after deployment.

#### Prerequisites
First, enable the required extensions (if not already enabled):
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

#### Available Cron Jobs

Replace `your-project-id` with your actual Supabase project ID and `YOUR_CRON_SECRET` with your cron secret.

The cron functions authenticate the caller with the `x-cron-secret` header (compared against the `CRON_SECRET` function secret); an `Authorization: Bearer ...` header is not accepted in its place. The weekly event notification can also be sent manually from the Company Calendar by users with **manage** access to the calendar module.

```sql
-- 1. Attendance reminders (every 10 min during work hours, Mon-Sat)
SELECT cron.schedule(
  'attendance-reminders-job',
  '*/10 8-19 * * 1-6',
  $$
  SELECT net.http_post(
    url:='https://your-project-id.supabase.co/functions/v1/attendance-reminders',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'YOUR_CRON_SECRET'
    ),
    body:='{}'::jsonb
  );
  $$
);

-- 2. Goal reminders (daily at 9 AM UTC)
SELECT cron.schedule(
  'daily-goal-reminders',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url:='https://your-project-id.supabase.co/functions/v1/goal-reminders',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'YOUR_CRON_SECRET'
    ),
    body:='{}'::jsonb
  );
  $$
);

-- 3. Onboarding reminders (daily at 9 AM UTC)
SELECT cron.schedule(
  'onboarding-reminders-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url:='https://your-project-id.supabase.co/functions/v1/onboarding-reminders',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'YOUR_CRON_SECRET'
    ),
    body:='{}'::jsonb
  );
  $$
);

-- 4. Weekly event notifications (every Monday at 8 AM UTC)
SELECT cron.schedule(
  'weekly-event-notifications',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url:='https://your-project-id.supabase.co/functions/v1/event-notification',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'YOUR_CRON_SECRET'
    ),
    body:='{}'::jsonb
  );
  $$
);

-- 5. Monthly payroll generation (27th of every month at 2 AM UTC)
SELECT cron.schedule(
  'generate-monthly-payroll',
  '0 2 27 * *',
  $$
  SELECT net.http_post(
    url:='https://your-project-id.supabase.co/functions/v1/generate-monthly-payroll',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'YOUR_CRON_SECRET'
    ),
    body:='{}'::jsonb
  );
  $$
);
```

#### Managing Cron Jobs
```sql
-- View all scheduled jobs
SELECT * FROM cron.job;

-- Unschedule a job by name
SELECT cron.unschedule('job-name');
```

### 6. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 7. Create Initial Admin User

There is no public sign-up, so the first admin is created by invitation:

1. In the Supabase SQL Editor, invite yourself as admin:

   ```sql
   INSERT INTO public.user_invitations (email, roles)
   VALUES ('you@company.com', '{admin}');
   ```

2. In the Supabase Dashboard go to Authentication > Users > **Invite user** and
   enter the same email. Open the email, set a password, and sign in.

After that, invite everyone else from the app (Onboarding page). The last
admin can't be removed, so the organisation can't lock itself out.

## Deployment

### Automatic Version Sync

When deploying, the `APP_VERSION` is automatically updated from the latest git tag. This ensures your deployed instance shows the correct version in the changelog.

**How it works:**
- The CI/CD workflows (Vercel, Netlify) run `scripts/update-version.sh` before building
- The script reads the latest git tag (e.g., `v1.0.1`) and updates `src/lib/version.ts`
- The version is then baked into the build

**For manual deployments:**
```bash
# Ensure you have the latest tags
git fetch --tags

# Update version before building
chmod +x scripts/update-version.sh
./scripts/update-version.sh

# Then build
npm run build
```

### Vercel / Netlify

1. Connect your repository
2. Set environment variables in the platform's dashboard
3. Build command: `npm run build`
4. Output directory: `dist`

> **Note:** The GitHub Actions workflows already handle version syncing automatically.

### Docker

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
```

## Project Structure

```
├── src/
│   ├── components/      # React components
│   │   ├── ui/          # shadcn/ui components
│   │   ├── dashboard/   # Dashboard widgets
│   │   ├── employees/   # Employee management
│   │   ├── leaves/      # Leave management
│   │   ├── payroll/     # Payroll components
│   │   └── ...
│   ├── contexts/        # React contexts (Auth)
│   ├── hooks/           # Custom React hooks
│   ├── pages/           # Page components
│   ├── lib/             # Utility functions
│   └── integrations/    # Supabase client & types
├── supabase/
│   ├── functions/       # Edge functions
│   └── migrations/      # Database migrations
└── public/              # Static assets
```

## Roles and Permissions

Everyone gets self-service access to their own profile, leave, attendance,
payslips, reimbursements and goals. Managers also approve and review their
direct reports. Organisation-wide access is granted **per module**, at one of
two levels:

- **View**: read the module's data for the whole organisation
- **Manage**: create, edit and delete, and approve requests

Modules: Employees, Onboarding, Attendance, Leaves, Reimbursements,
Performance, Assets, Payroll, Calendar, Settings.

| Role | Default access |
|------|----------------|
| `admin` | Everything, including roles and permissions (not configurable) |
| `hr` | Manage on every module (editable) |
| `manager` | Their team only (editable) |
| `employee` | Self-service only (editable) |

Admins can change each role's defaults and give individual users extra
modules in **Settings > Users & Access** (for example, give one employee
Manage on Assets only). The same rules are enforced by row-level security in
the database, not just in the UI.

### Testing the security rules

`supabase/tests/run.sh` applies every migration to a throwaway Postgres
database (with a small stand-in for Supabase's auth and storage schemas) and
runs the RLS and permission tests. It runs in CI; locally:

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres supabase/tests/run.sh
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use this for your own projects.
