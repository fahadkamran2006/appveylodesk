-- Add editor_rate column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS editor_rate numeric DEFAULT NULL;

-- Create payment_proofs storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment_proofs', 'payment_proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payment_proofs bucket
-- Clients can upload their own payment proofs
CREATE POLICY "Clients can upload payment proofs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment_proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Clients can view their own payment proofs
CREATE POLICY "Clients can view their own payment proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment_proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can view all payment proofs in their agency
CREATE POLICY "Admins can view payment proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment_proofs' 
  AND has_role(auth.uid(), 'admin')
);

-- Note: Invoices table already has RLS that excludes editors:
-- - "Admins can manage agency invoices" - for admins only
-- - "Clients can view their invoices" - for clients only
-- - "Clients can update invoice payment proof" - for clients only
-- Editors have NO policies on invoices table, so they cannot read it.