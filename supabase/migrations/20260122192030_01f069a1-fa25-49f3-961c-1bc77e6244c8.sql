-- Add work_mode column to attendance_records table
ALTER TABLE public.attendance_records
ADD COLUMN work_mode TEXT CHECK (work_mode IN ('wfh', 'wfo'));