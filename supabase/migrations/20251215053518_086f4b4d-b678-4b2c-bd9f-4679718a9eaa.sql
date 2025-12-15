-- Fix the infinite recursion in employees RLS policy
-- Drop the problematic policies
DROP POLICY IF EXISTS "View employees" ON public.employees;
DROP POLICY IF EXISTS "Admin/HR manage employees" ON public.employees;

-- Recreate policies without recursion
-- Policy for admin/HR to manage all employees
CREATE POLICY "Admin/HR manage employees" 
ON public.employees 
FOR ALL 
USING (is_admin_or_hr(auth.uid()));

-- Policy for viewing employees - simplified to avoid recursion
CREATE POLICY "Employees view own record" 
ON public.employees 
FOR SELECT 
USING (user_id = auth.uid());

-- Managers can view their direct reports (simplified query)
CREATE POLICY "Managers view direct reports" 
ON public.employees 
FOR SELECT 
USING (
  manager_id IN (
    SELECT id FROM public.employees WHERE user_id = auth.uid()
  )
);

-- Create notifications table for in-app notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users view own notifications" 
ON public.notifications 
FOR SELECT 
USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users update own notifications" 
ON public.notifications 
FOR UPDATE 
USING (user_id = auth.uid());

-- System can insert notifications (via service role)
CREATE POLICY "System insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- Add last_reminder_sent column to goals table to track reminders
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS last_reminder_sent TIMESTAMP WITH TIME ZONE;