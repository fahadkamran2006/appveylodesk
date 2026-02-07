-- Create payment_methods table for agency payment profiles
CREATE TABLE public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  details TEXT NOT NULL,
  payment_link TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on payment_methods
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Admins can manage payment methods in their agency
CREATE POLICY "Admins can manage payment methods"
  ON public.payment_methods FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) AND agency_id = get_user_agency_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND agency_id = get_user_agency_id(auth.uid()));

-- All agency members can view payment methods (needed for invoice display)
CREATE POLICY "Agency members can view payment methods"
  ON public.payment_methods FOR SELECT
  USING (user_belongs_to_agency(auth.uid(), agency_id));

-- Create invoice_line_items table
CREATE TABLE public.invoice_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  rate NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on invoice_line_items
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Admins can manage line items for their agency invoices
CREATE POLICY "Admins can manage invoice line items"
  ON public.invoice_line_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_line_items.invoice_id
      AND has_role(auth.uid(), 'admin'::app_role)
      AND i.agency_id = get_user_agency_id(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_line_items.invoice_id
      AND has_role(auth.uid(), 'admin'::app_role)
      AND i.agency_id = get_user_agency_id(auth.uid())
    )
  );

-- Clients can view line items for their invoices
CREATE POLICY "Clients can view their invoice line items"
  ON public.invoice_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_line_items.invoice_id
      AND i.client_id = auth.uid()
    )
  );

-- Add new columns to invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_link TEXT,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Create function to generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number(_agency_id UUID)
RETURNS TEXT AS $$
DECLARE
  count INTEGER;
  year_str TEXT;
BEGIN
  year_str := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO count
  FROM invoices
  WHERE agency_id = _agency_id
  AND created_at >= date_trunc('year', now());
  
  RETURN 'INV-' || year_str || '-' || LPAD(count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for updated_at on payment_methods
CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();