-- =====================================================
-- OPTIONAL SEED DATA FOR CoreHR Hub
-- =====================================================
-- This file contains sample data for development/testing.
-- Run with: make seed (or manually via Supabase SQL Editor)
-- 
-- WARNING: This will insert sample data. Only run on fresh/dev databases!
-- Do NOT run this on production databases with real data.
-- =====================================================

-- =====================================================
-- SAMPLE DEPARTMENTS
-- =====================================================
-- Note: The base migration already includes default departments.
-- These are included here as reference if you need to re-seed.

INSERT INTO public.departments (name, description) VALUES
  ('Engineering', 'Software development and technical teams'),
  ('Human Resources', 'HR and people operations'),
  ('Finance', 'Accounting and financial management'),
  ('Marketing', 'Marketing and communications'),
  ('Sales', 'Sales and business development'),
  ('Operations', 'Operations and administration')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- SAMPLE LEAVE TYPES
-- =====================================================
-- Note: The base migration already includes default leave types.
-- These are included here as reference if you need to re-seed.

INSERT INTO public.leave_types (name, description, days_per_year, is_paid) VALUES
  ('Annual Leave', 'Paid annual vacation leave', 20, true),
  ('Sick Leave', 'Paid sick leave', 10, true),
  ('Casual Leave', 'Casual leave for personal matters', 5, true),
  ('Unpaid Leave', 'Leave without pay', 0, false),
  ('Maternity Leave', 'Maternity leave for new mothers', 90, true),
  ('Paternity Leave', 'Paternity leave for new fathers', 10, true)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- SAMPLE COMPANY HOLIDAYS (adjust dates as needed)
-- =====================================================

INSERT INTO public.company_events (title, description, event_date, event_type, is_holiday) VALUES
  ('New Year''s Day', 'New Year celebration', '2026-01-01', 'holiday', true),
  ('Republic Day', 'National holiday', '2026-01-26', 'holiday', true),
  ('Holi', 'Festival of colors', '2026-03-17', 'holiday', true),
  ('Good Friday', 'Christian holiday', '2026-04-03', 'holiday', true),
  ('Independence Day', 'National holiday', '2026-08-15', 'holiday', true),
  ('Diwali', 'Festival of lights', '2026-10-20', 'holiday', true),
  ('Christmas', 'Christmas holiday', '2026-12-25', 'holiday', true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SAMPLE ASSETS (optional - for testing asset management)
-- =====================================================

INSERT INTO public.assets (asset_code, name, category, serial_number, status, notes) VALUES
  ('LAPTOP-001', 'MacBook Pro 14"', 'Laptop', 'C02G12345HASH', 'available', 'Development laptop'),
  ('LAPTOP-002', 'Dell XPS 15', 'Laptop', 'DELL123456789', 'available', 'Standard issue laptop'),
  ('MONITOR-001', 'Dell UltraSharp 27"', 'Monitor', 'DELL-MON-001', 'available', '4K Monitor'),
  ('MONITOR-002', 'LG 32" 4K', 'Monitor', 'LG-MON-002', 'available', '32 inch display'),
  ('KEYBOARD-001', 'Apple Magic Keyboard', 'Peripheral', 'AMK-001', 'available', 'Wireless keyboard'),
  ('MOUSE-001', 'Logitech MX Master 3', 'Peripheral', 'LMX-001', 'available', 'Ergonomic mouse'),
  ('HEADSET-001', 'Sony WH-1000XM5', 'Peripheral', 'SONY-HS-001', 'available', 'Noise cancelling headphones'),
  ('PHONE-001', 'iPhone 15 Pro', 'Mobile', 'APPLE-IP15-001', 'available', 'Company phone')
ON CONFLICT (asset_code) DO NOTHING;

-- =====================================================
-- INSTRUCTIONS FOR CREATING FIRST ADMIN USER
-- =====================================================
-- After setting up the database and running this seed:
--
-- 1. Sign up through the app with your email
-- 2. Find your user ID in Supabase Dashboard > Authentication > Users
-- 3. Run the following SQL (replace YOUR_USER_ID):
--
-- INSERT INTO public.user_roles (user_id, role) 
-- VALUES ('YOUR_USER_ID', 'admin')
-- ON CONFLICT (user_id, role) DO NOTHING;
--
-- INSERT INTO public.user_roles (user_id, role) 
-- VALUES ('YOUR_USER_ID', 'hr')
-- ON CONFLICT (user_id, role) DO NOTHING;
--
-- This will grant you admin and HR privileges.
-- =====================================================
