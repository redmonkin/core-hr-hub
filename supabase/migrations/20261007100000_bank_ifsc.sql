-- IFSC code for salary transfers. Stored upper-case; the database rejects
-- anything that isn't a valid IFSC (4 letters, a zero, then 6 letters or digits).
ALTER TABLE public.employee_bank_details
  ADD COLUMN ifsc_code text
  CONSTRAINT employee_bank_details_ifsc_code_format CHECK (ifsc_code ~ '^[A-Z]{4}0[A-Z0-9]{6}$');
