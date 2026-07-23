-- Reimbursement (expense claims) feature: enum types + table + RLS
CREATE TYPE public.expense_category AS ENUM ('travel', 'food', 'accommodation', 'office_supplies', 'other');
CREATE TYPE public.reimbursement_status AS ENUM ('pending', 'approved', 'rejected', 'paid');

CREATE TABLE public.reimbursement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  category expense_category NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  expense_date DATE NOT NULL,
  description TEXT NOT NULL,
  receipt_url TEXT NOT NULL,
  status reimbursement_status DEFAULT 'pending' NOT NULL,
  reviewed_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.reimbursement_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View reimbursement requests" ON public.reimbursement_requests
FOR SELECT TO authenticated
USING (is_admin_or_hr(auth.uid()) OR employee_id = get_my_employee_id() OR is_manager_of(employee_id));

CREATE POLICY "Submit own reimbursement request" ON public.reimbursement_requests
FOR INSERT TO authenticated
WITH CHECK (employee_id = get_my_employee_id());

CREATE POLICY "Review reimbursement requests" ON public.reimbursement_requests
FOR UPDATE TO authenticated
USING (is_admin_or_hr(auth.uid()) OR is_manager_of(employee_id));

CREATE TRIGGER update_reimbursement_requests_updated_at
BEFORE UPDATE ON public.reimbursement_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_reimbursement_requests_employee_id ON public.reimbursement_requests(employee_id);
CREATE INDEX idx_reimbursement_requests_status ON public.reimbursement_requests(status);

-- Per-user opt-out for reimbursement email notifications, same pattern as other notification types
ALTER TABLE public.notification_preferences
  ADD COLUMN reimbursement_notifications BOOLEAN NOT NULL DEFAULT true;
