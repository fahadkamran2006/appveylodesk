
CREATE TABLE public.email_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL,
  email_1_sent_at timestamptz,
  email_2_sent_at timestamptz,
  email_3_sent_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

GRANT SELECT ON public.email_sequences TO authenticated;
GRANT ALL ON public.email_sequences TO service_role;

ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sequence"
  ON public.email_sequences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_email_sequences_cron ON public.email_sequences(created_at, email_1_sent_at, email_2_sent_at, email_3_sent_at) WHERE unsubscribed_at IS NULL;
