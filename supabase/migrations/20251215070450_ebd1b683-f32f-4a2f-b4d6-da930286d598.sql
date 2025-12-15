-- Create company events/holidays table
CREATE TABLE public.company_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  end_date DATE,
  event_type VARCHAR(50) NOT NULL DEFAULT 'event',
  is_holiday BOOLEAN NOT NULL DEFAULT false,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_events ENABLE ROW LEVEL SECURITY;

-- Everyone can view company events
CREATE POLICY "Anyone can view company events"
ON public.company_events
FOR SELECT
USING (true);

-- Admin/HR can manage company events
CREATE POLICY "Admin/HR manage company events"
ON public.company_events
FOR ALL
USING (is_admin_or_hr(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_company_events_updated_at
BEFORE UPDATE ON public.company_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();