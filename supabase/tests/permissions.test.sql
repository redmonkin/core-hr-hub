-- Security tests for invite-only accounts, module permissions, RLS and the
-- integrity triggers. Each check impersonates a user the way PostgREST does
-- (role + request.jwt.claims) and runs inside a rolled-back subtransaction,
-- so checks don't affect each other. Run with ./run.sh.

\set QUIET on
\pset format unaligned
\pset tuples_only on
-- results are collected in tests.results and printed at the end
\o /dev/null

-- ===========================================================================
-- Test harness
-- ===========================================================================
CREATE SCHEMA tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated;

CREATE TABLE tests.users (name text PRIMARY KEY, id uuid NOT NULL);
CREATE TABLE tests.results (n serial, name text, ok boolean, detail text);
GRANT SELECT ON tests.users TO anon, authenticated;
GRANT ALL ON tests.results TO anon, authenticated;
GRANT USAGE ON SEQUENCE tests.results_n_seq TO anon, authenticated;

CREATE FUNCTION tests.uid(_name text) RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT id FROM tests.users WHERE name = _name $$;
GRANT EXECUTE ON FUNCTION tests.uid(text) TO anon, authenticated;

-- Act as a signed-in user, 'anon' (logged out) or 'system' (no request
-- context, like the auth server or a cron job). Call tests.logout() after.
CREATE FUNCTION tests.login(_name text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF _name = 'system' THEN
    RETURN;
  ELSIF _name = 'anon' THEN
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', false);
    PERFORM set_config('role', 'anon', false);
  ELSE
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', tests.uid(_name), 'role', 'authenticated')::text, false);
    PERFORM set_config('role', 'authenticated', false);
  END IF;
END $$;

CREATE FUNCTION tests.logout() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'postgres', false);
  PERFORM set_config('request.jwt.claims', '', false);
END $$;
GRANT EXECUTE ON FUNCTION tests.logout() TO anon, authenticated;

-- Run _sql as _user; pass if it affects/returns exactly _expected rows.
CREATE FUNCTION tests.rows(_name text, _user text, _sql text, _expected int) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  _n int;
  _err text;
BEGIN
  BEGIN
    PERFORM tests.login(_user);
    IF _sql ~* '^\s*(select|with)' THEN
      EXECUTE format('SELECT count(*) FROM (%s) q', _sql) INTO _n;
    ELSE
      EXECUTE _sql;
      GET DIAGNOSTICS _n = ROW_COUNT;
    END IF;
    RAISE EXCEPTION 'tests:rollback' USING DETAIL = _n::text;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS _err = MESSAGE_TEXT;
    PERFORM tests.logout();
    IF _err = 'tests:rollback' THEN
      GET STACKED DIAGNOSTICS _err = PG_EXCEPTION_DETAIL;
      INSERT INTO tests.results (name, ok, detail)
      VALUES (_name, _err::int = _expected, format('expected %s rows, got %s', _expected, _err));
    ELSE
      INSERT INTO tests.results (name, ok, detail)
      VALUES (_name, false, format('expected %s rows, got error: %s', _expected, _err));
    END IF;
  END;
END $$;

-- Run _sql as _user; pass if it raises an error matching _pattern.
CREATE FUNCTION tests.fails(_name text, _user text, _sql text, _pattern text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  _err text;
BEGIN
  BEGIN
    PERFORM tests.login(_user);
    EXECUTE _sql;
    RAISE EXCEPTION 'tests:no-error';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS _err = MESSAGE_TEXT;
    PERFORM tests.logout();
    INSERT INTO tests.results (name, ok, detail)
    VALUES (_name, _err <> 'tests:no-error' AND _err ~* _pattern,
            CASE WHEN _err = 'tests:no-error' THEN 'expected an error, statement succeeded'
                 ELSE format('error: %s', _err) END);
  END;
END $$;

-- Run _sql as _user, then evaluate _check (as superuser, inside the same
-- subtransaction) and pass if it's true.
CREATE FUNCTION tests.after(_name text, _user text, _sql text, _check text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  _ok boolean;
  _err text;
BEGIN
  BEGIN
    PERFORM tests.login(_user);
    EXECUTE _sql;
    PERFORM tests.logout();
    EXECUTE format('SELECT (%s)', _check) INTO _ok;
    RAISE EXCEPTION 'tests:rollback' USING DETAIL = COALESCE(_ok::text, 'null');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS _err = MESSAGE_TEXT;
    PERFORM tests.logout();
    IF _err = 'tests:rollback' THEN
      GET STACKED DIAGNOSTICS _err = PG_EXCEPTION_DETAIL;
      INSERT INTO tests.results (name, ok, detail) VALUES (_name, _err = 'true', format('check was %s', _err));
    ELSE
      INSERT INTO tests.results (name, ok, detail) VALUES (_name, false, format('error: %s', _err));
    END IF;
  END;
END $$;

-- ===========================================================================
-- Fixtures (as superuser: RLS bypassed, triggers see no end-user request)
-- ===========================================================================
INSERT INTO public.user_invitations (email, roles) VALUES
  ('admin@acme.test', '{admin}'),
  ('hr@acme.test', '{hr}'),
  ('manager@acme.test', '{manager}'),
  ('alice@acme.test', '{employee}'),
  ('bob@acme.test', '{employee}'),
  ('carol@acme.test', '{employee}'),
  ('dave@acme.test', '{employee}'),
  ('erin@acme.test', '{hr}'),
  ('frank@acme.test', '{employee}');

-- Employee records for alice and erin exist before their accounts, the way
-- HR creates them during onboarding; the new-user trigger links them by email.
INSERT INTO public.employees (id, employee_code, first_name, last_name, email, designation, hire_date, status) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'E-A', 'Alice', 'A', 'alice@acme.test', 'Engineer', '2025-01-01', 'active'),
  ('00000000-0000-0000-0000-00000000000e', 'E-E', 'Erin', 'E', 'erin@acme.test', 'HR', '2025-01-01', 'active');

INSERT INTO auth.users (id, email) VALUES
  ('10000000-0000-0000-0000-000000000001', 'admin@acme.test'),
  ('10000000-0000-0000-0000-000000000002', 'hr@acme.test'),
  ('10000000-0000-0000-0000-000000000003', 'manager@acme.test'),
  ('10000000-0000-0000-0000-00000000000a', 'alice@acme.test'),
  ('10000000-0000-0000-0000-00000000000b', 'bob@acme.test'),
  ('10000000-0000-0000-0000-00000000000c', 'carol@acme.test'),
  ('10000000-0000-0000-0000-00000000000d', 'dave@acme.test'),
  ('10000000-0000-0000-0000-00000000000e', 'erin@acme.test'),
  ('10000000-0000-0000-0000-00000000000f', 'frank@acme.test');

INSERT INTO tests.users VALUES
  ('admin', '10000000-0000-0000-0000-000000000001'),
  ('hr', '10000000-0000-0000-0000-000000000002'),
  ('manager', '10000000-0000-0000-0000-000000000003'),
  ('alice', '10000000-0000-0000-0000-00000000000a'),   -- employee, reports to manager
  ('bob', '10000000-0000-0000-0000-00000000000b'),     -- employee, other team
  ('carol', '10000000-0000-0000-0000-00000000000c'),   -- employee with assets:manage only
  ('dave', '10000000-0000-0000-0000-00000000000d'),    -- invited, not onboarded (no employee record)
  ('erin', '10000000-0000-0000-0000-00000000000e'),    -- HR, but blocked
  ('frank', '10000000-0000-0000-0000-00000000000f');   -- employee with onboarding:manage only

INSERT INTO public.employees (id, user_id, employee_code, first_name, last_name, email, designation, hire_date, status) VALUES
  ('00000000-0000-0000-0000-000000000003', tests.uid('manager'), 'E-M', 'Mona', 'M', 'manager@acme.test', 'Lead', '2024-01-01', 'active'),
  ('00000000-0000-0000-0000-00000000000b', tests.uid('bob'), 'E-B', 'Bob', 'B', 'bob@acme.test', 'Engineer', '2025-01-01', 'active'),
  ('00000000-0000-0000-0000-00000000000c', tests.uid('carol'), 'E-C', 'Carol', 'C', 'carol@acme.test', 'IT', '2025-01-01', 'active');
UPDATE public.employees SET manager_id = '00000000-0000-0000-0000-000000000003'
  WHERE id = '00000000-0000-0000-0000-00000000000a';

INSERT INTO public.user_permissions (user_id, module, level) VALUES
  (tests.uid('carol'), 'assets', 'manage'),
  (tests.uid('frank'), 'onboarding', 'manage');
UPDATE public.profiles SET blocked = true WHERE id = tests.uid('erin');

INSERT INTO public.employee_bank_details (employee_id, bank_name, bank_account_number) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Bank', '1111'),
  ('00000000-0000-0000-0000-00000000000b', 'Bank', '2222');
INSERT INTO public.payroll_records (employee_id, month, year, basic_salary, net_salary) VALUES
  ('00000000-0000-0000-0000-00000000000a', 9, 2026, 100, 100),
  ('00000000-0000-0000-0000-00000000000b', 9, 2026, 100, 100);
INSERT INTO public.leave_types (id, name) VALUES ('20000000-0000-0000-0000-000000000001', 'Casual');
INSERT INTO public.leave_requests (id, employee_id, leave_type_id, start_date, end_date, days_count) VALUES
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a',
   '20000000-0000-0000-0000-000000000001', '2026-10-10', '2026-10-11', 2);
INSERT INTO public.reimbursement_requests (id, employee_id, category, amount, expense_date, description, receipt_url)
SELECT '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a',
       (enum_range(NULL::public.expense_category))[1], 500, '2026-09-01', 'Taxi',
       '00000000-0000-0000-0000-00000000000a/r.pdf';
INSERT INTO public.assets (id, asset_code, name, category) VALUES
  ('50000000-0000-0000-0000-000000000001', 'LAP-1', 'Laptop', 'laptop');
INSERT INTO public.goals (id, employee_id, title) VALUES
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Ship it');
INSERT INTO public.performance_reviews (id, employee_id, reviewer_id, review_period, status, overall_rating) VALUES
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-000000000003', 'H1 2026', 'submitted', 4);
INSERT INTO public.attendance_records (id, employee_id, date, clock_in) VALUES
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', current_date, now() - interval '8 hours');
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('employee-documents', '00000000-0000-0000-0000-00000000000a/contract.pdf'),
  ('employee-documents', '00000000-0000-0000-0000-00000000000b/contract.pdf'),
  ('reimbursement-receipts', '00000000-0000-0000-0000-00000000000a/r.pdf');

-- ===========================================================================
-- Invite-only accounts
-- ===========================================================================
DO $$ BEGIN
  INSERT INTO tests.results (name, ok, detail) SELECT
    'invitation roles are applied on sign-up',
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = tests.uid('admin') AND role = 'admin')
      AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = tests.uid('hr') AND role = 'hr')
      AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = tests.uid('alice') AND role <> 'employee'),
    '';
  INSERT INTO tests.results (name, ok, detail) SELECT
    'new accounts are linked to their invitation',
    (SELECT count(*) FROM user_invitations WHERE accepted_user_id IS NOT NULL) = 9, '';
  INSERT INTO tests.results (name, ok, detail) SELECT
    'invitations stay open until the account is set up',
    (SELECT count(*) FROM user_invitations WHERE accepted_at IS NOT NULL) = 0, '';
  INSERT INTO tests.results (name, ok, detail) SELECT
    'existing employee record is linked to the new account by email',
    (SELECT user_id FROM employees WHERE id = '00000000-0000-0000-0000-00000000000a') = tests.uid('alice'), '';
END $$;

SELECT tests.fails('sign-up without an invitation is rejected', 'system',
  $$INSERT INTO auth.users (email) VALUES ('stranger@evil.test')$$, 'invite-only');
SELECT tests.fails('an accepted invitation cannot be reused', 'system',
  $$INSERT INTO auth.users (email) VALUES ('ALICE@acme.test')$$, 'invite-only');
INSERT INTO public.user_invitations (email, revoked_at) VALUES ('revoked@acme.test', now());
INSERT INTO public.user_invitations (email, expires_at) VALUES ('expired@acme.test', now() - interval '1 day');
SELECT tests.fails('a revoked invitation does not allow sign-up', 'system',
  $$INSERT INTO auth.users (email) VALUES ('revoked@acme.test')$$, 'invite-only');
SELECT tests.fails('an expired invitation does not allow sign-up', 'system',
  $$INSERT INTO auth.users (email) VALUES ('expired@acme.test')$$, 'invite-only');
INSERT INTO public.user_invitations (email) VALUES ('newhire@acme.test');
SELECT tests.rows('an open invitation allows sign-up (any letter case)', 'system',
  $$INSERT INTO auth.users (email) VALUES ('NewHire@acme.test')$$, 1);
SELECT tests.after('invitations from HR default to the employee role', 'hr',
  $$INSERT INTO user_invitations (email) VALUES ('newbie@acme.test')$$,
  $$(SELECT roles FROM user_invitations WHERE email = 'newbie@acme.test') = '{employee}'$$);
SELECT tests.fails('HR cannot invite someone as admin', 'hr',
  $$INSERT INTO user_invitations (email, roles) VALUES ('boss@acme.test', '{admin}')$$, 'elevated roles');
SELECT tests.rows('admin can invite someone as admin', 'admin',
  $$INSERT INTO user_invitations (email, roles) VALUES ('boss@acme.test', '{admin}')$$, 1);
SELECT tests.fails('plain employees cannot create invitations', 'alice',
  $$INSERT INTO user_invitations (email) VALUES ('friend@acme.test')$$, 'row-level security');
SELECT tests.rows('plain employees cannot list invitations', 'alice',
  $$SELECT * FROM user_invitations$$, 0);

-- Onboarding: an invitation sent with a new employee record
INSERT INTO public.employees (id, employee_code, first_name, last_name, email, designation, hire_date, status) VALUES
  ('00000000-0000-0000-0000-000000000099', 'E-G', 'Gina', 'G', 'gina@acme.test', 'Designer', '2026-10-01', 'onboarding');
INSERT INTO public.user_invitations (email, full_name, employee_id, invited_by) VALUES
  ('gina@acme.test', 'Gina G', '00000000-0000-0000-0000-000000000099', tests.uid('hr'));
INSERT INTO auth.users (id, email) VALUES ('10000000-0000-0000-0000-000000000099', 'gina@acme.test');
DO $$ BEGIN
  INSERT INTO tests.results (name, ok, detail) SELECT
    'an invited account is linked to the employee record it was sent for',
    (SELECT user_id FROM employees WHERE id = '00000000-0000-0000-0000-000000000099') = '10000000-0000-0000-0000-000000000099', '';
  INSERT INTO tests.results (name, ok, detail) SELECT
    'a new hire stays in onboarding until they set up their account',
    (SELECT status FROM employees WHERE id = '00000000-0000-0000-0000-000000000099') = 'onboarding'
      AND NOT EXISTS (SELECT 1 FROM leave_balances WHERE employee_id = '00000000-0000-0000-0000-000000000099'), '';
END $$;
UPDATE auth.users SET email_confirmed_at = now(), last_sign_in_at = now()
  WHERE id = '10000000-0000-0000-0000-000000000099';
DO $$ BEGIN
  INSERT INTO tests.results (name, ok, detail) SELECT
    'setting up the account accepts the invitation',
    (SELECT accepted_at IS NOT NULL FROM user_invitations WHERE email = 'gina@acme.test'), '';
  INSERT INTO tests.results (name, ok, detail) SELECT
    'setting up the account activates the employee and creates leave balances',
    (SELECT status FROM employees WHERE id = '00000000-0000-0000-0000-000000000099') = 'active'
      AND EXISTS (SELECT 1 FROM leave_balances WHERE employee_id = '00000000-0000-0000-0000-000000000099'), '';
  INSERT INTO tests.results (name, ok, detail) SELECT
    'whoever sent the invitation is notified when the new hire joins',
    EXISTS (SELECT 1 FROM notifications WHERE user_id = tests.uid('hr') AND title = 'New hire joined'), '';
END $$;
SELECT tests.fails('the invitation cannot be accepted again from the client', 'hr',
  $$SELECT public.complete_invitation('10000000-0000-0000-0000-000000000099')$$, 'permission denied');

-- Domain whitelist enforced server-side
INSERT INTO public.organization_settings (setting_key, setting_value)
VALUES ('domain_whitelist', '{"enabled": true, "domains": ["acme.test"]}')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;
SELECT tests.fails('invitations to non-whitelisted domains are rejected', 'hr',
  $$INSERT INTO user_invitations (email) VALUES ('someone@gmail.com')$$, 'approved domains');
SELECT tests.fails('look-alike domains are rejected', 'hr',
  $$INSERT INTO user_invitations (email) VALUES ('someone@notacme.test')$$, 'approved domains');
SELECT tests.rows('whitelisted domains can be invited', 'hr',
  $$INSERT INTO user_invitations (email) VALUES ('someone@ACME.test')$$, 1);
SELECT tests.fails('changing your email to a non-whitelisted domain is rejected', 'system',
  $$UPDATE auth.users SET email = 'alice@gmail.com' WHERE id = tests.uid('alice')$$, 'approved domains');
SELECT tests.rows('changing your email within the whitelist works', 'system',
  $$UPDATE auth.users SET email = 'alice2@acme.test' WHERE id = tests.uid('alice')$$, 1);
UPDATE public.organization_settings SET setting_value = '{"enabled": false, "domains": []}' WHERE setting_key = 'domain_whitelist';

-- ===========================================================================
-- Admin safety
-- ===========================================================================
SELECT tests.fails('the last admin cannot be removed', 'admin',
  $$DELETE FROM user_roles WHERE user_id = tests.uid('admin') AND role = 'admin'$$, 'last admin');
SELECT tests.rows('HR cannot grant roles', 'hr',
  $$UPDATE user_roles SET role = 'admin' WHERE user_id = tests.uid('hr')$$, 0);
SELECT tests.fails('employees cannot grant themselves roles', 'alice',
  $$INSERT INTO user_roles (user_id, role) VALUES (tests.uid('alice'), 'admin')$$, 'row-level security');
SELECT tests.fails('HR cannot grant module permissions', 'hr',
  $$INSERT INTO user_permissions (user_id, module, level) VALUES (tests.uid('alice'), 'payroll', 'manage')$$, 'row-level security');
SELECT tests.rows('admin can grant module permissions', 'admin',
  $$INSERT INTO user_permissions (user_id, module, level) VALUES (tests.uid('alice'), 'payroll', 'view')$$, 1);

-- ===========================================================================
-- Permission resolution
-- ===========================================================================
SELECT tests.after('get_my_permissions: assets-only user', 'carol',
  $$SELECT set_config('tests.perms', get_my_permissions()::text, true)$$,
  $$current_setting('tests.perms')::jsonb -> 'modules' = '{"assets": "manage"}'$$);
SELECT tests.after('get_my_permissions: HR manages every module', 'hr',
  $$SELECT set_config('tests.perms', get_my_permissions()::text, true)$$,
  $$(SELECT count(*) FROM jsonb_each_text(current_setting('tests.perms')::jsonb -> 'modules') WHERE value = 'manage') = 10$$);
SELECT tests.after('get_my_permissions: plain employee has no module access', 'alice',
  $$SELECT set_config('tests.perms', get_my_permissions()::text, true)$$,
  $$current_setting('tests.perms')::jsonb -> 'modules' = '{}'$$);
SELECT tests.after('get_my_permissions: blocked HR has no module access', 'erin',
  $$SELECT set_config('tests.perms', get_my_permissions()::text, true)$$,
  $$current_setting('tests.perms')::jsonb -> 'modules' = '{}' AND (current_setting('tests.perms')::jsonb ->> 'is_blocked')::boolean$$);
SELECT tests.rows('admin can narrow a role default (HR loses payroll)', 'admin',
  $$UPDATE role_permissions SET level = 'view' WHERE role = 'hr' AND module = 'payroll'$$, 1);
SELECT tests.fails('the admin role itself cannot be given role defaults', 'admin',
  $$INSERT INTO role_permissions (role, module, level) VALUES ('admin', 'assets', 'view')$$, 'role_permissions_not_admin');

-- ===========================================================================
-- Function privileges
-- ===========================================================================
SELECT tests.fails('anon cannot call permission functions', 'anon',
  $$SELECT public.can('payroll')$$, 'permission denied');
SELECT tests.fails('users cannot probe other users'' roles via has_role', 'alice',
  $$SELECT public.has_role(tests.uid('admin'), 'admin')$$, 'permission denied');
SELECT tests.fails('users cannot probe other users'' access via user_can', 'alice',
  $$SELECT public.user_can(tests.uid('hr'), 'payroll')$$, 'permission denied');

-- ===========================================================================
-- Directory and organisation data
-- ===========================================================================
SELECT tests.fails('anon cannot read the employee directory', 'anon',
  $$SELECT * FROM employee_directory$$, 'permission denied');
SELECT tests.rows('invited-but-not-onboarded users see no directory', 'dave',
  $$SELECT * FROM employee_directory$$, 0);
SELECT tests.rows('employees see the whole directory', 'alice',
  $$SELECT * FROM employee_directory$$, 6);
SELECT tests.rows('invited-but-not-onboarded users see no departments or assets', 'dave',
  $$SELECT id FROM departments UNION ALL SELECT id FROM assets UNION ALL SELECT id FROM leave_types$$, 0);
SELECT tests.rows('employees cannot change organisation settings', 'alice',
  $$UPDATE organization_settings SET setting_value = '{}'$$, 0);

-- ===========================================================================
-- Module-scoped access: an assets-only user
-- ===========================================================================
SELECT tests.rows('assets-only user can add assets', 'carol',
  $$INSERT INTO assets (asset_code, name, category) VALUES ('LAP-2', 'Laptop 2', 'laptop')$$, 1);
SELECT tests.rows('assets-only user can assign assets', 'carol',
  $$INSERT INTO asset_assignments (asset_id, employee_id) VALUES ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b')$$, 1);
SELECT tests.rows('assets-only user sees employee names for assignment', 'carol',
  $$SELECT * FROM employees$$, 6);
SELECT tests.rows('assets-only user cannot see payroll', 'carol',
  $$SELECT * FROM payroll_records$$, 0);
SELECT tests.rows('assets-only user cannot see bank details', 'carol',
  $$SELECT * FROM employee_bank_details$$, 0);
SELECT tests.rows('assets-only user cannot see other people''s leave', 'carol',
  $$SELECT * FROM leave_requests$$, 0);
SELECT tests.rows('assets-only user cannot edit employees', 'carol',
  $$UPDATE employees SET designation = 'CEO' WHERE id = '00000000-0000-0000-0000-00000000000b'$$, 0);
SELECT tests.fails('plain employees cannot add assets', 'alice',
  $$INSERT INTO assets (asset_code, name, category) VALUES ('LAP-3', 'x', 'laptop')$$, 'row-level security');

-- ===========================================================================
-- Module-scoped access: an onboarding-only user
-- ===========================================================================
SELECT tests.rows('onboarding-only user can create employee records', 'frank',
  $$INSERT INTO employees (employee_code, first_name, last_name, email, designation, hire_date)
    VALUES ('E-N', 'New', 'Joiner', 'new@acme.test', 'Designer', current_date)$$, 1);
SELECT tests.rows('onboarding-only user can upload a new joiner''s documents', 'frank',
  $$INSERT INTO storage.objects (bucket_id, name) VALUES ('employee-documents', '00000000-0000-0000-0000-00000000000b/offer.pdf') RETURNING id$$, 1);
SELECT tests.rows('onboarding-only user sees accounts to link', 'frank',
  $$SELECT * FROM profiles$$, 10);
SELECT tests.rows('onboarding-only user cannot change existing leave balances', 'frank',
  $$UPDATE leave_balances SET total_days = 99$$, 0);
SELECT tests.rows('onboarding-only user cannot see payroll', 'frank',
  $$SELECT * FROM payroll_records$$, 0);

-- ===========================================================================
-- Payroll and bank details
-- ===========================================================================
SELECT tests.rows('employees see only their own payroll', 'alice', $$SELECT * FROM payroll_records$$, 1);
SELECT tests.rows('HR sees all payroll', 'hr', $$SELECT * FROM payroll_records$$, 2);
SELECT tests.rows('employees see their own bank details', 'alice', $$SELECT * FROM employee_bank_details$$, 1);
SELECT tests.rows('managers cannot see their reports'' bank details', 'manager', $$SELECT * FROM employee_bank_details$$, 0);
SELECT tests.rows('employees cannot change their own bank details', 'alice',
  $$UPDATE employee_bank_details SET bank_account_number = '9999'$$, 0);
SELECT tests.after('bank detail changes record who made them', 'hr',
  $$UPDATE employee_bank_details SET bank_account_number = '3333' WHERE employee_id = '00000000-0000-0000-0000-00000000000a'$$,
  $$(SELECT updated_by FROM employee_bank_details WHERE employee_id = '00000000-0000-0000-0000-00000000000a') = tests.uid('hr')$$);

-- ===========================================================================
-- Employee self-service
-- ===========================================================================
SELECT tests.rows('employees can update their phone number', 'alice',
  $$UPDATE employees SET phone = '123' WHERE user_id = tests.uid('alice')$$, 1);
SELECT tests.fails('employees cannot change their designation', 'alice',
  $$UPDATE employees SET designation = 'CTO' WHERE user_id = tests.uid('alice')$$, 'personal contact details');
SELECT tests.fails('employees cannot change their manager', 'alice',
  $$UPDATE employees SET manager_id = NULL WHERE user_id = tests.uid('alice')$$, 'personal contact details');
SELECT tests.fails('employees cannot change their working days', 'alice',
  $$UPDATE employees SET working_days = '{1}' WHERE user_id = tests.uid('alice')$$, 'personal contact details');
SELECT tests.rows('employees cannot edit colleagues', 'alice',
  $$UPDATE employees SET phone = '1' WHERE id = '00000000-0000-0000-0000-00000000000b'$$, 0);

-- ===========================================================================
-- Leave
-- ===========================================================================
SELECT tests.after('self-submitted leave is always pending', 'alice',
  $$INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, days_count, status, reviewed_by)
    VALUES ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a',
            '20000000-0000-0000-0000-000000000001', '2026-11-01', '2026-11-02', 2, 'approved',
            '00000000-0000-0000-0000-000000000003')$$,
  $$(SELECT status = 'pending' AND reviewed_by IS NULL FROM leave_requests WHERE id = '30000000-0000-0000-0000-000000000002')$$);
SELECT tests.fails('negative leave days are rejected', 'alice',
  $$INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, days_count)
    VALUES ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001', '2026-11-01', '2026-11-02', -30)$$,
  'leave_requests_days_positive');
SELECT tests.fails('employees cannot file leave for colleagues', 'alice',
  $$INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, days_count)
    VALUES ('00000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-000000000001', '2026-11-01', '2026-11-02', 1)$$,
  'row-level security');
SELECT tests.rows('employees cannot approve their own leave', 'alice',
  $$UPDATE leave_requests SET status = 'approved' WHERE id = '30000000-0000-0000-0000-000000000001'$$, 0);
SELECT tests.after('managers approve their reports'' leave (reviewer recorded)', 'manager',
  $$UPDATE leave_requests SET status = 'approved' WHERE id = '30000000-0000-0000-0000-000000000001'$$,
  $$(SELECT status = 'approved' AND reviewed_by = '00000000-0000-0000-0000-000000000003'
     FROM leave_requests WHERE id = '30000000-0000-0000-0000-000000000001')$$);
SELECT tests.fails('managers cannot rewrite leave requests', 'manager',
  $$UPDATE leave_requests SET days_count = 1 WHERE id = '30000000-0000-0000-0000-000000000001'$$, 'approve or reject');
SELECT tests.rows('other managers/employees cannot approve', 'bob',
  $$UPDATE leave_requests SET status = 'approved' WHERE id = '30000000-0000-0000-0000-000000000001'$$, 0);

-- ===========================================================================
-- Reimbursements
-- ===========================================================================
SELECT tests.after('self-submitted reimbursements are always pending', 'alice',
  $$INSERT INTO reimbursement_requests (id, employee_id, category, amount, expense_date, description, receipt_url, status, paid_at)
    SELECT '40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a',
           (enum_range(NULL::expense_category))[1], 100, '2026-09-01', 'x', 'r', 'paid', now()$$,
  $$(SELECT status = 'pending' AND paid_at IS NULL FROM reimbursement_requests WHERE id = '40000000-0000-0000-0000-000000000002')$$);
SELECT tests.fails('zero or negative amounts are rejected', 'alice',
  $$INSERT INTO reimbursement_requests (employee_id, category, amount, expense_date, description, receipt_url)
    SELECT '00000000-0000-0000-0000-00000000000a', (enum_range(NULL::expense_category))[1], 0, '2026-09-01', 'x', 'r'$$,
  'amount_positive');
SELECT tests.rows('managers approve their reports'' claims', 'manager',
  $$UPDATE reimbursement_requests SET status = 'approved' WHERE id = '40000000-0000-0000-0000-000000000001'$$, 1);
SELECT tests.fails('managers cannot mark claims paid', 'manager',
  $$UPDATE reimbursement_requests SET status = 'paid' WHERE id = '40000000-0000-0000-0000-000000000001'$$, 'mark a request as paid');
SELECT tests.fails('managers cannot change claim amounts', 'manager',
  $$UPDATE reimbursement_requests SET amount = 99999 WHERE id = '40000000-0000-0000-0000-000000000001'$$, 'approve or reject');
SELECT tests.rows('HR marks claims paid', 'hr',
  $$UPDATE reimbursement_requests SET status = 'paid', paid_at = now() WHERE id = '40000000-0000-0000-0000-000000000001'$$, 1);

-- ===========================================================================
-- Attendance
-- ===========================================================================
SELECT tests.fails('employees cannot backdate a clock-in', 'alice',
  $$INSERT INTO attendance_records (employee_id, date, clock_in) VALUES ('00000000-0000-0000-0000-00000000000a', current_date - 3, now() - interval '3 days')$$,
  'current time');
SELECT tests.after('clock-in now works and status is forced to present', 'bob',
  $$INSERT INTO attendance_records (id, employee_id, date, clock_in, status, total_hours)
    VALUES ('80000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', current_date, now(), 'remote-bonus', 99)$$,
  $$(SELECT status = 'present' AND total_hours IS NULL FROM attendance_records WHERE id = '80000000-0000-0000-0000-000000000002')$$);
SELECT tests.after('clock-out computes total hours server-side', 'alice',
  $$UPDATE attendance_records SET clock_out = now(), total_hours = 24 WHERE id = '80000000-0000-0000-0000-000000000001'$$,
  $$(SELECT total_hours BETWEEN 7.9 AND 8.1 FROM attendance_records WHERE id = '80000000-0000-0000-0000-000000000001')$$);
SELECT tests.fails('employees cannot move their clock-in time', 'alice',
  $$UPDATE attendance_records SET clock_in = now() - interval '12 hours' WHERE id = '80000000-0000-0000-0000-000000000001'$$,
  'only clock out');
SELECT tests.fails('clock-out cannot be in the future', 'alice',
  $$UPDATE attendance_records SET clock_out = now() + interval '5 hours' WHERE id = '80000000-0000-0000-0000-000000000001'$$,
  'not in the future');
SELECT tests.rows('employees cannot delete attendance', 'alice',
  $$DELETE FROM attendance_records WHERE id = '80000000-0000-0000-0000-000000000001'$$, 0);
SELECT tests.rows('managers see their reports'' attendance', 'manager',
  $$SELECT * FROM attendance_records WHERE employee_id = '00000000-0000-0000-0000-00000000000a'$$, 1);

-- ===========================================================================
-- Performance
-- ===========================================================================
SELECT tests.fails('employees cannot set the manager rating on their goals', 'alice',
  $$UPDATE goals SET manager_rating = 5 WHERE id = '60000000-0000-0000-0000-000000000001'$$, 'manager rating');
SELECT tests.rows('employees set their own goal rating', 'alice',
  $$UPDATE goals SET employee_rating = 4 WHERE id = '60000000-0000-0000-0000-000000000001'$$, 1);
SELECT tests.rows('managers set the manager rating', 'manager',
  $$UPDATE goals SET manager_rating = 3 WHERE id = '60000000-0000-0000-0000-000000000001'$$, 1);
SELECT tests.fails('managers cannot set the employee''s self-rating', 'manager',
  $$UPDATE goals SET employee_rating = 1 WHERE id = '60000000-0000-0000-0000-000000000001'$$, 'their own rating');
SELECT tests.after('employees can acknowledge a submitted review', 'alice',
  $$UPDATE performance_reviews SET status = 'acknowledged' WHERE id = '70000000-0000-0000-0000-000000000001'$$,
  $$(SELECT status = 'acknowledged' AND acknowledged_by = tests.uid('alice') FROM performance_reviews WHERE id = '70000000-0000-0000-0000-000000000001')$$);
SELECT tests.fails('employees cannot change their review rating', 'alice',
  $$UPDATE performance_reviews SET overall_rating = 5 WHERE id = '70000000-0000-0000-0000-000000000001'$$, 'acknowledge');

-- ===========================================================================
-- Onboarding
-- ===========================================================================
SELECT tests.fails('applicants cannot reference other people''s documents', 'dave',
  $$INSERT INTO onboarding_requests (user_id, full_name, email, phone, address, date_of_birth, gender, designation, joining_date, resume_url, offer_letter_url, id_proof_url)
    VALUES (tests.uid('dave'), 'Dave', 'dave@acme.test', '1', 'a', '1990-01-01', 'm', 'x', '2026-11-01',
            tests.uid('dave') || '/cv.pdf', tests.uid('dave') || '/offer.pdf', tests.uid('bob') || '/id_proof.pdf')$$,
  'uploaded by the applicant');
SELECT tests.after('own documents are accepted and the request is pending', 'dave',
  $$INSERT INTO onboarding_requests (user_id, full_name, email, phone, address, date_of_birth, gender, designation, joining_date, resume_url, offer_letter_url, id_proof_url, status)
    VALUES (tests.uid('dave'), 'Dave', 'dave@acme.test', '1', 'a', '1990-01-01', 'm', 'x', '2026-11-01',
            tests.uid('dave') || '/cv.pdf', tests.uid('dave') || '/offer.pdf', tests.uid('dave') || '/id.pdf', 'approved')$$,
  $$(SELECT status = 'pending' FROM onboarding_requests WHERE user_id = tests.uid('dave'))$$);

-- ===========================================================================
-- Storage
-- ===========================================================================
SELECT tests.rows('employees see their own documents only', 'alice',
  $$SELECT * FROM storage.objects WHERE bucket_id = 'employee-documents'$$, 1);
SELECT tests.rows('employees cannot delete documents in their folder', 'alice',
  $$DELETE FROM storage.objects WHERE bucket_id = 'employee-documents'$$, 0);
SELECT tests.rows('managers can open their reports'' receipts', 'manager',
  $$SELECT * FROM storage.objects WHERE bucket_id = 'reimbursement-receipts'$$, 1);
SELECT tests.rows('others cannot open the receipt', 'bob',
  $$SELECT * FROM storage.objects WHERE bucket_id = 'reimbursement-receipts'$$, 0);

-- ===========================================================================
-- Blocked users
-- ===========================================================================
SELECT tests.rows('blocked users cannot read their own record', 'erin',
  $$SELECT * FROM employees$$, 0);
SELECT tests.rows('blocked HR cannot read payroll', 'erin',
  $$SELECT * FROM payroll_records$$, 0);
SELECT tests.rows('blocked users cannot read receipts or files', 'erin',
  $$SELECT * FROM storage.objects$$, 0);

-- ===========================================================================
-- Report
-- ===========================================================================
\o
SELECT format('%s %s%s', CASE WHEN ok THEN 'ok  ' ELSE 'FAIL' END, name,
              CASE WHEN ok THEN '' ELSE ' -- ' || detail END)
FROM tests.results ORDER BY n;

SELECT format(E'\n%s passed, %s failed', count(*) FILTER (WHERE ok), count(*) FILTER (WHERE NOT ok))
FROM tests.results;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM tests.results WHERE NOT ok) THEN
    RAISE EXCEPTION 'Some security tests failed';
  END IF;
END $$;
