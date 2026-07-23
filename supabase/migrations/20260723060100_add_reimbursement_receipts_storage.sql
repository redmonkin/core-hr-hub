-- Storage bucket for reimbursement receipt uploads, keyed by employees.id folder
INSERT INTO storage.buckets (id, name, public) VALUES ('reimbursement-receipts', 'reimbursement-receipts', false);

CREATE POLICY "Users can upload own receipts" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'reimbursement-receipts'
  AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.employees WHERE user_id = auth.uid())
);

CREATE POLICY "Users can view own or managed receipts" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'reimbursement-receipts'
  AND (
    is_admin_or_hr(auth.uid())
    OR (storage.foldername(name))[1] IN (SELECT id::text FROM public.employees WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Admin/HR can manage receipts" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'reimbursement-receipts' AND is_admin_or_hr(auth.uid()));
