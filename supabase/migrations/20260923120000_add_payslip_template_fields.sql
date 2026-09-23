-- Add fields required to match the standard payslip template:
-- employee bank details (fixed, per-employee) and per-payroll-cycle
-- earning/deduction line items that vary month to month.

alter table public.employees
  add column if not exists bank_name text,
  add column if not exists bank_account_number text;

alter table public.payroll_records
  add column if not exists lta_allowance numeric not null default 0,
  add column if not exists variable_pay numeric not null default 0,
  add column if not exists pf_employer_contribution numeric not null default 0,
  add column if not exists health_insurance numeric not null default 0,
  add column if not exists professional_tax numeric not null default 0,
  add column if not exists tds numeric not null default 0,
  add column if not exists advance_amount_adjusted numeric not null default 0,
  add column if not exists loss_of_pay_days numeric not null default 0;
