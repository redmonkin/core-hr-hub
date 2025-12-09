-- Create enum for application roles
CREATE TYPE public.app_role AS ENUM ('admin', 'hr', 'manager', 'employee');

-- Create enum for employee status
CREATE TYPE public.employee_status AS ENUM ('active', 'inactive', 'onboarding', 'offboarded');

-- Create enum for leave status
CREATE TYPE public.leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- Create enum for asset status
CREATE TYPE public.asset_status AS ENUM ('available', 'assigned', 'maintenance', 'retired');

-- Create enum for payroll status
CREATE TYPE public.payroll_status AS ENUM ('draft', 'processed', 'paid');

-- =====================
-- DEPARTMENTS TABLE
-- =====================
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- =====================
-- PROFILES TABLE
-- =====================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =====================
-- USER ROLES TABLE (Security Critical)
-- =====================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =====================
-- SECURITY DEFINER FUNCTION FOR ROLE CHECKS
-- =====================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user has any admin/hr role
CREATE OR REPLACE FUNCTION public.is_admin_or_hr(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'hr')
  )
$$;

-- =====================
-- EMPLOYEES TABLE
-- =====================
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_code TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  designation TEXT NOT NULL,
  manager_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  hire_date DATE NOT NULL,
  employment_type TEXT DEFAULT 'full-time',
  status employee_status DEFAULT 'onboarding' NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- =====================
-- EMPLOYEE DOCUMENTS TABLE
-- =====================
CREATE TABLE public.employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- =====================
-- LEAVE TYPES TABLE
-- =====================
CREATE TABLE public.leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  days_per_year INTEGER NOT NULL DEFAULT 0,
  is_paid BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

-- =====================
-- LEAVE REQUESTS TABLE
-- =====================
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  leave_type_id UUID REFERENCES public.leave_types(id) ON DELETE RESTRICT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER NOT NULL,
  reason TEXT,
  status leave_status DEFAULT 'pending' NOT NULL,
  reviewed_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- =====================
-- LEAVE BALANCES TABLE
-- =====================
CREATE TABLE public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  leave_type_id UUID REFERENCES public.leave_types(id) ON DELETE CASCADE NOT NULL,
  year INTEGER NOT NULL,
  total_days INTEGER NOT NULL DEFAULT 0,
  used_days INTEGER NOT NULL DEFAULT 0,
  UNIQUE (employee_id, leave_type_id, year)
);

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

-- =====================
-- ASSETS TABLE
-- =====================
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  serial_number TEXT,
  purchase_date DATE,
  purchase_cost DECIMAL(12, 2),
  vendor TEXT,
  warranty_end_date DATE,
  status asset_status DEFAULT 'available' NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- =====================
-- ASSET ASSIGNMENTS TABLE
-- =====================
CREATE TABLE public.asset_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  returned_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;

-- =====================
-- SALARY STRUCTURES TABLE
-- =====================
CREATE TABLE public.salary_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL UNIQUE,
  basic_salary DECIMAL(12, 2) NOT NULL,
  hra DECIMAL(12, 2) DEFAULT 0,
  transport_allowance DECIMAL(12, 2) DEFAULT 0,
  medical_allowance DECIMAL(12, 2) DEFAULT 0,
  other_allowances DECIMAL(12, 2) DEFAULT 0,
  tax_deduction DECIMAL(12, 2) DEFAULT 0,
  other_deductions DECIMAL(12, 2) DEFAULT 0,
  effective_from DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.salary_structures ENABLE ROW LEVEL SECURITY;

-- =====================
-- PAYROLL RECORDS TABLE
-- =====================
CREATE TABLE public.payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  basic_salary DECIMAL(12, 2) NOT NULL,
  total_allowances DECIMAL(12, 2) DEFAULT 0,
  total_deductions DECIMAL(12, 2) DEFAULT 0,
  net_salary DECIMAL(12, 2) NOT NULL,
  status payroll_status DEFAULT 'draft' NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (employee_id, month, year)
);

ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

-- =====================
-- ACTIVITY LOGS TABLE
-- =====================
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- =====================
-- RLS POLICIES
-- =====================

-- Departments: Everyone can view, only admin/hr can modify
CREATE POLICY "Anyone can view departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/HR can manage departments" ON public.departments FOR ALL TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- Profiles: Users can view/update own, admin/hr can view all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- User Roles: Only admins can manage, users can view own
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Employees: Admin/HR full access, managers see team, employees see self
CREATE POLICY "View employees" ON public.employees FOR SELECT TO authenticated USING (
  public.is_admin_or_hr(auth.uid()) OR 
  user_id = auth.uid() OR
  manager_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);
CREATE POLICY "Admin/HR manage employees" ON public.employees FOR ALL TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- Employee Documents: Same as employees
CREATE POLICY "View employee documents" ON public.employee_documents FOR SELECT TO authenticated USING (
  public.is_admin_or_hr(auth.uid()) OR
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);
CREATE POLICY "Admin/HR manage documents" ON public.employee_documents FOR ALL TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- Leave Types: Everyone can view, admin/hr can modify
CREATE POLICY "Anyone can view leave types" ON public.leave_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/HR manage leave types" ON public.leave_types FOR ALL TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- Leave Requests: Employees see/create own, managers see team, admin/hr see all
CREATE POLICY "View leave requests" ON public.leave_requests FOR SELECT TO authenticated USING (
  public.is_admin_or_hr(auth.uid()) OR
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()) OR
  employee_id IN (SELECT id FROM public.employees WHERE manager_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()))
);
CREATE POLICY "Create own leave requests" ON public.leave_requests FOR INSERT TO authenticated WITH CHECK (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);
CREATE POLICY "Update leave requests" ON public.leave_requests FOR UPDATE TO authenticated USING (
  public.is_admin_or_hr(auth.uid()) OR
  employee_id IN (SELECT id FROM public.employees WHERE manager_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()))
);

-- Leave Balances: Employees see own, admin/hr see all
CREATE POLICY "View leave balances" ON public.leave_balances FOR SELECT TO authenticated USING (
  public.is_admin_or_hr(auth.uid()) OR
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);
CREATE POLICY "Admin/HR manage leave balances" ON public.leave_balances FOR ALL TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- Assets: Everyone can view, admin/hr can modify
CREATE POLICY "Anyone can view assets" ON public.assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/HR manage assets" ON public.assets FOR ALL TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- Asset Assignments: Employees see own, admin/hr see all
CREATE POLICY "View asset assignments" ON public.asset_assignments FOR SELECT TO authenticated USING (
  public.is_admin_or_hr(auth.uid()) OR
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);
CREATE POLICY "Admin/HR manage asset assignments" ON public.asset_assignments FOR ALL TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- Salary Structures: Employees see own, admin/hr see all
CREATE POLICY "View salary structures" ON public.salary_structures FOR SELECT TO authenticated USING (
  public.is_admin_or_hr(auth.uid()) OR
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);
CREATE POLICY "Admin/HR manage salary structures" ON public.salary_structures FOR ALL TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- Payroll Records: Employees see own, admin/hr see all
CREATE POLICY "View payroll records" ON public.payroll_records FOR SELECT TO authenticated USING (
  public.is_admin_or_hr(auth.uid()) OR
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);
CREATE POLICY "Admin/HR manage payroll" ON public.payroll_records FOR ALL TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- Activity Logs: Admin/HR can view all
CREATE POLICY "Admin/HR view activity logs" ON public.activity_logs FOR SELECT TO authenticated USING (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "System can insert logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- =====================
-- TRIGGERS FOR UPDATED_AT
-- =====================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_salary_structures_updated_at BEFORE UPDATE ON public.salary_structures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- TRIGGER FOR AUTO-CREATING PROFILE
-- =====================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  
  -- Assign default employee role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================
-- INSERT DEFAULT DATA
-- =====================
INSERT INTO public.departments (name, description) VALUES
  ('Engineering', 'Software development and technical teams'),
  ('Human Resources', 'HR and people operations'),
  ('Finance', 'Accounting and financial management'),
  ('Marketing', 'Marketing and communications'),
  ('Sales', 'Sales and business development'),
  ('Operations', 'Operations and administration');

INSERT INTO public.leave_types (name, description, days_per_year, is_paid) VALUES
  ('Annual Leave', 'Paid annual vacation leave', 20, true),
  ('Sick Leave', 'Paid sick leave', 10, true),
  ('Casual Leave', 'Casual leave for personal matters', 5, true),
  ('Unpaid Leave', 'Leave without pay', 0, false),
  ('Maternity Leave', 'Maternity leave for new mothers', 90, true),
  ('Paternity Leave', 'Paternity leave for new fathers', 10, true);