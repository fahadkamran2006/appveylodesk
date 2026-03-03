
-- Add granular permissions to public_review_links
ALTER TABLE public.public_review_links
ADD COLUMN IF NOT EXISTS allow_comments boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_download boolean NOT NULL DEFAULT false;
