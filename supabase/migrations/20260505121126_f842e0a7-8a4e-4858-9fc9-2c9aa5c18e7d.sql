ALTER TABLE public.lead_magnet_subscribers
  ADD COLUMN IF NOT EXISTS email_1_message_id TEXT,
  ADD COLUMN IF NOT EXISTS email_2_message_id TEXT,
  ADD COLUMN IF NOT EXISTS email_3_message_id TEXT;

CREATE TABLE IF NOT EXISTS public.lead_magnet_email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID REFERENCES public.lead_magnet_subscribers(id) ON DELETE CASCADE,
  message_id TEXT,
  recipient_email TEXT NOT NULL,
  email_type INT,
  event_type TEXT NOT NULL,
  bounce_reason TEXT,
  click_url TEXT,
  user_agent TEXT,
  ip TEXT,
  raw JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lme_subscriber ON public.lead_magnet_email_events(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_lme_message_id ON public.lead_magnet_email_events(message_id);
CREATE INDEX IF NOT EXISTS idx_lme_recipient ON public.lead_magnet_email_events(recipient_email);
CREATE INDEX IF NOT EXISTS idx_lme_event_type ON public.lead_magnet_email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_lme_occurred_at ON public.lead_magnet_email_events(occurred_at DESC);

ALTER TABLE public.lead_magnet_email_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins read lead magnet events" ON public.lead_magnet_email_events;
CREATE POLICY "Super admins read lead magnet events"
ON public.lead_magnet_email_events
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));