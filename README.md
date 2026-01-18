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

All migrations are in `supabase/migrations/`. Run them in order via the Supabase SQL Editor:

1. Go to your Supabase Dashboard > SQL Editor
2. Run each migration file in chronological order (files are timestamped)

The migrations will create:
- All required tables (employees, departments, leaves, payroll, etc.)
- Row Level Security (RLS) policies
- Database functions and triggers
- Storage buckets for documents

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
4. Go to Authentication > URL Configuration:
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

Set these secrets in your Supabase dashboard (Settings > Edge Functions > Secrets):

| Secret Name | Description |
|-------------|-------------|
| `RESEND_API_KEY` | API key from [resend.com](https://resend.com) for email notifications |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (Settings > API) |
| `CRON_SECRET` | Random string for securing cron job endpoints |

### 5. Cron Jobs (Optional)

For automated reminders, set up cron jobs in SQL Editor:

```sql
-- Attendance reminders (daily at 9 AM)
SELECT cron.schedule(
  'attendance-reminder',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url:='https://your-project-id.supabase.co/functions/v1/attendance-reminders',
    headers:='{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  );
  $$
);

-- Goal reminders (weekly on Monday)
SELECT cron.schedule(
  'goal-reminder',
  '0 9 * * 1',
  $$
  SELECT net.http_post(
    url:='https://your-project-id.supabase.co/functions/v1/goal-reminders',
    headers:='{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  );
  $$
);
```

### 6. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 7. Create Initial Admin User

1. Sign up through the app
2. In Supabase SQL Editor, promote yourself to admin:

```sql
-- Find your user ID
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Add admin role
INSERT INTO user_roles (user_id, role) 
VALUES ('your-user-id', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

## Deployment

### Vercel / Netlify

1. Connect your repository
2. Set environment variables in the platform's dashboard
3. Build command: `npm run build`
4. Output directory: `dist`

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

## User Roles

| Role | Permissions |
|------|-------------|
| `admin` | Full system access, user management |
| `hr` | Employee management, payroll, reports |
| `manager` | Team management, leave approvals |
| `employee` | Self-service (profile, leaves, documents) |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use this for your own projects.
