-- Create employment_type enum
CREATE TYPE public.employment_type AS ENUM ('freelance', 'salaried');

-- Add employment columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS employment_type public.employment_type NOT NULL DEFAULT 'freelance',
ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS accumulated_bonus NUMERIC NOT NULL DEFAULT 0;