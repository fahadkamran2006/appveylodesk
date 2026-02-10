
-- Payroll payments table to track paid/unpaid status per month
CREATE TABLE public.payroll_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  editor_id UUID NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL,
  base_amount NUMERIC NOT NULL DEFAULT 0,
  bonus_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  paid_at TIMESTAMPTZ,
  paid_by UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_id, editor_id, period_month, period_year)
);

ALTER TABLE public.payroll_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payroll payments"
ON public.payroll_payments FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND user_belongs_to_agency(auth.uid(), agency_id)
);

CREATE POLICY "Editors can view their own payments"
ON public.payroll_payments FOR SELECT
USING (auth.uid() = editor_id);

CREATE TRIGGER update_payroll_payments_updated_at
BEFORE UPDATE ON public.payroll_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Company owes / balance tracking (security funds, advances, etc.)
CREATE TABLE public.editor_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  editor_id UUID NOT NULL,
  label TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'owed' CHECK (type IN ('owed', 'deduction')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.editor_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage editor balances"
ON public.editor_balances FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND user_belongs_to_agency(auth.uid(), agency_id)
);

CREATE POLICY "Editors can view their own balances"
ON public.editor_balances FOR SELECT
USING (auth.uid() = editor_id);

CREATE TRIGGER update_editor_balances_updated_at
BEFORE UPDATE ON public.editor_balances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
