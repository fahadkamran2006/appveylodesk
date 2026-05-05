
CREATE TABLE public.lead_magnet_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  first_name text NOT NULL,
  source text NOT NULL DEFAULT 'ebook_landing_page',
  downloaded_at timestamptz NOT NULL DEFAULT now(),
  email_2_sent_at timestamptz,
  email_3_sent_at timestamptz,
  unsubscribed_at timestamptz,
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_magnet_email ON public.lead_magnet_subscribers(email);
CREATE INDEX idx_lead_magnet_unsub_token ON public.lead_magnet_subscribers(unsubscribe_token);

ALTER TABLE public.lead_magnet_subscribers ENABLE ROW LEVEL SECURITY;

-- No public access: all access goes through edge functions w/ service role.
-- Allow super-admins (by email) to read via authenticated session.
CREATE POLICY "Super admins can read leads"
ON public.lead_magnet_subscribers
FOR SELECT
TO authenticated
USING (
  (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('hello@fahadkamran.com','m.fahadkamran0001@gmail.com')
);
