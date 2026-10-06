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
SELECT tests.rows('HR can save an IFSC code', 'hr',
  $$UPDATE employee_bank_details SET ifsc_code = 'HDFC0001234' WHERE employee_id = '00000000-0000-0000-0000-00000000000a'$$, 1);
SELECT tests.fails('invalid IFSC codes are rejected', 'hr',
  $$UPDATE employee_bank_details SET ifsc_code = 'HDFC1234' WHERE employee_id = '00000000-0000-0000-0000-00000000000a'$$,
  'employee_bank_details_ifsc_code_format');

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
-- Offboarding
-- ===========================================================================
-- Fixtures: Bob holds the laptop and his exit's last working day was
-- yesterday; Alice has resigned (awaiting approval).
INSERT INTO public.asset_assignments (id, asset_id, employee_id) VALUES
  ('80000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b');
INSERT INTO public.employee_exits (id, employee_id, reason, status, notice_date, last_working_day) VALUES
  ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'resignation', 'requested', CURRENT_DATE, CURRENT_DATE + 30),
  ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'termination', 'in_progress', CURRENT_DATE - 30, CURRENT_DATE - 1);

SELECT tests.after('HR starts an offboarding in progress', 'hr',
  $$INSERT INTO employee_exits (employee_id, reason, status, last_working_day)
    VALUES ('00000000-0000-0000-0000-00000000000c', 'end_of_contract', 'requested', CURRENT_DATE + 14)$$,
  $$(SELECT status = 'in_progress' AND decided_by = tests.uid('hr')
     FROM employee_exits WHERE employee_id = '00000000-0000-0000-0000-00000000000c')$$);
SELECT tests.after('employees file resignations as requests', 'carol',
  $$INSERT INTO employee_exits (employee_id, reason, status, last_working_day)
    VALUES ('00000000-0000-0000-0000-00000000000c', 'termination', 'in_progress', CURRENT_DATE + 30)$$,
  $$(SELECT status = 'requested' AND reason = 'resignation' AND requested_by = tests.uid('carol')
     FROM employee_exits WHERE employee_id = '00000000-0000-0000-0000-00000000000c')$$);
SELECT tests.fails('resignations cannot be backdated', 'carol',
  $$INSERT INTO employee_exits (employee_id, reason, last_working_day)
    VALUES ('00000000-0000-0000-0000-00000000000c', 'resignation', CURRENT_DATE - 1)$$, 'past');
SELECT tests.fails('employees cannot offboard someone else', 'carol',
  $$INSERT INTO employee_exits (employee_id, reason, last_working_day)
    VALUES ('00000000-0000-0000-0000-000000000003', 'termination', CURRENT_DATE + 5)$$, 'permission');
SELECT tests.fails('only one open offboarding per person', 'hr',
  $$INSERT INTO employee_exits (employee_id, reason, last_working_day)
    VALUES ('00000000-0000-0000-0000-00000000000a', 'other', CURRENT_DATE + 5)$$, 'employee_exits_one_open');
SELECT tests.rows('employees see their own resignation', 'alice', $$SELECT * FROM employee_exits$$, 1);
SELECT tests.rows('managers see their reports'' exits', 'manager', $$SELECT * FROM employee_exits$$, 1);
SELECT tests.rows('colleagues cannot see exits', 'carol', $$SELECT * FROM employee_exits$$, 0);
SELECT tests.rows('employees can withdraw their resignation', 'alice',
  $$UPDATE employee_exits SET status = 'cancelled' WHERE id = '90000000-0000-0000-0000-000000000001'$$, 1);
SELECT tests.fails('employees cannot approve their own resignation', 'alice',
  $$UPDATE employee_exits SET status = 'in_progress' WHERE id = '90000000-0000-0000-0000-000000000001'$$, 'withdraw');
SELECT tests.fails('employees cannot move their last working day', 'alice',
  $$UPDATE employee_exits SET last_working_day = CURRENT_DATE + 90 WHERE id = '90000000-0000-0000-0000-000000000001'$$, 'withdraw');
SELECT tests.after('HR approves a resignation', 'hr',
  $$UPDATE employee_exits SET status = 'in_progress' WHERE id = '90000000-0000-0000-0000-000000000001'$$,
  $$(SELECT decided_by = tests.uid('hr') AND status = 'in_progress'
     FROM employee_exits WHERE id = '90000000-0000-0000-0000-000000000001')$$);
SELECT tests.after('the planned last day is on the employee record', 'hr',
  $$UPDATE employee_exits SET last_working_day = CURRENT_DATE + 20 WHERE id = '90000000-0000-0000-0000-000000000002'$$,
  $$(SELECT exit_date = CURRENT_DATE + 20 AND status = 'active' FROM employees WHERE id = '00000000-0000-0000-0000-00000000000b')$$);
SELECT tests.after('cancelling an offboarding clears the planned last day', 'hr',
  $$UPDATE employee_exits SET status = 'cancelled' WHERE id = '90000000-0000-0000-0000-000000000002'$$,
  $$(SELECT exit_date IS NULL FROM employees WHERE id = '00000000-0000-0000-0000-00000000000b')$$);
SELECT tests.after('resignations cannot pick email recipients', 'carol',
  $$INSERT INTO employee_exits (employee_id, reason, last_working_day, notify_emails, notify_employee_ids, email_note)
    VALUES ('00000000-0000-0000-0000-00000000000c', 'resignation', CURRENT_DATE + 30, '{x@evil.test}',
            '{00000000-0000-0000-0000-00000000000b}', 'hi')$$,
  $$(SELECT notify_emails = '{}' AND notify_employee_ids = '{}' AND email_note IS NULL
     FROM employee_exits WHERE employee_id = '00000000-0000-0000-0000-00000000000c')$$);
SELECT tests.after('HR picks who the checklist is emailed to', 'hr',
  $$INSERT INTO employee_exits (employee_id, reason, last_working_day, notify_emails, notify_employee_ids, email_note)
    VALUES ('00000000-0000-0000-0000-00000000000c', 'other', CURRENT_DATE + 14, '{it@acme.test}',
            '{00000000-0000-0000-0000-000000000003}', 'Laptop on the last day')$$,
  $$(SELECT notify_emails = '{it@acme.test}' AND email_note = 'Laptop on the last day' AND notified_at IS NULL
     FROM employee_exits WHERE employee_id = '00000000-0000-0000-0000-00000000000c')$$);
SELECT tests.fails('outside recipients must be email addresses', 'hr',
  $$UPDATE employee_exits SET notify_emails = '{not-an-email}' WHERE id = '90000000-0000-0000-0000-000000000002'$$,
  'employee_exits_notify_emails_check');
SELECT tests.fails('email stamps are set by the email function only', 'hr',
  $$UPDATE employee_exits SET notified_at = now() WHERE id = '90000000-0000-0000-0000-000000000002'$$,
  'recorded automatically');
SELECT tests.rows('HR can edit the offboarding checklist template', 'frank',
  $$UPDATE organization_settings SET setting_value = '{"sections": []}' WHERE setting_key = 'offboarding_checklist'$$, 1);
SELECT tests.rows('the template permission covers only the checklist', 'frank',
  $$UPDATE organization_settings SET setting_value = '{}' WHERE setting_key = 'domain_whitelist'$$, 0);
SELECT tests.rows('employees cannot edit the checklist template', 'alice',
  $$UPDATE organization_settings SET setting_value = '{"sections": []}' WHERE setting_key = 'offboarding_checklist'$$, 0);
SELECT tests.fails('exits cannot be completed by editing the status', 'hr',
  $$UPDATE employee_exits SET status = 'completed' WHERE id = '90000000-0000-0000-0000-000000000002'$$, 'last working day');
SELECT tests.fails('employees without onboarding access cannot complete exits', 'alice',
  $$SELECT complete_employee_exit('90000000-0000-0000-0000-000000000002')$$, 'permission');
SELECT tests.fails('exits cannot be completed before the last working day', 'hr',
  $$INSERT INTO employee_exits (employee_id, reason, last_working_day)
      VALUES ('00000000-0000-0000-0000-00000000000c', 'other', CURRENT_DATE + 14);
    SELECT complete_employee_exit((SELECT id FROM employee_exits WHERE employee_id = '00000000-0000-0000-0000-00000000000c'))$$,
  'on or after');
SELECT tests.after('completing an exit offboards the employee and blocks sign-in', 'hr',
  $$SELECT complete_employee_exit('90000000-0000-0000-0000-000000000002')$$,
  $$(SELECT e.status = 'offboarded' AND e.exit_date = CURRENT_DATE - 1 AND p.blocked
       AND (SELECT status = 'completed' FROM employee_exits WHERE id = '90000000-0000-0000-0000-000000000002')
     FROM employees e JOIN profiles p ON p.id = e.user_id
     WHERE e.id = '00000000-0000-0000-0000-00000000000b')$$);
SELECT tests.after('the daily job completes exits and cancels pending leave', 'system',
  $$UPDATE employee_exits SET status = 'in_progress', notice_date = CURRENT_DATE - 10, last_working_day = CURRENT_DATE - 1
      WHERE id = '90000000-0000-0000-0000-000000000001';
    SELECT process_employee_exits()$$,
  $$(SELECT count(*) = 2 FROM employees WHERE status = 'offboarded')
    AND (SELECT status = 'cancelled' FROM leave_requests WHERE id = '30000000-0000-0000-0000-000000000001')
    AND (SELECT blocked FROM profiles WHERE id = tests.uid('alice'))$$);
SELECT tests.fails('users cannot run the daily job', 'hr',
  $$SELECT process_employee_exits()$$, 'permission denied');
SELECT tests.fails('the only admin cannot be offboarded', 'hr',
  $$INSERT INTO employees (id, user_id, employee_code, first_name, last_name, email, designation, hire_date, status)
      VALUES ('00000000-0000-0000-0000-0000000000ad', tests.uid('admin'), 'E-AD', 'Ada', 'A', 'admin@acme.test', 'Admin', '2024-01-01', 'active');
    INSERT INTO employee_exits (employee_id, reason, last_working_day)
      VALUES ('00000000-0000-0000-0000-0000000000ad', 'other', CURRENT_DATE + 5)$$, 'only admin');
SELECT tests.fails('employee status changes go through offboarding', 'hr',
  $$UPDATE employees SET status = 'offboarded' WHERE id = '00000000-0000-0000-0000-00000000000b'$$, 'Start offboarding');
SELECT tests.fails('employees cannot be set inactive', 'hr',
  $$UPDATE employees SET status = 'inactive' WHERE id = '00000000-0000-0000-0000-00000000000b'$$, 'Start offboarding');
SELECT tests.fails('new employees cannot start as offboarded', 'hr',
  $$INSERT INTO employees (employee_code, first_name, last_name, email, designation, hire_date, status)
      VALUES ('E-X', 'X', 'X', 'x@acme.test', 'X', '2026-01-01', 'offboarded')$$, 'start as onboarding');
SELECT tests.after('new hires can still be marked as joined', 'hr',
  $$INSERT INTO employees (id, employee_code, first_name, last_name, email, designation, hire_date, status)
      VALUES ('00000000-0000-0000-0000-0000000000aa', 'E-N', 'Nia', 'N', 'nia@acme.test', 'X', '2026-01-01', 'onboarding');
    UPDATE employees SET status = 'active' WHERE id = '00000000-0000-0000-0000-0000000000aa'$$,
  $$(SELECT status = 'active' FROM employees WHERE id = '00000000-0000-0000-0000-0000000000aa')$$);

-- ===========================================================================
-- Salary revisions
-- ===========================================================================
-- Fixtures: salaries for Alice, Bob and Mona (who also runs payroll); two
-- revisions awaiting approval, Bob's proposed by the admin and Mona's by HR.
INSERT INTO public.salary_structures (employee_id, basic_salary, hra, effective_from) VALUES
  ('00000000-0000-0000-0000-00000000000a', 30000, 10000, '2025-01-01'),
  ('00000000-0000-0000-0000-00000000000b', 20000, 0, '2025-01-01'),
  ('00000000-0000-0000-0000-000000000003', 50000, 0, '2024-01-01');
INSERT INTO public.user_permissions (user_id, module, level) VALUES (tests.uid('manager'), 'payroll', 'manage');
INSERT INTO public.salary_revisions (id, employee_id, revision_type, status, effective_from, basic_salary, created_by) VALUES
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'promotion', 'pending_approval', CURRENT_DATE, 25000, tests.uid('admin')),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'annual_appraisal', 'pending_approval', CURRENT_DATE, 55000, tests.uid('hr'));

SELECT tests.after('payroll admins revise a salary and it applies on its date', 'hr',
  $$INSERT INTO salary_revisions (employee_id, revision_type, effective_from, basic_salary, hra, reason)
    VALUES ('00000000-0000-0000-0000-00000000000a', 'annual_appraisal', CURRENT_DATE, 33000, 10000, 'Strong year')$$,
  $$(SELECT r.status = 'applied' AND (r.previous ->> 'basic_salary')::numeric = 30000 AND r.created_by = tests.uid('hr')
       AND (SELECT basic_salary FROM salary_structures WHERE employee_id = r.employee_id) = 33000
       AND (SELECT change_reason FROM salary_history WHERE employee_id = r.employee_id ORDER BY created_at DESC LIMIT 1)
           = 'Annual appraisal: Strong year'
     FROM salary_revisions r WHERE r.employee_id = '00000000-0000-0000-0000-00000000000a')$$);
SELECT tests.fails('pay only changes through a revision', 'hr',
  $$UPDATE salary_structures SET basic_salary = 1 WHERE employee_id = '00000000-0000-0000-0000-00000000000a'$$, 'Revise salary');
SELECT tests.fails('employees cannot revise salaries', 'alice',
  $$INSERT INTO salary_revisions (employee_id, revision_type, effective_from, basic_salary)
    VALUES ('00000000-0000-0000-0000-00000000000a', 'other', CURRENT_DATE, 99999)$$, 'permission');
SELECT tests.fails('payroll admins cannot revise their own salary', 'manager',
  $$INSERT INTO salary_revisions (employee_id, revision_type, effective_from, basic_salary)
    VALUES ('00000000-0000-0000-0000-000000000003', 'other', CURRENT_DATE + 30, 99999)$$, 'own salary');
SELECT tests.fails('payroll admins cannot set their own initial salary', 'manager',
  $$DELETE FROM salary_structures WHERE employee_id = '00000000-0000-0000-0000-000000000003'$$, 'own salary');
SELECT tests.after('future revisions wait until their date', 'hr',
  $$INSERT INTO salary_revisions (employee_id, revision_type, effective_from, basic_salary, hra)
    VALUES ('00000000-0000-0000-0000-00000000000a', 'promotion', CURRENT_DATE + 10, 40000, 10000)$$,
  $$(SELECT r.status = 'scheduled' AND s.basic_salary = 30000
     FROM salary_revisions r JOIN salary_structures s USING (employee_id)
     WHERE r.employee_id = '00000000-0000-0000-0000-00000000000a')$$);
SELECT tests.after('the daily job applies revisions whose date has come', 'system',
  $$INSERT INTO salary_revisions (employee_id, revision_type, status, effective_from, basic_salary, hra)
      VALUES ('00000000-0000-0000-0000-00000000000a', 'promotion', 'scheduled', CURRENT_DATE + 10, 40000, 10000);
    UPDATE salary_revisions SET effective_from = CURRENT_DATE WHERE employee_id = '00000000-0000-0000-0000-00000000000a';
    SELECT apply_due_salary_revisions()$$,
  $$(SELECT status = 'applied' FROM salary_revisions WHERE employee_id = '00000000-0000-0000-0000-00000000000a')
    AND (SELECT basic_salary FROM salary_structures WHERE employee_id = '00000000-0000-0000-0000-00000000000a') = 40000$$);
SELECT tests.after('backdated revisions add arrears to the next payroll', 'hr',
  $$INSERT INTO payroll_records (employee_id, month, year, basic_salary, net_salary)
      VALUES ('00000000-0000-0000-0000-00000000000a',
              extract(month FROM CURRENT_DATE - interval '1 month')::int, extract(year FROM CURRENT_DATE - interval '1 month')::int,
              30000, 40000)
      ON CONFLICT (employee_id, month, year) DO NOTHING;
    DELETE FROM payroll_records WHERE employee_id = '00000000-0000-0000-0000-00000000000a'
      AND month = extract(month FROM CURRENT_DATE)::int AND year = extract(year FROM CURRENT_DATE)::int;
    INSERT INTO salary_revisions (employee_id, revision_type, effective_from, basic_salary, hra)
      VALUES ('00000000-0000-0000-0000-00000000000a', 'adjustment',
              date_trunc('month', CURRENT_DATE - interval '1 month')::date, 33000, 10000);
    INSERT INTO payroll_records (employee_id, month, year, basic_salary, net_salary)
      VALUES ('00000000-0000-0000-0000-00000000000a', extract(month FROM CURRENT_DATE)::int,
              extract(year FROM CURRENT_DATE)::int, 33000, 43000)$$,
  $$(SELECT p.adjustment_amount = 3000 AND p.net_salary = 46000 AND p.adjustment_note LIKE 'Salary revision: arrears for%'
     FROM payroll_records p
     WHERE p.employee_id = '00000000-0000-0000-0000-00000000000a'
       AND p.month = extract(month FROM CURRENT_DATE)::int AND p.year = extract(year FROM CURRENT_DATE)::int)
    AND (SELECT adjustment_payroll_id IS NOT NULL FROM salary_revisions WHERE employee_id = '00000000-0000-0000-0000-00000000000a')$$);
SELECT tests.after('a revision part-way through an unpaid month is prorated', 'hr',
  $$DELETE FROM payroll_records WHERE employee_id = '00000000-0000-0000-0000-00000000000a'
      AND month = extract(month FROM CURRENT_DATE)::int AND year = extract(year FROM CURRENT_DATE)::int;
    INSERT INTO salary_revisions (employee_id, revision_type, effective_from, basic_salary, hra)
      VALUES ('00000000-0000-0000-0000-00000000000a', 'promotion', CURRENT_DATE, 36000, 10000)$$,
  $$(SELECT adjustment_amount = -round(6000.0
        * employee_working_days(employee_id, date_trunc('month', CURRENT_DATE)::date, CURRENT_DATE - 1)
        / employee_working_days(employee_id, date_trunc('month', CURRENT_DATE)::date,
                                (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date), 2)
     FROM salary_revisions WHERE employee_id = '00000000-0000-0000-0000-00000000000a')$$);
SELECT tests.fails('only admins switch salary revision approval', 'hr',
  $$UPDATE organization_settings SET setting_value = '{"enabled": true}' WHERE setting_key = 'salary_revision_approval'$$, 'Only admins');
SELECT tests.after('with approval on, revisions wait for approval', 'admin',
  $$UPDATE organization_settings SET setting_value = '{"enabled": true}' WHERE setting_key = 'salary_revision_approval';
    INSERT INTO salary_revisions (employee_id, revision_type, effective_from, basic_salary, hra)
      VALUES ('00000000-0000-0000-0000-00000000000a', 'annual_appraisal', CURRENT_DATE, 33000, 10000)$$,
  $$(SELECT r.status = 'pending_approval' AND s.basic_salary = 30000
     FROM salary_revisions r JOIN salary_structures s USING (employee_id)
     WHERE r.employee_id = '00000000-0000-0000-0000-00000000000a')$$);
SELECT tests.fails('nobody approves a revision they submitted', 'admin',
  $$UPDATE salary_revisions SET status = 'scheduled' WHERE id = 'a0000000-0000-0000-0000-000000000001'$$, 'Someone else');
SELECT tests.fails('nobody approves their own salary revision', 'manager',
  $$UPDATE salary_revisions SET status = 'scheduled' WHERE id = 'a0000000-0000-0000-0000-000000000002'$$, 'own salary');
SELECT tests.fails('nobody cancels a revision of their own salary', 'manager',
  $$UPDATE salary_revisions SET status = 'cancelled' WHERE id = 'a0000000-0000-0000-0000-000000000002'$$, 'own salary');
SELECT tests.after('another payroll admin approves and the revision applies', 'hr',
  $$UPDATE salary_revisions SET status = 'scheduled' WHERE id = 'a0000000-0000-0000-0000-000000000001'$$,
  $$(SELECT r.status = 'applied' AND r.decided_by = tests.uid('hr')
       AND (SELECT basic_salary FROM salary_structures WHERE employee_id = r.employee_id) = 25000
     FROM salary_revisions r WHERE r.id = 'a0000000-0000-0000-0000-000000000001')$$);
SELECT tests.after('a rejected revision changes nothing', 'hr',
  $$UPDATE salary_revisions SET status = 'rejected', decision_notes = 'Next cycle' WHERE id = 'a0000000-0000-0000-0000-000000000001'$$,
  $$(SELECT status = 'rejected' FROM salary_revisions WHERE id = 'a0000000-0000-0000-0000-000000000001')
    AND (SELECT basic_salary FROM salary_structures WHERE employee_id = '00000000-0000-0000-0000-00000000000b') = 20000$$);
SELECT tests.fails('revisions cannot be edited', 'hr',
  $$UPDATE salary_revisions SET basic_salary = 90000 WHERE id = 'a0000000-0000-0000-0000-000000000001'$$, 'can''t be edited');
SELECT tests.rows('employees cannot approve revisions', 'bob',
  $$UPDATE salary_revisions SET status = 'scheduled' WHERE id = 'a0000000-0000-0000-0000-000000000001'$$, 0);
SELECT tests.rows('employees do not see proposals for their pay', 'bob', $$SELECT * FROM salary_revisions$$, 0);
SELECT tests.after('employees see their revision once it is agreed', 'hr',
  $$UPDATE salary_revisions SET status = 'scheduled' WHERE id = 'a0000000-0000-0000-0000-000000000001';
    SELECT tests.login('bob');
    CREATE TEMP TABLE seen ON COMMIT DROP AS SELECT count(*) AS n FROM salary_revisions;
    SELECT tests.logout()$$,
  $$(SELECT n = 1 FROM seen)$$);

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
