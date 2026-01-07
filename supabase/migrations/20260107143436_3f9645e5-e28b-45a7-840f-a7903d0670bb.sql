-- Create onboarding_requests table for users who signed up but aren't employees yet
CREATE TABLE public.onboarding_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.onboarding_requests ENABLE ROW LEVEL SECURITY;

-- Users can view and create their own requests
CREATE POLICY "Users can view own requests"
ON public.onboarding_requests
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own request"
ON public.onboarding_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admin/HR can view and update all requests
CREATE POLICY "Admin/HR can view all requests"
ON public.onboarding_requests
FOR SELECT
USING (public.is_admin_or_hr(auth.uid()));

CREATE POLICY "Admin/HR can update requests"
ON public.onboarding_requests
FOR UPDATE
USING (public.is_admin_or_hr(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_onboarding_requests_updated_at
BEFORE UPDATE ON public.onboarding_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();