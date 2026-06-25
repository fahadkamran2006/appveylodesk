-- Add 'custom' to channel_type enum
ALTER TYPE public.channel_type ADD VALUE IF NOT EXISTS 'custom';