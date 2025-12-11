-- Create storage bucket for employee documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', false);

-- Allow authenticated users to upload their own documents
CREATE POLICY "Users can upload own documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'employee-documents' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM employees WHERE user_id = auth.uid()
  )
);

-- Allow users to view their own documents, admin/HR can view all
CREATE POLICY "Users can view own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (
    is_admin_or_hr(auth.uid())
    OR (storage.foldername(name))[1] IN (
      SELECT id::text FROM employees WHERE user_id = auth.uid()
    )
  )
);

-- Allow users to delete their own documents, admin/HR can delete all
CREATE POLICY "Users can delete own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'employee-documents'
  AND (
    is_admin_or_hr(auth.uid())
    OR (storage.foldername(name))[1] IN (
      SELECT id::text FROM employees WHERE user_id = auth.uid()
    )
  )
);

-- Allow admin/HR to upload documents for any employee
CREATE POLICY "Admin/HR can upload any documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'employee-documents'
  AND is_admin_or_hr(auth.uid())
);