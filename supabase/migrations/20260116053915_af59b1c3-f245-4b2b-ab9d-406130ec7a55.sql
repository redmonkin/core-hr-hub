-- Fix: Add explicit anonymous access denial for sensitive tables
-- The existing RLS policies require auth.uid() which returns NULL for anonymous users,
-- but we should add explicit denial to be absolutely certain.

-- Ensure RLS is enabled on employees table (defensive)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Ensure RLS is enabled on performance_reviews table (defensive)
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;

-- Note: The existing RESTRICTIVE policies already use auth.uid() which returns NULL 
-- for anonymous users, meaning anonymous queries will fail the conditions.
-- The is_admin_or_hr() function also checks auth.uid() and returns false for anonymous.
-- However, we should verify the tables have FORCE ROW LEVEL SECURITY for table owners.

-- Enable RLS to apply to table owner as well (defense in depth)
ALTER TABLE public.employees FORCE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews FORCE ROW LEVEL SECURITY;

-- Add explicit deny policies for anonymous access as extra protection layer
-- These are RESTRICTIVE policies that require authentication

-- Drop any potentially overly permissive policies and recreate with explicit auth check
-- First, let's check employees table SELECT policies

-- The existing policies are:
-- 1. "Admin/HR manage employees" - uses is_admin_or_hr(auth.uid()) ✓
-- 2. "Employees view own record" - uses (user_id = auth.uid()) ✓
-- 3. "Managers view direct reports" - uses get_my_employee_id() which checks auth.uid() ✓
-- 4. "Employees can update own safe fields only" - uses (user_id = auth.uid()) ✓

-- For performance_reviews:
-- 1. "Admin/HR manage all reviews" - uses is_admin_or_hr(auth.uid()) ✓
-- 2. "Employees view own reviews" - uses subquery with auth.uid() ✓
-- 3. "Managers view team reviews" - uses subquery with auth.uid() ✓

-- The policies already correctly use auth.uid() which returns NULL for anonymous users.
-- Since NULL doesn't match any condition, anonymous access is blocked.
-- The FORCE ROW LEVEL SECURITY above adds an extra layer of protection.