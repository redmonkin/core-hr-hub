-- Add blocked column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN blocked boolean NOT NULL DEFAULT false;

-- Add blocked_at and blocked_by for audit purposes
ALTER TABLE public.profiles 
ADD COLUMN blocked_at timestamp with time zone,
ADD COLUMN blocked_by uuid REFERENCES auth.users(id);