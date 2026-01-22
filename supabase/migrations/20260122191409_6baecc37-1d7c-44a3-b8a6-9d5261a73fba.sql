-- Add location columns to attendance_records table
ALTER TABLE public.attendance_records
ADD COLUMN clock_in_latitude DECIMAL(10, 8),
ADD COLUMN clock_in_longitude DECIMAL(11, 8),
ADD COLUMN clock_in_location_name TEXT,
ADD COLUMN clock_out_latitude DECIMAL(10, 8),
ADD COLUMN clock_out_longitude DECIMAL(11, 8),
ADD COLUMN clock_out_location_name TEXT;