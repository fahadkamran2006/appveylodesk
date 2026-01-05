-- Add creator/owner reference so the inserting user can immediately read the row (needed for INSERT ... RETURNING)
ALTER TABLE public.agencies
ADD COLUMN IF NOT EXISTS created_by uuid;

-- Backfill existing agencies with their first admin user (if any)
UPDATE public.agencies a
SET created_by = (
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.agency_id = a.id
    AND ur.role = 'admin'
  ORDER BY ur.created_at ASC
  LIMIT 1
)
WHERE a.created_by IS NULL;

-- Default to current authenticated user for new agencies
ALTER TABLE public.agencies
ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Replace agencies INSERT policy to require creator match
DROP POLICY IF EXISTS "Authenticated users can create agencies" ON public.agencies;
CREATE POLICY "Authenticated users can create agencies"
ON public.agencies
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Allow creator to read their newly-created agency immediately, OR via membership
DROP POLICY IF EXISTS "Users can view their agency" ON public.agencies;
CREATE POLICY "Users can view their agency"
ON public.agencies
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR user_belongs_to_agency(auth.uid(), id)
);

-- Keep update restricted to admins in the agency
DROP POLICY IF EXISTS "Admins can update their agency" ON public.agencies;
CREATE POLICY "Admins can update their agency"
ON public.agencies
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND user_belongs_to_agency(auth.uid(), id)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND user_belongs_to_agency(auth.uid(), id)
);

-- Ensure grants exist (RLS still applies)
GRANT SELECT, INSERT, UPDATE ON public.agencies TO authenticated;