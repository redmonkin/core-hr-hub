-- Create a table for system settings including employee code pattern
CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read settings (needed for employee code generation)
CREATE POLICY "Anyone can read system settings" 
ON public.system_settings 
FOR SELECT 
USING (true);

-- Only admins can modify settings (using is_admin_or_hr for simplicity)
CREATE POLICY "Admins can insert system settings" 
ON public.system_settings 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update system settings" 
ON public.system_settings 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete system settings" 
ON public.system_settings 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updating timestamps
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default employee code pattern
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'employee_code_pattern',
  '{"prefix": "ACQ", "min_digits": 3, "separator": ""}'::jsonb,
  'Pattern for auto-generating employee codes. Prefix is the text before the number, min_digits is the minimum number of digits (padded with zeros), separator is optional text between prefix and number.'
);