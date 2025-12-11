-- Create performance reviews table
CREATE TABLE public.performance_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES public.employees(id),
  review_period VARCHAR(50) NOT NULL,
  review_date DATE NOT NULL DEFAULT CURRENT_DATE,
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  strengths TEXT,
  areas_for_improvement TEXT,
  comments TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'acknowledged')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create goals table
CREATE TABLE public.goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'professional',
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status VARCHAR(20) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'cancelled')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- Performance reviews policies
CREATE POLICY "Admin/HR manage all reviews"
ON public.performance_reviews
FOR ALL
USING (is_admin_or_hr(auth.uid()));

CREATE POLICY "Employees view own reviews"
ON public.performance_reviews
FOR SELECT
USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

CREATE POLICY "Managers view team reviews"
ON public.performance_reviews
FOR SELECT
USING (employee_id IN (
  SELECT id FROM employees WHERE manager_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  )
));

-- Goals policies
CREATE POLICY "Admin/HR manage all goals"
ON public.goals
FOR ALL
USING (is_admin_or_hr(auth.uid()));

CREATE POLICY "Employees manage own goals"
ON public.goals
FOR ALL
USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

CREATE POLICY "Managers view team goals"
ON public.goals
FOR SELECT
USING (employee_id IN (
  SELECT id FROM employees WHERE manager_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  )
));

-- Add triggers for updated_at
CREATE TRIGGER update_performance_reviews_updated_at
BEFORE UPDATE ON public.performance_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_goals_updated_at
BEFORE UPDATE ON public.goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();