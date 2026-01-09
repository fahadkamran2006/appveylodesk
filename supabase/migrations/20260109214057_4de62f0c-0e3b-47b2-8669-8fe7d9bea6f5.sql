-- Fix: Remove public access policy and create secure RPC for invitation verification

-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Anyone can view invitation by id for verification" ON public.agency_invitations;

-- Create a secure RPC function to verify invitation tokens
-- This only returns necessary data and validates the token
CREATE OR REPLACE FUNCTION public.verify_invitation_token(_token uuid)
RETURNS TABLE(
  valid boolean,
  email text,
  role app_role,
  full_name text,
  agency_name text,
  already_accepted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  ag_name TEXT;
BEGIN
  -- Get invitation details
  SELECT * INTO inv
  FROM public.agency_invitations i
  WHERE i.id = _token
  LIMIT 1;

  IF inv IS NULL THEN
    -- Return invalid response for non-existent tokens
    RETURN QUERY SELECT 
      false::boolean as valid,
      NULL::text as email,
      NULL::app_role as role,
      NULL::text as full_name,
      NULL::text as agency_name,
      false::boolean as already_accepted;
    RETURN;
  END IF;

  -- Get agency name
  SELECT name INTO ag_name
  FROM public.agencies
  WHERE id = inv.agency_id
  LIMIT 1;

  -- Return invitation details
  RETURN QUERY SELECT 
    (inv.accepted_at IS NULL)::boolean as valid,
    inv.email::text,
    inv.role,
    inv.full_name::text,
    COALESCE(ag_name, 'the agency')::text as agency_name,
    (inv.accepted_at IS NOT NULL)::boolean as already_accepted;
END;
$$;