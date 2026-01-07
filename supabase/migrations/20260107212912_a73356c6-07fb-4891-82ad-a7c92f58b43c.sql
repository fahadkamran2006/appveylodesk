-- Add 'pending' status to invoice_status enum for payment proof review state
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'pending';