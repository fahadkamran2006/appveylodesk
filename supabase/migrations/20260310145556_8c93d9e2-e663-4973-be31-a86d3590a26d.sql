
-- Create daily_logs table (unified attendance + task logs)
CREATE TABLE public.daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  editor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  check_in_at timestamptz,
  check_out_at timestamptz,
  work_summary text,
  log_type text NOT NULL DEFAULT 'attendance',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(editor_id, date, log_type)
);

-- Create leave_requests table
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  editor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  leave_type text NOT NULL DEFAULT 'casual',
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- daily_logs RLS: Editors can insert/select their own
CREATE POLICY "Editors can insert their own daily logs"
ON public.daily_logs FOR INSERT TO authenticated
WITH CHECK (editor_id = auth.uid());

CREATE POLICY "Editors can update their own daily logs"
ON public.daily_logs FOR UPDATE TO authenticated
USING (editor_id = auth.uid())
WITH CHECK (editor_id = auth.uid());

CREATE POLICY "Editors can view their own daily logs"
ON public.daily_logs FOR SELECT TO authenticated
USING (editor_id = auth.uid());

-- daily_logs RLS: Admins can view all in their agency
CREATE POLICY "Admins can view agency daily logs"
ON public.daily_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), agency_id));

-- leave_requests RLS: Editors can insert/select their own
CREATE POLICY "Editors can insert their own leave requests"
ON public.leave_requests FOR INSERT TO authenticated
WITH CHECK (editor_id = auth.uid());

CREATE POLICY "Editors can view their own leave requests"
ON public.leave_requests FOR SELECT TO authenticated
USING (editor_id = auth.uid());

-- leave_requests RLS: Admins can view and update in their agency
CREATE POLICY "Admins can view agency leave requests"
ON public.leave_requests FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), agency_id));

CREATE POLICY "Admins can update agency leave requests"
ON public.leave_requests FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), agency_id));
