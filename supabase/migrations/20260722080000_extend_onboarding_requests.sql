-- Capture full onboarding details up front instead of just name/email/message,
-- so approving a request can auto-fill the entire "Add Employee" form.
ALTER TABLE public.onboarding_requests
  ADD COLUMN phone TEXT NOT NULL,
  ADD COLUMN address TEXT NOT NULL,
  ADD COLUMN date_of_birth DATE NOT NULL,
  ADD COLUMN gender TEXT NOT NULL,
  ADD COLUMN designation TEXT NOT NULL,
  ADD COLUMN joining_date DATE NOT NULL,
  ADD COLUMN resume_url TEXT NOT NULL,
  ADD COLUMN offer_letter_url TEXT NOT NULL,
  ADD COLUMN id_proof_url TEXT NOT NULL;
