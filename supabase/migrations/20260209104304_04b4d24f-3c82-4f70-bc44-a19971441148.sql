-- Add legal compliance fields to agencies table for professional invoicing
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS business_name TEXT,
ADD COLUMN IF NOT EXISTS business_address TEXT,
ADD COLUMN IF NOT EXISTS tax_id TEXT,
ADD COLUMN IF NOT EXISTS invoice_footer TEXT;

-- Add a new status 'request' to the project_status enum for video requests
-- First check if it exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'request' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'project_status')) THEN
        ALTER TYPE project_status ADD VALUE 'request';
    END IF;
END $$;