-- Veylodesk full schema: all migrations concatenated in order.
-- Run this on a fresh Supabase project (SQL Editor or psql).

-- >>> 20251228012201_4cd7a89f-0842-4ccc-93da-4d613ed10902.sql

-- Create enum for user roles
DO $do$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'client', 'editor', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;

-- Create enum for project status
DO $do$ BEGIN
  CREATE TYPE public.project_status AS ENUM ('backlog', 'in_progress', 'review', 'quality_check', 'done', 'proposal', 'cancelled', 'paid', 'archived', 'request');
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;

-- Create enum for invoice status
DO $do$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('unpaid', 'paid', 'overdue', 'pending', 'draft');
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;

-- Agencies table
CREATE TABLE IF NOT EXISTS public.agencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table (separate for security)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'client',
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, agency_id)
);

-- Projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status project_status NOT NULL DEFAULT 'backlog',
  client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date TIMESTAMP WITH TIME ZONE,
  budget DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Project editor assignments (many-to-many)
CREATE TABLE IF NOT EXISTS public.project_editors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  editor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, editor_id)
);

-- Invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  status invoice_status NOT NULL DEFAULT 'unpaid',
  pdf_url TEXT,
  payment_proof_url TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Messages/Comments table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Project deliverables/files
CREATE TABLE IF NOT EXISTS public.deliverables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_editors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's agency_id
CREATE OR REPLACE FUNCTION public.get_user_agency_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Function to check if user belongs to agency
CREATE OR REPLACE FUNCTION public.user_belongs_to_agency(_user_id UUID, _agency_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND agency_id = _agency_id
  )
$$;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view agency profiles" ON public.profiles;
CREATE POLICY "Admins can view agency profiles" ON public.profiles FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') AND
  agency_id = public.get_user_agency_id(auth.uid())
);

-- Agencies policies
DROP POLICY IF EXISTS "Users can view their agency" ON public.agencies;
CREATE POLICY "Users can view their agency" ON public.agencies FOR SELECT
USING (
  public.user_belongs_to_agency(auth.uid(), id)
);

DROP POLICY IF EXISTS "Admins can update their agency" ON public.agencies;
CREATE POLICY "Admins can update their agency" ON public.agencies FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin') AND
  public.user_belongs_to_agency(auth.uid(), id)
);

DROP POLICY IF EXISTS "Authenticated users can create agencies" ON public.agencies;
CREATE POLICY "Authenticated users can create agencies" ON public.agencies FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- User roles policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage roles in their agency" ON public.user_roles;
CREATE POLICY "Admins can manage roles in their agency" ON public.user_roles FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') AND
  agency_id = public.get_user_agency_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert their own role during signup" ON public.user_roles;
CREATE POLICY "Users can insert their own role during signup" ON public.user_roles FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Projects policies
DROP POLICY IF EXISTS "Admins can manage all agency projects" ON public.projects;
CREATE POLICY "Admins can manage all agency projects" ON public.projects FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') AND
  public.user_belongs_to_agency(auth.uid(), agency_id)
);

DROP POLICY IF EXISTS "Clients can view their projects" ON public.projects;
CREATE POLICY "Clients can view their projects" ON public.projects FOR SELECT
USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Editors can view assigned projects" ON public.projects;
CREATE POLICY "Editors can view assigned projects" ON public.projects FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.project_editors
    WHERE project_id = id AND editor_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Editors can update assigned projects" ON public.projects;
CREATE POLICY "Editors can update assigned projects" ON public.projects FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.project_editors
    WHERE project_id = id AND editor_id = auth.uid()
  )
);

-- Project editors policies
DROP POLICY IF EXISTS "Admins can manage editor assignments" ON public.project_editors;
CREATE POLICY "Admins can manage editor assignments" ON public.project_editors FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') AND
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
      AND public.user_belongs_to_agency(auth.uid(), p.agency_id)
  )
);

DROP POLICY IF EXISTS "Editors can view their assignments" ON public.project_editors;
CREATE POLICY "Editors can view their assignments" ON public.project_editors FOR SELECT
USING (editor_id = auth.uid());

-- Invoices policies
DROP POLICY IF EXISTS "Admins can manage agency invoices" ON public.invoices;
CREATE POLICY "Admins can manage agency invoices" ON public.invoices FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') AND
  public.user_belongs_to_agency(auth.uid(), agency_id)
);

DROP POLICY IF EXISTS "Clients can view their invoices" ON public.invoices;
CREATE POLICY "Clients can view their invoices" ON public.invoices FOR SELECT
USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Clients can update invoice payment proof" ON public.invoices;
CREATE POLICY "Clients can update invoice payment proof" ON public.invoices FOR UPDATE
USING (client_id = auth.uid());

-- Messages policies
DROP POLICY IF EXISTS "Users can view messages on their projects" ON public.messages;
CREATE POLICY "Users can view messages on their projects" ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
      AND (
        p.client_id = auth.uid() AND is_internal = false
        OR public.has_role(auth.uid(), 'admin') AND public.user_belongs_to_agency(auth.uid(), p.agency_id)
        OR EXISTS (SELECT 1 FROM public.project_editors pe WHERE pe.project_id = p.id AND pe.editor_id = auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Users can send messages on their projects" ON public.messages;
CREATE POLICY "Users can send messages on their projects" ON public.messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
      AND (
        p.client_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin') AND public.user_belongs_to_agency(auth.uid(), p.agency_id)
        OR EXISTS (SELECT 1 FROM public.project_editors pe WHERE pe.project_id = p.id AND pe.editor_id = auth.uid())
      )
  )
);

-- Deliverables policies
DROP POLICY IF EXISTS "Users can view deliverables on their projects" ON public.deliverables;
CREATE POLICY "Users can view deliverables on their projects" ON public.deliverables FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
      AND (
        p.client_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin') AND public.user_belongs_to_agency(auth.uid(), p.agency_id)
        OR EXISTS (SELECT 1 FROM public.project_editors pe WHERE pe.project_id = p.id AND pe.editor_id = auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Editors and admins can upload deliverables" ON public.deliverables;
CREATE POLICY "Editors and admins can upload deliverables" ON public.deliverables FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
      AND (
        public.has_role(auth.uid(), 'admin') AND public.user_belongs_to_agency(auth.uid(), p.agency_id)
        OR EXISTS (SELECT 1 FROM public.project_editors pe WHERE pe.project_id = p.id AND pe.editor_id = auth.uid())
      )
  )
);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_agencies_updated_at ON public.agencies;
CREATE TRIGGER update_agencies_updated_at
  BEFORE UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- >>> MISSING HELPER FUNCTIONS (restored from live database)

CREATE OR REPLACE FUNCTION public.is_project_editor(_user_id uuid, _project_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.project_editors pe WHERE pe.editor_id = _user_id AND pe.project_id = _project_id)
$function$;

CREATE OR REPLACE FUNCTION public.project_belongs_to_agency(_project_id uuid, _agency_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.agency_id = _agency_id)
$function$;


-- >>> 20260105191040_19034d6a-e454-4dbe-b7cc-720c982029be.sql

-- Drop the existing restrictive INSERT policy on agencies
DROP POLICY IF EXISTS "Authenticated users can create agencies" ON public.agencies;

-- Create a PERMISSIVE INSERT policy for authenticated users
DROP POLICY IF EXISTS "Authenticated users can create agencies" ON public.agencies;
CREATE POLICY "Authenticated users can create agencies" ON public.agencies
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also fix the SELECT policy - drop restrictive and make permissive
DROP POLICY IF EXISTS "Users can view their agency" ON public.agencies;

DROP POLICY IF EXISTS "Users can view their agency" ON public.agencies;
CREATE POLICY "Users can view their agency" ON public.agencies
FOR SELECT
TO authenticated
USING (user_belongs_to_agency(auth.uid(), id));

-- Fix the UPDATE policy as well
DROP POLICY IF EXISTS "Admins can update their agency" ON public.agencies;

DROP POLICY IF EXISTS "Admins can update their agency" ON public.agencies;
CREATE POLICY "Admins can update their agency" ON public.agencies
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), id))
WITH CHECK (has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), id));

-- >>> 20260105191050_f61b7400-6229-4485-9c7e-b7d15057e03b.sql

-- Fix the update_updated_at_column function to have explicit search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- >>> 20260105193027_53542598-f908-43df-949b-4bd6e8605e4d.sql

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
DROP POLICY IF EXISTS "Authenticated users can create agencies" ON public.agencies;
CREATE POLICY "Authenticated users can create agencies" ON public.agencies
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Allow creator to read their newly-created agency immediately, OR via membership
DROP POLICY IF EXISTS "Users can view their agency" ON public.agencies;
DROP POLICY IF EXISTS "Users can view their agency" ON public.agencies;
CREATE POLICY "Users can view their agency" ON public.agencies
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR user_belongs_to_agency(auth.uid(), id)
);

-- Keep update restricted to admins in the agency
DROP POLICY IF EXISTS "Admins can update their agency" ON public.agencies;
DROP POLICY IF EXISTS "Admins can update their agency" ON public.agencies;
CREATE POLICY "Admins can update their agency" ON public.agencies
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

-- >>> 20260105203952_4b5c58b6-6c1c-489b-a937-2305b9568d35.sql

-- Drop existing problematic policies on projects table
DROP POLICY IF EXISTS "Admins can manage all agency projects" ON public.projects;
DROP POLICY IF EXISTS "Clients can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Editors can update assigned projects" ON public.projects;
DROP POLICY IF EXISTS "Editors can view assigned projects" ON public.projects;

-- Create fixed policies for projects table
-- 1. Admins can manage all agency projects
DROP POLICY IF EXISTS "Admins can manage all agency projects" ON public.projects;
CREATE POLICY "Admins can manage all agency projects" ON public.projects 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND user_belongs_to_agency(auth.uid(), agency_id)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND user_belongs_to_agency(auth.uid(), agency_id)
);

-- 2. Clients can view their own projects
DROP POLICY IF EXISTS "Clients can view their projects" ON public.projects;
CREATE POLICY "Clients can view their projects" ON public.projects 
FOR SELECT 
USING (client_id = auth.uid());

-- 3. Editors can view assigned projects (FIXED: was self-referencing)
DROP POLICY IF EXISTS "Editors can view assigned projects" ON public.projects;
CREATE POLICY "Editors can view assigned projects" ON public.projects 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.project_editors pe
    WHERE pe.project_id = projects.id 
    AND pe.editor_id = auth.uid()
  )
);

-- 4. Editors can update assigned projects (FIXED: was self-referencing)
DROP POLICY IF EXISTS "Editors can update assigned projects" ON public.projects;
CREATE POLICY "Editors can update assigned projects" ON public.projects 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.project_editors pe
    WHERE pe.project_id = projects.id 
    AND pe.editor_id = auth.uid()
  )
);

-- Fix profiles policies to allow viewing agency members
DROP POLICY IF EXISTS "Admins can view agency profiles" ON public.profiles;

-- Allow users to view profiles in their agency
DROP POLICY IF EXISTS "Users can view agency profiles" ON public.profiles;
CREATE POLICY "Users can view agency profiles" ON public.profiles 
FOR SELECT 
USING (
  agency_id = get_user_agency_id(auth.uid())
  OR id = auth.uid()
);

-- >>> 20260105210648_571848b1-5393-417b-9fa4-a68cd8713794.sql

-- Allow admins to insert profiles for invited users in their agency
DROP POLICY IF EXISTS "Admins can insert profiles in their agency" ON public.profiles;
CREATE POLICY "Admins can insert profiles in their agency" ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  AND agency_id = public.get_user_agency_id(auth.uid())
);

-- >>> 20260105211533_9d2492e8-6dfc-47e2-9aba-16f8b2a34619.sql

-- Invitations table for inviting clients/editors without creating placeholder auth users
CREATE TABLE IF NOT EXISTS public.agency_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NULL,
  role public.app_role NOT NULL,
  invited_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE NULL,
  accepted_by UUID NULL
);

ALTER TABLE public.agency_invitations ENABLE ROW LEVEL SECURITY;

-- Admins can manage invitations within their agency
DROP POLICY IF EXISTS "Admins can view invitations in their agency" ON public.agency_invitations;
DROP POLICY IF EXISTS "Admins can view invitations in their agency" ON public.agency_invitations;
CREATE POLICY "Admins can view invitations in their agency" ON public.agency_invitations
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND agency_id = public.get_user_agency_id(auth.uid())
);

DROP POLICY IF EXISTS "Admins can create invitations in their agency" ON public.agency_invitations;
DROP POLICY IF EXISTS "Admins can create invitations in their agency" ON public.agency_invitations;
CREATE POLICY "Admins can create invitations in their agency" ON public.agency_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND agency_id = public.get_user_agency_id(auth.uid())
  AND invited_by = auth.uid()
);

DROP POLICY IF EXISTS "Admins can update invitations in their agency" ON public.agency_invitations;
DROP POLICY IF EXISTS "Admins can update invitations in their agency" ON public.agency_invitations;
CREATE POLICY "Admins can update invitations in their agency" ON public.agency_invitations
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND agency_id = public.get_user_agency_id(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND agency_id = public.get_user_agency_id(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete invitations in their agency" ON public.agency_invitations;
DROP POLICY IF EXISTS "Admins can delete invitations in their agency" ON public.agency_invitations;
CREATE POLICY "Admins can delete invitations in their agency" ON public.agency_invitations
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND agency_id = public.get_user_agency_id(auth.uid())
);

-- Accept invitation: assigns agency + role to the currently authenticated user.
-- Uses SECURITY DEFINER to avoid fragile client-side role writes.
CREATE OR REPLACE FUNCTION public.accept_agency_invitation(_token uuid)
RETURNS TABLE (agency_id uuid, role public.app_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  jwt_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  jwt_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF jwt_email = '' THEN
    RAISE EXCEPTION 'Email missing from session';
  END IF;

  SELECT * INTO inv
  FROM public.agency_invitations i
  WHERE i.id = _token
  LIMIT 1;

  IF inv IS NULL THEN
    RAISE EXCEPTION 'Invalid invitation';
  END IF;

  IF inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation already used';
  END IF;

  IF lower(inv.email) <> jwt_email THEN
    RAISE EXCEPTION 'This invitation is for a different email address';
  END IF;

  -- Ensure profile exists and is linked to this agency
  INSERT INTO public.profiles (id, email, full_name, agency_id, onboarding_completed)
  VALUES (auth.uid(), jwt_email, inv.full_name, inv.agency_id, false)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        agency_id = EXCLUDED.agency_id,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  -- Assign role for this agency
  INSERT INTO public.user_roles (user_id, agency_id, role)
  VALUES (auth.uid(), inv.agency_id, inv.role)
  ON CONFLICT (user_id, agency_id) DO UPDATE
    SET role = EXCLUDED.role;

  -- Mark invitation accepted
  UPDATE public.agency_invitations
  SET accepted_at = now(),
      accepted_by = auth.uid()
  WHERE id = inv.id;

  agency_id := inv.agency_id;
  role := inv.role;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_agency_invitation(uuid) TO authenticated;

-- Tighten role self-assignment policy (prevents joining arbitrary agencies)
DROP POLICY IF EXISTS "Users can insert their own role during signup" ON public.user_roles;
DROP POLICY IF EXISTS "Users can assign themselves as agency admin" ON public.user_roles;
CREATE POLICY "Users can assign themselves as agency admin" ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'admin'
  AND EXISTS (
    SELECT 1
    FROM public.agencies a
    WHERE a.id = agency_id
      AND a.created_by = auth.uid()
  )
);

-- >>> 20260107212605_09abbd0d-112b-433a-8261-9a1e000301f1.sql

-- Add editor_rate column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS editor_rate numeric DEFAULT NULL;

-- Create payment_proofs storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment_proofs', 'payment_proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payment_proofs bucket
-- Clients can upload their own payment proofs
DROP POLICY IF EXISTS "Clients can upload payment proofs" ON storage.objects;
CREATE POLICY "Clients can upload payment proofs" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment_proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Clients can view their own payment proofs
DROP POLICY IF EXISTS "Clients can view their own payment proofs" ON storage.objects;
CREATE POLICY "Clients can view their own payment proofs" ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment_proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can view all payment proofs in their agency
DROP POLICY IF EXISTS "Admins can view payment proofs" ON storage.objects;
CREATE POLICY "Admins can view payment proofs" ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment_proofs' 
  AND has_role(auth.uid(), 'admin')
);

-- Note: Invoices table already has RLS that excludes editors:
-- - "Admins can manage agency invoices" - for admins only
-- - "Clients can view their invoices" - for clients only
-- - "Clients can update invoice payment proof" - for clients only
-- Editors have NO policies on invoices table, so they cannot read it.

-- >>> 20260107212912_a73356c6-07fb-4891-82ad-a7c92f58b43c.sql

-- Add 'pending' status to invoice_status enum for payment proof review state
-- [migration-export] enum value folded into CREATE TYPE above: ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'pending';

-- >>> 20260108093032_0a9d63aa-88a6-4ba6-bf2d-8ccd0a5703e6.sql

-- Allow anyone to read an invitation by its ID (for join pages)
DROP POLICY IF EXISTS "Anyone can view invitation by id for verification" ON public.agency_invitations;
CREATE POLICY "Anyone can view invitation by id for verification" ON public.agency_invitations
FOR SELECT
USING (true);

-- >>> 20260108094019_fc2cdbb0-13bb-488e-a1d9-fc0116c48294.sql

-- Drop and recreate to fix ambiguous column reference
DROP FUNCTION IF EXISTS public.accept_agency_invitation(uuid);

CREATE FUNCTION public.accept_agency_invitation(_token uuid)
 RETURNS TABLE(out_agency_id uuid, out_role app_role)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv RECORD;
  jwt_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  jwt_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF jwt_email = '' THEN
    RAISE EXCEPTION 'Email missing from session';
  END IF;

  SELECT * INTO inv
  FROM public.agency_invitations i
  WHERE i.id = _token
  LIMIT 1;

  IF inv IS NULL THEN
    RAISE EXCEPTION 'Invalid invitation';
  END IF;

  IF inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation already used';
  END IF;

  IF lower(inv.email) <> jwt_email THEN
    RAISE EXCEPTION 'This invitation is for a different email address';
  END IF;

  -- Ensure profile exists and is linked to this agency
  INSERT INTO public.profiles (id, email, full_name, agency_id, onboarding_completed)
  VALUES (auth.uid(), jwt_email, inv.full_name, inv.agency_id, false)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        agency_id = EXCLUDED.agency_id,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  -- Assign role for this agency
  INSERT INTO public.user_roles (user_id, agency_id, role)
  VALUES (auth.uid(), inv.agency_id, inv.role)
  ON CONFLICT (user_id, agency_id) DO UPDATE
    SET role = EXCLUDED.role;

  -- Mark invitation accepted
  UPDATE public.agency_invitations
  SET accepted_at = now(),
      accepted_by = auth.uid()
  WHERE id = inv.id;

  out_agency_id := inv.agency_id;
  out_role := inv.role;
  RETURN NEXT;
END;
$function$;

-- >>> 20260108100403_5847a3e1-a22c-4d67-bac9-c13346c7d90b.sql

-- =====================================================
-- MESSAGING SYSTEM SCHEMA
-- =====================================================

-- Create channel types enum
DO $do$ BEGIN
  CREATE TYPE public.channel_type AS ENUM ('dm', 'project', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;

-- Create channels table
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  type channel_type NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT channels_project_check CHECK (
    (type = 'project' AND project_id IS NOT NULL) OR 
    (type = 'dm' AND project_id IS NULL)
  )
);

-- Create channel participants table
CREATE TABLE IF NOT EXISTS public.channel_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Create channel mutes table (for client muting feature)
CREATE TABLE IF NOT EXISTS public.channel_mutes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  muted_by UUID NOT NULL,
  muted_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(channel_id, muted_by, muted_user_id)
);

-- Modify messages table to use channels instead of projects
ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  ALTER COLUMN project_id DROP NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_channels_agency ON public.channels(agency_id);
CREATE INDEX IF NOT EXISTS idx_channels_project ON public.channels(project_id);
CREATE INDEX IF NOT EXISTS idx_channels_type ON public.channels(type);
CREATE INDEX IF NOT EXISTS idx_channel_participants_channel ON public.channel_participants(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_participants_user ON public.channel_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON public.messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_mutes_channel ON public.channel_mutes(channel_id);

-- Enable RLS on all tables
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_mutes ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES FOR CHANNELS
-- =====================================================

-- Users can view channels they participate in
DROP POLICY IF EXISTS "Users can view their channels" ON public.channels;
CREATE POLICY "Users can view their channels" ON public.channels FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.channel_participants cp
    WHERE cp.channel_id = channels.id AND cp.user_id = auth.uid()
  )
);

-- Admins can create channels in their agency
DROP POLICY IF EXISTS "Admins can create channels" ON public.channels;
CREATE POLICY "Admins can create channels" ON public.channels FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') AND 
  agency_id = get_user_agency_id(auth.uid())
);

-- Admins can update channels in their agency
DROP POLICY IF EXISTS "Admins can update channels" ON public.channels;
CREATE POLICY "Admins can update channels" ON public.channels FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') AND 
  agency_id = get_user_agency_id(auth.uid())
);

-- =====================================================
-- RLS POLICIES FOR CHANNEL PARTICIPANTS
-- =====================================================

-- Users can view participants in channels they belong to
DROP POLICY IF EXISTS "Users can view channel participants" ON public.channel_participants;
CREATE POLICY "Users can view channel participants" ON public.channel_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.channel_participants my_participation
    WHERE my_participation.channel_id = channel_participants.channel_id 
    AND my_participation.user_id = auth.uid()
  )
);

-- Admins can manage participants
DROP POLICY IF EXISTS "Admins can manage participants" ON public.channel_participants;
CREATE POLICY "Admins can manage participants" ON public.channel_participants FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = channel_participants.channel_id 
    AND has_role(auth.uid(), 'admin')
    AND c.agency_id = get_user_agency_id(auth.uid())
  )
);

-- =====================================================
-- RLS POLICIES FOR CHANNEL MUTES
-- =====================================================

-- Clients can mute users in project channels they participate in
DROP POLICY IF EXISTS "Clients can manage mutes in their project channels" ON public.channel_mutes;
CREATE POLICY "Clients can manage mutes in their project channels" ON public.channel_mutes FOR ALL
USING (
  muted_by = auth.uid() AND
  has_role(auth.uid(), 'client') AND
  EXISTS (
    SELECT 1 FROM public.channels c
    JOIN public.channel_participants cp ON cp.channel_id = c.id
    WHERE c.id = channel_mutes.channel_id 
    AND c.type = 'project'
    AND cp.user_id = auth.uid()
  )
);

-- Admins can manage all mutes in their agency
DROP POLICY IF EXISTS "Admins can manage all mutes" ON public.channel_mutes;
CREATE POLICY "Admins can manage all mutes" ON public.channel_mutes FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = channel_mutes.channel_id 
    AND has_role(auth.uid(), 'admin')
    AND c.agency_id = get_user_agency_id(auth.uid())
  )
);

-- Users can view mutes in channels they participate in
DROP POLICY IF EXISTS "Users can view mutes in their channels" ON public.channel_mutes;
CREATE POLICY "Users can view mutes in their channels" ON public.channel_mutes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.channel_participants cp
    WHERE cp.channel_id = channel_mutes.channel_id 
    AND cp.user_id = auth.uid()
  )
);

-- =====================================================
-- UPDATE MESSAGES RLS FOR CHANNELS
-- =====================================================

-- Drop old message policies
DROP POLICY IF EXISTS "Users can send messages on their projects" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages on their projects" ON public.messages;

-- Users can send messages to channels they participate in (if not archived)
DROP POLICY IF EXISTS "Users can send messages to their channels" ON public.messages;
CREATE POLICY "Users can send messages to their channels" ON public.messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  channel_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.channels c
    JOIN public.channel_participants cp ON cp.channel_id = c.id
    WHERE c.id = messages.channel_id 
    AND cp.user_id = auth.uid()
    AND c.is_archived = false
  )
);

-- Users can view messages in channels they participate in
DROP POLICY IF EXISTS "Users can view messages in their channels" ON public.messages;
CREATE POLICY "Users can view messages in their channels" ON public.messages FOR SELECT
USING (
  channel_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.channel_participants cp
    WHERE cp.channel_id = messages.channel_id 
    AND cp.user_id = auth.uid()
  )
);

-- =====================================================
-- FUNCTION: Get or create DM channel between two users
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_or_create_dm_channel(
  _other_user_id UUID,
  _agency_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _channel_id UUID;
  _my_role app_role;
  _other_role app_role;
BEGIN
  -- Get roles
  SELECT role INTO _my_role FROM public.user_roles 
  WHERE user_id = auth.uid() AND agency_id = _agency_id;
  
  SELECT role INTO _other_role FROM public.user_roles 
  WHERE user_id = _other_user_id AND agency_id = _agency_id;

  -- Validate DM rules: Admin can DM anyone, others can only DM admin
  IF _my_role != 'admin' AND _other_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can DM non-admin users';
  END IF;

  -- Check if DM channel already exists
  SELECT c.id INTO _channel_id
  FROM public.channels c
  WHERE c.type = 'dm'
    AND c.agency_id = _agency_id
    AND EXISTS (SELECT 1 FROM public.channel_participants WHERE channel_id = c.id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.channel_participants WHERE channel_id = c.id AND user_id = _other_user_id)
    AND (SELECT COUNT(*) FROM public.channel_participants WHERE channel_id = c.id) = 2
  LIMIT 1;

  IF _channel_id IS NOT NULL THEN
    RETURN _channel_id;
  END IF;

  -- Create new DM channel
  INSERT INTO public.channels (agency_id, type, name)
  VALUES (_agency_id, 'dm', NULL)
  RETURNING id INTO _channel_id;

  -- Add both participants
  INSERT INTO public.channel_participants (channel_id, user_id)
  VALUES (_channel_id, auth.uid()), (_channel_id, _other_user_id);

  RETURN _channel_id;
END;
$function$;

-- =====================================================
-- FUNCTION: Create project channel (called on project creation)
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_project_channel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _channel_id UUID;
  _admin_id UUID;
BEGIN
  -- Create channel for this project
  INSERT INTO public.channels (agency_id, type, project_id, name)
  VALUES (NEW.agency_id, 'project', NEW.id, NEW.title)
  RETURNING id INTO _channel_id;

  -- Add admin (agency creator or first admin)
  SELECT ur.user_id INTO _admin_id
  FROM public.user_roles ur
  WHERE ur.agency_id = NEW.agency_id AND ur.role = 'admin'
  LIMIT 1;

  IF _admin_id IS NOT NULL THEN
    INSERT INTO public.channel_participants (channel_id, user_id)
    VALUES (_channel_id, _admin_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Add client if assigned
  IF NEW.client_id IS NOT NULL THEN
    INSERT INTO public.channel_participants (channel_id, user_id)
    VALUES (_channel_id, NEW.client_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- CREATE TRIGGER for auto-creating project channels
CREATE TRIGGER on_project_created_create_channel
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.create_project_channel();

-- =====================================================
-- FUNCTION: Add editor to project channel
-- =====================================================

CREATE OR REPLACE FUNCTION public.add_editor_to_project_channel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _channel_id UUID;
BEGIN
  -- Find the project channel
  SELECT id INTO _channel_id
  FROM public.channels
  WHERE project_id = NEW.project_id AND type = 'project'
  LIMIT 1;

  IF _channel_id IS NOT NULL THEN
    INSERT INTO public.channel_participants (channel_id, user_id)
    VALUES (_channel_id, NEW.editor_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- CREATE TRIGGER for adding editors to channels
CREATE TRIGGER on_editor_assigned_add_to_channel
  AFTER INSERT ON public.project_editors
  FOR EACH ROW
  EXECUTE FUNCTION public.add_editor_to_project_channel();

-- =====================================================
-- FUNCTION: Archive channel when project is done
-- =====================================================

CREATE OR REPLACE FUNCTION public.archive_project_channel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    UPDATE public.channels
    SET is_archived = true, updated_at = now()
    WHERE project_id = NEW.id AND type = 'project';
  ELSIF NEW.status != 'done' AND OLD.status = 'done' THEN
    -- Reopen if status changes back
    UPDATE public.channels
    SET is_archived = false, updated_at = now()
    WHERE project_id = NEW.id AND type = 'project';
  END IF;
  RETURN NEW;
END;
$function$;

-- CREATE TRIGGER for archiving channels
CREATE TRIGGER on_project_status_change_archive_channel
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.archive_project_channel();

-- =====================================================
-- STORAGE: Create avatars bucket
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar" ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =====================================================
-- REALTIME: Enable for messages and channels
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;

-- Update timestamps trigger for channels
DROP TRIGGER IF EXISTS update_channels_updated_at ON public.channels;
CREATE TRIGGER update_channels_updated_at
  BEFORE UPDATE ON public.channels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- >>> 20260109183143_af44dcf3-e9a7-4ee6-86c6-086cc062306f.sql

-- Add subscription plan and storage tracking to agencies
ALTER TABLE public.agencies
ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'starter' CHECK (subscription_plan IN ('starter', 'pro')),
ADD COLUMN IF NOT EXISTS storage_limit_bytes BIGINT NOT NULL DEFAULT 214748364800, -- 200GB in bytes
ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT NOT NULL DEFAULT 0;

-- CREATE TABLE IF NOT EXISTS for timestamped video comments
CREATE TABLE IF NOT EXISTS public.deliverable_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deliverable_id UUID NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  timestamp_seconds NUMERIC NOT NULL, -- The exact timestamp in seconds
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on deliverable_comments
ALTER TABLE public.deliverable_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for deliverable_comments
-- Users can view comments on deliverables they have access to
DROP POLICY IF EXISTS "Users can view comments on accessible deliverables" ON public.deliverable_comments;
CREATE POLICY "Users can view comments on accessible deliverables" ON public.deliverable_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.deliverables d
    JOIN public.projects p ON p.id = d.project_id
    WHERE d.id = deliverable_comments.deliverable_id
    AND (
      p.client_id = auth.uid()
      OR (has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), p.agency_id))
      OR EXISTS (SELECT 1 FROM public.project_editors pe WHERE pe.project_id = p.id AND pe.editor_id = auth.uid())
    )
  )
);

-- Users can create comments on deliverables they have access to
DROP POLICY IF EXISTS "Users can create comments on accessible deliverables" ON public.deliverable_comments;
CREATE POLICY "Users can create comments on accessible deliverables" ON public.deliverable_comments FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.deliverables d
    JOIN public.projects p ON p.id = d.project_id
    WHERE d.id = deliverable_comments.deliverable_id
    AND (
      p.client_id = auth.uid()
      OR (has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), p.agency_id))
      OR EXISTS (SELECT 1 FROM public.project_editors pe WHERE pe.project_id = p.id AND pe.editor_id = auth.uid())
    )
  )
);

-- Editors and admins can update comments (mark as resolved)
DROP POLICY IF EXISTS "Editors and admins can update comments" ON public.deliverable_comments;
CREATE POLICY "Editors and admins can update comments" ON public.deliverable_comments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.deliverables d
    JOIN public.projects p ON p.id = d.project_id
    WHERE d.id = deliverable_comments.deliverable_id
    AND (
      (has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), p.agency_id))
      OR EXISTS (SELECT 1 FROM public.project_editors pe WHERE pe.project_id = p.id AND pe.editor_id = auth.uid())
    )
  )
);

-- Create storage bucket for deliverables
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'deliverables',
  'deliverables',
  false,
  5368709120, -- 5GB max file size
  ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska', 
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'application/zip', 'application/x-zip-compressed',
        'audio/mpeg', 'audio/wav', 'audio/aac']
);

-- Storage policies for deliverables bucket
-- Admins can manage all files in their agency's projects
DROP POLICY IF EXISTS "Admins can manage deliverable files" ON storage.objects;
CREATE POLICY "Admins can manage deliverable files" ON storage.objects FOR ALL
USING (
  bucket_id = 'deliverables'
  AND has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.deliverables d
    JOIN public.projects p ON p.id = d.project_id
    WHERE d.file_url LIKE '%' || name
    AND user_belongs_to_agency(auth.uid(), p.agency_id)
  )
)
WITH CHECK (
  bucket_id = 'deliverables'
  AND has_role(auth.uid(), 'admin')
);

-- Editors can upload/delete files in their assigned projects
DROP POLICY IF EXISTS "Editors can manage files in assigned projects" ON storage.objects;
CREATE POLICY "Editors can manage files in assigned projects" ON storage.objects FOR ALL
USING (
  bucket_id = 'deliverables'
  AND EXISTS (
    SELECT 1 FROM public.project_editors pe
    JOIN public.projects p ON p.id = pe.project_id
    WHERE pe.editor_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
)
WITH CHECK (
  bucket_id = 'deliverables'
  AND EXISTS (
    SELECT 1 FROM public.project_editors pe
    JOIN public.projects p ON p.id = pe.project_id
    WHERE pe.editor_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);

-- Clients can view files and upload assets in their projects
DROP POLICY IF EXISTS "Clients can view and upload in their projects" ON storage.objects;
CREATE POLICY "Clients can view and upload in their projects" ON storage.objects FOR SELECT
USING (
  bucket_id = 'deliverables'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.client_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);

DROP POLICY IF EXISTS "Clients can upload assets in their projects" ON storage.objects;
CREATE POLICY "Clients can upload assets in their projects" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'deliverables'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.client_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);

-- Function to update agency storage when deliverables change
CREATE OR REPLACE FUNCTION public.update_agency_storage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _agency_id UUID;
  _file_size BIGINT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get agency_id from the project
    SELECT p.agency_id INTO _agency_id
    FROM public.projects p
    WHERE p.id = NEW.project_id;
    
    -- Add file size to agency storage
    UPDATE public.agencies
    SET storage_used_bytes = storage_used_bytes + COALESCE(NEW.file_size, 0)
    WHERE id = _agency_id;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Get agency_id from the project
    SELECT p.agency_id INTO _agency_id
    FROM public.projects p
    WHERE p.id = OLD.project_id;
    
    -- Subtract file size from agency storage
    UPDATE public.agencies
    SET storage_used_bytes = GREATEST(0, storage_used_bytes - COALESCE(OLD.file_size, 0))
    WHERE id = _agency_id;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Trigger to update storage on deliverable changes
DROP TRIGGER IF EXISTS update_storage_on_deliverable_change ON public.deliverables;
CREATE TRIGGER update_storage_on_deliverable_change
AFTER INSERT OR DELETE ON public.deliverables
FOR EACH ROW
EXECUTE FUNCTION public.update_agency_storage();

-- Function to check storage limit before upload
CREATE OR REPLACE FUNCTION public.check_storage_limit(_agency_id UUID, _file_size BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (storage_used_bytes + _file_size) <= storage_limit_bytes
  FROM public.agencies
  WHERE id = _agency_id;
$$;

-- Add trigger to update updated_at on deliverable_comments
DROP TRIGGER IF EXISTS update_deliverable_comments_updated_at ON public.deliverable_comments;
CREATE TRIGGER update_deliverable_comments_updated_at
BEFORE UPDATE ON public.deliverable_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- >>> 20260109211906_b3d8d059-4718-48dd-aed0-65a38a526758.sql


-- Add proposal status to project_status enum
-- [migration-export] enum value folded into CREATE TYPE above: ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'proposal';

-- Add cancellation_requested status
-- [migration-export] enum value folded into CREATE TYPE above: ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Create cancellation_requests table for client cancellation requests
CREATE TABLE IF NOT EXISTS public.cancellation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on cancellation_requests
ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for cancellation_requests
DROP POLICY IF EXISTS "Admins can manage all cancellation requests" ON public.cancellation_requests;
CREATE POLICY "Admins can manage all cancellation requests" ON public.cancellation_requests
FOR ALL
USING (has_role(auth.uid(), 'admin') AND EXISTS (
  SELECT 1 FROM projects p WHERE p.id = cancellation_requests.project_id AND p.agency_id = get_user_agency_id(auth.uid())
));

DROP POLICY IF EXISTS "Clients can view and create their own cancellation requests" ON public.cancellation_requests;
CREATE POLICY "Clients can view and create their own cancellation requests" ON public.cancellation_requests
FOR SELECT
USING (requested_by = auth.uid());

DROP POLICY IF EXISTS "Clients can create cancellation requests for their projects" ON public.cancellation_requests;
CREATE POLICY "Clients can create cancellation requests for their projects" ON public.cancellation_requests
FOR INSERT
WITH CHECK (
  requested_by = auth.uid() AND
  EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.client_id = auth.uid())
);

-- Add budget column to projects if not exists (for pricing)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS budget NUMERIC DEFAULT NULL;

-- Add editor_rate column to projects for admin cost tracking
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS editor_rate NUMERIC DEFAULT NULL;

-- Allow admins to delete projects
DROP POLICY IF EXISTS "Admins can delete agency projects" ON public.projects;
CREATE POLICY "Admins can delete agency projects" ON public.projects
FOR DELETE
USING (has_role(auth.uid(), 'admin') AND agency_id = get_user_agency_id(auth.uid()));

-- Allow editors to view their assigned projects (not just select from project_editors)
DROP POLICY IF EXISTS "Editors can view assigned projects" ON public.projects;
CREATE POLICY "Editors can view assigned projects" ON public.projects
FOR SELECT
USING (is_project_editor(auth.uid(), id));

-- Update trigger for cancellation_requests
DROP TRIGGER IF EXISTS update_cancellation_requests_updated_at ON public.cancellation_requests;
CREATE TRIGGER update_cancellation_requests_updated_at
BEFORE UPDATE ON public.cancellation_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- >>> 20260109214057_4de62f0c-0e3b-47b2-8669-8fe7d9bea6f5.sql

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

-- >>> 20260110181439_0b61ce95-dce9-48f1-a6e3-1ff7f2d79130.sql

-- Drop existing functions that may have different signatures
DROP FUNCTION IF EXISTS public.create_project_channel(uuid, uuid, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.create_project_channel(uuid, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.create_project_channel(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.create_project_channel(uuid, uuid);
DROP FUNCTION IF EXISTS public.create_project_channel(uuid);

-- Function to create project chat with all participants
CREATE OR REPLACE FUNCTION public.create_project_channel(
  _project_id uuid,
  _agency_id uuid,
  _admin_id uuid,
  _client_id uuid DEFAULT NULL,
  _editor_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _channel_id uuid;
BEGIN
  -- Check if project channel already exists
  SELECT id INTO _channel_id
  FROM public.channels
  WHERE project_id = _project_id AND type = 'project'
  LIMIT 1;
  
  -- Return existing channel if found
  IF _channel_id IS NOT NULL THEN
    RETURN _channel_id;
  END IF;
  
  -- Create new project channel
  INSERT INTO public.channels (type, agency_id, project_id, name)
  VALUES ('project', _agency_id, _project_id, NULL)
  RETURNING id INTO _channel_id;
  
  -- Add admin as participant
  INSERT INTO public.channel_participants (channel_id, user_id)
  VALUES (_channel_id, _admin_id);
  
  -- Add client if provided
  IF _client_id IS NOT NULL THEN
    INSERT INTO public.channel_participants (channel_id, user_id)
    VALUES (_channel_id, _client_id)
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Add editor if provided
  IF _editor_id IS NOT NULL THEN
    INSERT INTO public.channel_participants (channel_id, user_id)
    VALUES (_channel_id, _editor_id)
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN _channel_id;
END;
$$;

-- Function to add participant to project channel (for when editors are assigned later)
CREATE OR REPLACE FUNCTION public.add_project_channel_participant(
  _project_id uuid,
  _user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _channel_id uuid;
BEGIN
  -- Get project channel
  SELECT id INTO _channel_id
  FROM public.channels
  WHERE project_id = _project_id AND type = 'project'
  LIMIT 1;
  
  -- If channel exists, add participant
  IF _channel_id IS NOT NULL THEN
    INSERT INTO public.channel_participants (channel_id, user_id)
    VALUES (_channel_id, _user_id)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- Trigger function to auto-archive project channel when project status is done/delivered
CREATE OR REPLACE FUNCTION public.auto_archive_project_channel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When project status changes to done or delivered, archive the channel
  IF NEW.status IN ('done', 'delivered') AND OLD.status NOT IN ('done', 'delivered') THEN
    UPDATE public.channels
    SET is_archived = true, updated_at = now()
    WHERE project_id = NEW.id AND type = 'project';
  END IF;
  
  -- When project status changes FROM done/delivered to something else, unarchive
  IF NEW.status NOT IN ('done', 'delivered') AND OLD.status IN ('done', 'delivered') THEN
    UPDATE public.channels
    SET is_archived = false, updated_at = now()
    WHERE project_id = NEW.id AND type = 'project';
  END IF;
  
  RETURN NEW;
END;
$$;

-- CREATE TRIGGER for auto-archiving
DROP TRIGGER IF EXISTS trigger_auto_archive_project_channel ON public.projects;
DROP TRIGGER IF EXISTS trigger_auto_archive_project_channel ON public.projects;
CREATE TRIGGER trigger_auto_archive_project_channel
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_archive_project_channel();

-- Trigger function to add editor to project channel when assigned
CREATE OR REPLACE FUNCTION public.auto_add_editor_to_channel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add editor to project channel
  PERFORM public.add_project_channel_participant(NEW.project_id, NEW.editor_id);
  RETURN NEW;
END;
$$;

-- CREATE TRIGGER for auto-adding editors to project channels
DROP TRIGGER IF EXISTS trigger_add_editor_to_channel ON public.project_editors;
DROP TRIGGER IF EXISTS trigger_add_editor_to_channel ON public.project_editors;
CREATE TRIGGER trigger_add_editor_to_channel
  AFTER INSERT ON public.project_editors
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_editor_to_channel();

-- Add unique constraint on channel_participants to prevent duplicates (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'channel_participants_unique_user_channel'
  ) THEN
    ALTER TABLE public.channel_participants 
      ADD CONSTRAINT channel_participants_unique_user_channel 
      UNIQUE (channel_id, user_id);
  END IF;
END $$;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.create_project_channel(uuid, uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_project_channel_participant(uuid, uuid) TO authenticated;

-- >>> 20260110184032_1987baa7-9b30-4875-8b1c-cd4521d2da7f.sql

-- Create a SECURITY DEFINER helper function to check channel membership without RLS recursion
CREATE OR REPLACE FUNCTION public.is_channel_member(_channel_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.channel_participants
    WHERE channel_id = _channel_id
      AND user_id = _user_id
  )
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) TO authenticated;

-- Drop the recursive SELECT policy
DROP POLICY IF EXISTS "Users can view channel participants" ON public.channel_participants;
DROP POLICY IF EXISTS "Users can view participants in channels they belong to" ON public.channel_participants;

-- Create new non-recursive SELECT policy using the helper function
DROP POLICY IF EXISTS "Users can view channel participants" ON public.channel_participants;
CREATE POLICY "Users can view channel participants" ON public.channel_participants
FOR SELECT
USING (public.is_channel_member(channel_id, auth.uid()));

-- >>> 20260110184555_d0399aed-2ca0-4d72-9d87-11ac272e9254.sql

-- Avoid recursion: channel_participants admin policy should not query channels with RLS

-- Helper function: check if a channel belongs to a given agency (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.channel_belongs_to_agency(_channel_id uuid, _agency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.channels c
    WHERE c.id = _channel_id
      AND c.agency_id = _agency_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.channel_belongs_to_agency(uuid, uuid) TO authenticated;

-- Replace recursive admin policy
DROP POLICY IF EXISTS "Admins can manage participants" ON public.channel_participants;

DROP POLICY IF EXISTS "Admins can manage participants" ON public.channel_participants;
CREATE POLICY "Admins can manage participants" ON public.channel_participants
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.channel_belongs_to_agency(channel_id, public.get_user_agency_id(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.channel_belongs_to_agency(channel_id, public.get_user_agency_id(auth.uid()))
);

-- Ensure the SELECT policy is scoped to authenticated as well
-- (recreate it idempotently)
DROP POLICY IF EXISTS "Users can view channel participants" ON public.channel_participants;

DROP POLICY IF EXISTS "Users can view channel participants" ON public.channel_participants;
CREATE POLICY "Users can view channel participants" ON public.channel_participants
FOR SELECT
TO authenticated
USING (public.is_channel_member(channel_id, auth.uid()));

-- >>> 20260111112208_b268bcd5-37f0-44ab-9cc7-0f098b24cb3e.sql

-- Create channel_read_receipts table to track when users last viewed each channel
CREATE TABLE IF NOT EXISTS public.channel_read_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Enable RLS
ALTER TABLE public.channel_read_receipts ENABLE ROW LEVEL SECURITY;

-- Users can view their own read receipts
DROP POLICY IF EXISTS "Users can view their own read receipts" ON public.channel_read_receipts;
CREATE POLICY "Users can view their own read receipts" ON public.channel_read_receipts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can upsert their own read receipts
DROP POLICY IF EXISTS "Users can upsert their own read receipts" ON public.channel_read_receipts;
CREATE POLICY "Users can upsert their own read receipts" ON public.channel_read_receipts
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_channel_member(channel_id, auth.uid()));

DROP POLICY IF EXISTS "Users can update their own read receipts" ON public.channel_read_receipts;
CREATE POLICY "Users can update their own read receipts" ON public.channel_read_receipts
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Function to get unread count for a channel
CREATE OR REPLACE FUNCTION public.get_channel_unread_count(_channel_id uuid, _user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.messages m
  WHERE m.channel_id = _channel_id
    AND m.sender_id != _user_id
    AND m.created_at > COALESCE(
      (SELECT last_seen_at FROM public.channel_read_receipts 
       WHERE channel_id = _channel_id AND user_id = _user_id),
      '1970-01-01'::timestamp with time zone
    )
$$;

GRANT EXECUTE ON FUNCTION public.get_channel_unread_count(uuid, uuid) TO authenticated;

-- Enable realtime for channel_read_receipts
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_read_receipts;

-- >>> 20260112091729_ade60dfe-22ee-48ce-97a8-22385b97e882.sql

-- Fix the auto_archive_project_channel trigger function to remove invalid 'delivered' enum value
-- The project_status enum only has: 'backlog', 'in_progress', 'review', 'done', 'proposal', 'cancelled'
-- 'delivered' is NOT a valid value and causes errors when the trigger fires

CREATE OR REPLACE FUNCTION public.auto_archive_project_channel()
RETURNS TRIGGER AS $$
BEGIN
  -- When project status changes to done, archive the channel
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    UPDATE public.channels
    SET is_archived = true, updated_at = now()
    WHERE project_id = NEW.id AND type = 'project';
  END IF;
  
  -- When project status changes FROM done to something else, unarchive
  IF NEW.status != 'done' AND OLD.status = 'done' THEN
    UPDATE public.channels
    SET is_archived = false, updated_at = now()
    WHERE project_id = NEW.id AND type = 'project';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- >>> 20260116153141_76e8fb69-94ed-4ebe-9265-1345b7f2e466.sql

-- Add completed_at column to track when projects are completed
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- Create a trigger to automatically set completed_at when status changes to 'done'
CREATE OR REPLACE FUNCTION public.set_project_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes to 'done', set completed_at if not already set
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    NEW.completed_at = now();
  -- When status changes from 'done' to something else, clear completed_at
  ELSIF NEW.status != 'done' AND OLD.status = 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS set_project_completed_at_trigger ON public.projects;
CREATE TRIGGER set_project_completed_at_trigger
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.set_project_completed_at();

-- Backfill completed_at for existing done projects using updated_at as approximation
UPDATE public.projects 
SET completed_at = updated_at 
WHERE status = 'done' AND completed_at IS NULL;

-- >>> 20260116232413_5a0b94de-09aa-4ec9-a5b2-03a2655d6f9f.sql

-- Allow clients to create project proposals (with status 'proposal')
DROP POLICY IF EXISTS "Clients can create project proposals" ON public.projects;
CREATE POLICY "Clients can create project proposals" ON public.projects
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'client'::app_role) 
  AND client_id = auth.uid()
  AND status = 'proposal'::project_status
);

-- >>> 20260116232705_f69a97d1-1a3e-4f13-a935-6b6f3062222a.sql

-- Create function to auto-send DM when client submits a proposal
CREATE OR REPLACE FUNCTION public.auto_dm_on_proposal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin_id UUID;
  _channel_id UUID;
  _client_name TEXT;
  _message_content TEXT;
BEGIN
  -- Only run for new proposals from clients
  IF NEW.status != 'proposal' OR NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the admin for this agency
  SELECT ur.user_id INTO _admin_id
  FROM public.user_roles ur
  WHERE ur.agency_id = NEW.agency_id 
    AND ur.role = 'admin'
  LIMIT 1;

  IF _admin_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get client name
  SELECT COALESCE(full_name, email) INTO _client_name
  FROM public.profiles
  WHERE id = NEW.client_id;

  -- Get or create DM channel between client and admin
  -- First check if channel exists
  SELECT c.id INTO _channel_id
  FROM public.channels c
  WHERE c.type = 'dm'
    AND c.agency_id = NEW.agency_id
    AND EXISTS (SELECT 1 FROM public.channel_participants WHERE channel_id = c.id AND user_id = NEW.client_id)
    AND EXISTS (SELECT 1 FROM public.channel_participants WHERE channel_id = c.id AND user_id = _admin_id)
    AND (SELECT COUNT(*) FROM public.channel_participants WHERE channel_id = c.id) = 2
  LIMIT 1;

  -- Create channel if not exists
  IF _channel_id IS NULL THEN
    INSERT INTO public.channels (agency_id, type, name)
    VALUES (NEW.agency_id, 'dm', NULL)
    RETURNING id INTO _channel_id;

    INSERT INTO public.channel_participants (channel_id, user_id)
    VALUES (_channel_id, NEW.client_id), (_channel_id, _admin_id);
  END IF;

  -- Create the auto-message
  _message_content := '📋 **New Project Proposal**

I''ve submitted a new project proposal: **' || NEW.title || '**

' || COALESCE('Description: ' || NEW.description, '') || '

Please review and let me know the pricing and timeline. Thank you!';

  -- Insert the message from the client
  INSERT INTO public.messages (channel_id, sender_id, content)
  VALUES (_channel_id, NEW.client_id, _message_content);

  RETURN NEW;
END;
$$;

-- CREATE TRIGGER for auto-DM ON proposal creation
DROP TRIGGER IF EXISTS trigger_auto_dm_on_proposal ON public.projects;
DROP TRIGGER IF EXISTS trigger_auto_dm_on_proposal ON public.projects;
CREATE TRIGGER trigger_auto_dm_on_proposal
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_dm_on_proposal();

-- >>> 20260120180016_6ad7be3e-c6aa-4f3c-94c6-58f6a4929528.sql

-- Add attachment_url and attachment_type columns to messages table for file attachments
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_type TEXT;

-- Create a function to calculate admin performance metrics
CREATE OR REPLACE FUNCTION public.get_admin_performance_metrics(_agency_id UUID)
RETURNS TABLE(
  total_client_messages BIGINT,
  responded_messages BIGINT,
  reply_rate_percent NUMERIC,
  avg_response_time_seconds NUMERIC,
  avg_response_time_display TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _total_client BIGINT;
  _responded BIGINT;
  _avg_seconds NUMERIC;
BEGIN
  -- Get total client messages in channels belonging to this agency
  SELECT COUNT(*) INTO _total_client
  FROM public.messages m
  JOIN public.channels c ON c.id = m.channel_id
  JOIN public.user_roles ur ON ur.user_id = m.sender_id AND ur.role = 'client'
  WHERE c.agency_id = _agency_id;

  -- Count client messages that have at least one admin/editor reply after them
  WITH client_messages AS (
    SELECT 
      m.id,
      m.channel_id,
      m.created_at,
      m.sender_id
    FROM public.messages m
    JOIN public.channels c ON c.id = m.channel_id
    JOIN public.user_roles ur ON ur.user_id = m.sender_id AND ur.role = 'client'
    WHERE c.agency_id = _agency_id
  ),
  responses AS (
    SELECT DISTINCT cm.id AS client_msg_id
    FROM client_messages cm
    JOIN public.messages resp ON resp.channel_id = cm.channel_id
      AND resp.created_at > cm.created_at
      AND resp.sender_id != cm.sender_id
    JOIN public.user_roles ur ON ur.user_id = resp.sender_id 
      AND ur.role IN ('admin', 'editor')
      AND ur.agency_id = _agency_id
  )
  SELECT COUNT(*) INTO _responded FROM responses;

  -- Calculate average response time
  WITH client_messages AS (
    SELECT 
      m.id,
      m.channel_id,
      m.created_at AS client_time,
      m.sender_id
    FROM public.messages m
    JOIN public.channels c ON c.id = m.channel_id
    JOIN public.user_roles ur ON ur.user_id = m.sender_id AND ur.role = 'client'
    WHERE c.agency_id = _agency_id
  ),
  response_times AS (
    SELECT 
      cm.id,
      MIN(resp.created_at) AS first_response_time,
      cm.client_time
    FROM client_messages cm
    JOIN public.messages resp ON resp.channel_id = cm.channel_id
      AND resp.created_at > cm.client_time
      AND resp.sender_id != cm.sender_id
    JOIN public.user_roles ur ON ur.user_id = resp.sender_id 
      AND ur.role IN ('admin', 'editor')
      AND ur.agency_id = _agency_id
    GROUP BY cm.id, cm.client_time
  )
  SELECT AVG(EXTRACT(EPOCH FROM (first_response_time - client_time))) INTO _avg_seconds
  FROM response_times;

  RETURN QUERY SELECT 
    _total_client,
    _responded,
    CASE WHEN _total_client > 0 
      THEN ROUND((_responded::NUMERIC / _total_client::NUMERIC) * 100, 1)
      ELSE 0 
    END,
    COALESCE(_avg_seconds, 0),
    CASE 
      WHEN _avg_seconds IS NULL THEN 'N/A'
      WHEN _avg_seconds < 60 THEN ROUND(_avg_seconds) || 's'
      WHEN _avg_seconds < 3600 THEN ROUND(_avg_seconds / 60) || 'm'
      WHEN _avg_seconds < 86400 THEN ROUND(_avg_seconds / 3600, 1) || 'h'
      ELSE ROUND(_avg_seconds / 86400, 1) || 'd'
    END;
END;
$$;

-- Create a function to get monthly earnings data for charts
CREATE OR REPLACE FUNCTION public.get_monthly_earnings(_agency_id UUID, _months INTEGER DEFAULT 12)
RETURNS TABLE(
  month TEXT,
  year INTEGER,
  month_num INTEGER,
  earnings NUMERIC,
  projects_completed BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH months AS (
    SELECT 
      TO_CHAR(d, 'Mon') AS month,
      EXTRACT(YEAR FROM d)::INTEGER AS year,
      EXTRACT(MONTH FROM d)::INTEGER AS month_num,
      d AS month_start,
      (d + INTERVAL '1 month' - INTERVAL '1 day')::DATE AS month_end
    FROM generate_series(
      DATE_TRUNC('month', NOW() - (_months - 1 || ' months')::INTERVAL),
      DATE_TRUNC('month', NOW()),
      '1 month'::INTERVAL
    ) d
  )
  SELECT 
    m.month,
    m.year,
    m.month_num,
    COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) AS earnings,
    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'done' AND p.completed_at >= m.month_start AND p.completed_at < m.month_end + INTERVAL '1 day') AS projects_completed
  FROM months m
  LEFT JOIN public.invoices i ON i.agency_id = _agency_id 
    AND i.paid_at >= m.month_start 
    AND i.paid_at < m.month_end + INTERVAL '1 day'
  LEFT JOIN public.projects p ON p.agency_id = _agency_id
  GROUP BY m.month, m.year, m.month_num, m.month_start, m.month_end
  ORDER BY m.year, m.month_num;
$$;

-- Create a function to get client acquisition data
CREATE OR REPLACE FUNCTION public.get_client_acquisition(_agency_id UUID, _months INTEGER DEFAULT 12)
RETURNS TABLE(
  month TEXT,
  year INTEGER,
  month_num INTEGER,
  new_clients BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH months AS (
    SELECT 
      TO_CHAR(d, 'Mon') AS month,
      EXTRACT(YEAR FROM d)::INTEGER AS year,
      EXTRACT(MONTH FROM d)::INTEGER AS month_num,
      d AS month_start,
      (d + INTERVAL '1 month' - INTERVAL '1 day')::DATE AS month_end
    FROM generate_series(
      DATE_TRUNC('month', NOW() - (_months - 1 || ' months')::INTERVAL),
      DATE_TRUNC('month', NOW()),
      '1 month'::INTERVAL
    ) d
  )
  SELECT 
    m.month,
    m.year,
    m.month_num,
    COUNT(DISTINCT ur.user_id) AS new_clients
  FROM months m
  LEFT JOIN public.user_roles ur ON ur.agency_id = _agency_id 
    AND ur.role = 'client'
    AND ur.created_at >= m.month_start 
    AND ur.created_at < m.month_end + INTERVAL '1 day'
  GROUP BY m.month, m.year, m.month_num
  ORDER BY m.year, m.month_num;
$$;

-- >>> 20260120223709_daf25aea-4ccf-4a8c-8625-cb6db9c38e5c.sql

-- Fix warn-level finding: prevent unauthenticated (anon) reads of agency data
-- by scoping SELECT policies to authenticated role and explicitly denying anon.

BEGIN;

-- Replace existing SELECT policy with an authenticated-only version
DROP POLICY IF EXISTS "Users can view their agency" ON public.agencies;
DROP POLICY IF EXISTS "Users can view their agency" ON public.agencies;
CREATE POLICY "Users can view their agency" ON public.agencies
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    created_by = auth.uid()
    OR user_belongs_to_agency(auth.uid(), id)
  )
);

-- Explicitly deny anonymous reads (defense-in-depth)
DROP POLICY IF EXISTS "Deny anonymous agency access" ON public.agencies;
DROP POLICY IF EXISTS "Deny anonymous agency access" ON public.agencies;
CREATE POLICY "Deny anonymous agency access" ON public.agencies
AS PERMISSIVE
FOR SELECT
TO anon
USING (false);

COMMIT;

-- >>> 20260121061346_c9443ad0-e426-40bf-8030-b43c8c8d9d66.sql

-- Fix error-level finding: restrict profiles table access to authenticated users only
-- This prevents unauthenticated access to sensitive user data (email, full_name, avatar_url)

BEGIN;

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view agency profiles" ON public.profiles;

-- Recreate with explicit authenticated role requirement
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND auth.uid() = id);

DROP POLICY IF EXISTS "Users can view agency profiles" ON public.profiles;
CREATE POLICY "Users can view agency profiles" ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (agency_id = get_user_agency_id(auth.uid()) OR id = auth.uid())
);

-- Add explicit deny policy for anonymous users (defense-in-depth)
DROP POLICY IF EXISTS "Deny anonymous profile access" ON public.profiles;
DROP POLICY IF EXISTS "Deny anonymous profile access" ON public.profiles;
CREATE POLICY "Deny anonymous profile access" ON public.profiles
AS PERMISSIVE
FOR SELECT
TO anon
USING (false);

COMMIT;

-- >>> 20260121182846_e3309ca6-273d-4dd5-811b-8e32cbf5f56b.sql

-- Fix profiles RLS to properly allow viewing agency members' profiles
-- The issue: profiles.agency_id can be NULL, and we need to match via user_roles table instead

-- Drop the problematic SELECT policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view agency profiles" ON public.profiles;

-- Create a single comprehensive SELECT policy that uses user_roles for agency membership
-- This properly handles the case where agency_id on profiles might be NULL
DROP POLICY IF EXISTS "Authenticated users can view agency member profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view agency member profiles" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Always allow viewing own profile
    id = auth.uid()
    OR
    -- Allow viewing profiles of users in the same agency via user_roles table
    EXISTS (
      SELECT 1 
      FROM public.user_roles ur1
      JOIN public.user_roles ur2 ON ur1.agency_id = ur2.agency_id
      WHERE ur1.user_id = auth.uid()
        AND ur2.user_id = profiles.id
    )
  );

-- >>> 20260121184341_69159df7-0ebd-4eb4-88bb-b8ccf6fe14ef.sql

-- Add reference_links column to projects table for storing external links (Google Drive, reference URLs, etc.)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS reference_links TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.projects.reference_links IS 'JSON array or newline-separated list of external reference links (Google Drive, reference URLs, etc.)';

-- >>> 20260121192916_af4a81bf-debb-4223-a93d-761b1b638b81.sql

-- Add file_type column to deliverables table
ALTER TABLE public.deliverables 
ADD COLUMN IF NOT EXISTS file_type text NOT NULL DEFAULT 'deliverable';

-- Add check constraint for valid file types
ALTER TABLE public.deliverables 
ADD CONSTRAINT deliverables_file_type_check 
CHECK (file_type IN ('asset', 'deliverable'));

-- Create RLS policy allowing clients to upload assets to their projects
DROP POLICY IF EXISTS "Clients can upload assets to their projects" ON public.deliverables;
CREATE POLICY "Clients can upload assets to their projects" ON public.deliverables
FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = deliverables.project_id 
    AND p.client_id = auth.uid()
  )
);

-- CREATE INDEX IF NOT EXISTS for faster file_type filtering
CREATE INDEX IF NOT EXISTS idx_deliverables_file_type ON public.deliverables(file_type);

-- >>> 20260123163744_64da1660-02f2-4370-a1e8-c052618d48fd.sql

-- Create function to recalculate agency storage from actual deliverables
CREATE OR REPLACE FUNCTION public.recalculate_agency_storage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.agencies a
  SET storage_used_bytes = COALESCE(
    (SELECT SUM(COALESCE(d.file_size, 0))
     FROM public.deliverables d
     JOIN public.projects p ON p.id = d.project_id
     WHERE p.agency_id = a.id),
    0
  );
END;
$$;

-- Run it immediately to fix the current mismatch
SELECT public.recalculate_agency_storage();

-- >>> 20260123174534_0e910ac1-eaf2-43d2-b410-c3110652b5ae.sql

-- Drop and recreate the recalculate_agency_storage function with proper WHERE clause
CREATE OR REPLACE FUNCTION public.recalculate_agency_storage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agency_record RECORD;
  calculated_bytes BIGINT;
BEGIN
  -- Loop through each agency and update its storage
  FOR agency_record IN SELECT id FROM agencies LOOP
    -- Calculate total storage used by this agency's projects
    SELECT COALESCE(SUM(d.file_size), 0) INTO calculated_bytes
    FROM deliverables d
    JOIN projects p ON p.id = d.project_id
    WHERE p.agency_id = agency_record.id;
    
    -- Update the agency with the calculated value
    UPDATE agencies
    SET storage_used_bytes = calculated_bytes,
        updated_at = now()
    WHERE id = agency_record.id;
  END LOOP;
END;
$$;

-- >>> 20260123214105_93338337-a722-4076-9d42-b0a40e5727a0.sql

-- CREATE TABLE IF NOT EXISTS to track individual message read status (for read receipts / seen ticks)
CREATE TABLE IF NOT EXISTS public.message_read_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;

-- Users can view read receipts for messages in their channels
DROP POLICY IF EXISTS "Users can view read receipts in their channels" ON public.message_read_receipts;
CREATE POLICY "Users can view read receipts in their channels" ON public.message_read_receipts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN channel_participants cp ON cp.channel_id = m.channel_id
    WHERE m.id = message_read_receipts.message_id
    AND cp.user_id = auth.uid()
  )
);

-- Users can mark messages as read in their channels
DROP POLICY IF EXISTS "Users can mark messages as read" ON public.message_read_receipts;
CREATE POLICY "Users can mark messages as read" ON public.message_read_receipts
FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM messages m
    JOIN channel_participants cp ON cp.channel_id = m.channel_id
    WHERE m.id = message_read_receipts.message_id
    AND cp.user_id = auth.uid()
  )
);

-- CREATE TABLE IF NOT EXISTS for cleared chats (hide history for user)
CREATE TABLE IF NOT EXISTS public.cleared_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  cleared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Enable RLS
ALTER TABLE public.cleared_chats ENABLE ROW LEVEL SECURITY;

-- Users can view their own cleared chats
DROP POLICY IF EXISTS "Users can view their cleared chats" ON public.cleared_chats;
CREATE POLICY "Users can view their cleared chats" ON public.cleared_chats
FOR SELECT
USING (user_id = auth.uid());

-- Users can clear their own chats
DROP POLICY IF EXISTS "Users can clear their chats" ON public.cleared_chats;
CREATE POLICY "Users can clear their chats" ON public.cleared_chats
FOR INSERT
WITH CHECK (user_id = auth.uid() AND is_channel_member(channel_id, auth.uid()));

-- Users can update their cleared chats (to re-clear)
DROP POLICY IF EXISTS "Users can update their cleared chats" ON public.cleared_chats;
CREATE POLICY "Users can update their cleared chats" ON public.cleared_chats
FOR UPDATE
USING (user_id = auth.uid());

-- Enable realtime for message_read_receipts
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_read_receipts;

-- >>> 20260124185659_835a45fe-bccb-4a9d-a99c-f35826175a8e.sql

-- Allow authenticated users to view user_roles of members in the same agency
-- This is required for the profiles RLS policy JOIN to work for Clients/Editors
DROP POLICY IF EXISTS "Users can view roles of agency members" ON public.user_roles;
CREATE POLICY "Users can view roles of agency members" ON public.user_roles
FOR SELECT
TO authenticated
USING (
  agency_id IN (
    SELECT ur.agency_id 
    FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
);

-- >>> 20260124191530_8cf03027-41c6-48b8-93b3-055dbfb4b295.sql

-- Fix infinite recursion in user_roles RLS by removing self-referencing policy
-- and switching profiles access to a SECURITY DEFINER helper.

-- 1) Remove the recursive policy (it queries public.user_roles inside a policy on public.user_roles)
DROP POLICY IF EXISTS "Users can view roles of agency members" ON public.user_roles;

-- 2) Create helper to safely check if two users share an agency (bypasses RLS)
CREATE OR REPLACE FUNCTION public.users_share_agency(_user_a uuid, _user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles a
    JOIN public.user_roles b ON b.agency_id = a.agency_id
    WHERE a.user_id = _user_a
      AND b.user_id = _user_b
  );
$$;

-- 3) Replace profiles SELECT policy to use the helper (no JOINs that depend on user_roles SELECT visibility)
DROP POLICY IF EXISTS "Authenticated users can view agency member profiles" ON public.profiles;

DROP POLICY IF EXISTS "Authenticated users can view agency member profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view agency member profiles" ON public.profiles
FOR SELECT
TO authenticated
USING (
  (id = auth.uid())
  OR public.users_share_agency(auth.uid(), id)
);

-- >>> 20260129075302_ad094129-eda8-4cce-825c-6d2ed839e40e.sql

-- Add subscription-related columns to agencies table
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'starter' CHECK (plan_tier IN ('starter', 'growth', 'scale')),
ADD COLUMN IF NOT EXISTS max_clients INTEGER NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'yearly')),
ADD COLUMN IF NOT EXISTS lemon_squeezy_customer_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

-- Create function to check if agency can add more clients
CREATE OR REPLACE FUNCTION public.check_client_limit(_agency_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT COUNT(DISTINCT user_id) 
    FROM public.user_roles 
    WHERE agency_id = _agency_id AND role = 'client'
  ) < (
    SELECT max_clients FROM public.agencies WHERE id = _agency_id
  );
$$;

-- Update existing agencies to have correct tier defaults based on current subscription_plan
UPDATE public.agencies
SET 
  plan_tier = CASE 
    WHEN subscription_plan = 'scale' THEN 'scale'
    WHEN subscription_plan = 'growth' THEN 'growth'
    ELSE 'starter'
  END,
  max_clients = CASE 
    WHEN subscription_plan = 'scale' THEN 999999
    WHEN subscription_plan = 'growth' THEN 25
    ELSE 5
  END,
  storage_limit_bytes = CASE 
    WHEN subscription_plan = 'scale' THEN 3298534883328  -- 3 TB
    WHEN subscription_plan = 'growth' THEN 1099511627776 -- 1 TB
    ELSE 214748364800  -- 200 GB
  END
WHERE plan_tier IS NULL OR plan_tier = 'starter';

-- >>> 20260131104527_085eda7c-90dd-4492-903f-20cef7fd4e2a.sql

-- Fix outdated subscription_plan constraint to allow current tiers
ALTER TABLE public.agencies
DROP CONSTRAINT IF EXISTS agencies_subscription_plan_check;

ALTER TABLE public.agencies
ADD CONSTRAINT agencies_subscription_plan_check
CHECK (
  subscription_plan = ANY (ARRAY['starter'::text, 'growth'::text, 'scale'::text, 'pro'::text])
);

-- >>> 20260201063044_1e6df294-8323-4ecf-b5e4-31f1e98a9927.sql

-- Create enum for notification types
DO $do$ BEGIN
  CREATE TYPE public.notification_type AS ENUM (
  'task_assignment',
  'new_message',
  'invoice_sent',
  'invoice_paid',
  'proposal_created',
  'proposal_approved',
  'project_status_change',
  'editor_assigned',
  'deliverable_uploaded',
  'comment_added'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, agency_id, notification_type)
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_agency_id ON public.notifications(agency_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_agency ON public.notification_preferences(user_id, agency_id);

-- RLS Policies for notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE
USING (user_id = auth.uid());

-- RLS Policies for notification_preferences
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can view their own preferences" ON public.notification_preferences FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert their own preferences" ON public.notification_preferences FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can update their own preferences" ON public.notification_preferences FOR UPDATE
USING (user_id = auth.uid());

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create function to insert notification (used by triggers)
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id UUID,
  _agency_id UUID,
  _type notification_type,
  _title TEXT,
  _message TEXT,
  _link TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _notification_id UUID;
  _in_app_enabled BOOLEAN;
BEGIN
  -- Check if user has in-app notifications enabled for this type
  SELECT COALESCE(
    (SELECT in_app_enabled FROM notification_preferences 
     WHERE user_id = _user_id AND agency_id = _agency_id AND notification_type = _type),
    true
  ) INTO _in_app_enabled;

  IF _in_app_enabled THEN
    INSERT INTO notifications (user_id, agency_id, type, title, message, link, metadata)
    VALUES (_user_id, _agency_id, _type, _title, _message, _link, _metadata)
    RETURNING id INTO _notification_id;
  END IF;

  RETURN _notification_id;
END;
$$;

-- Create function to check if email notification is enabled
CREATE OR REPLACE FUNCTION public.is_email_notification_enabled(
  _user_id UUID,
  _agency_id UUID,
  _type notification_type
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT email_enabled FROM notification_preferences 
     WHERE user_id = _user_id AND agency_id = _agency_id AND notification_type = _type),
    true
  );
$$;

-- CREATE TRIGGER function for project editor assignment
CREATE OR REPLACE FUNCTION public.notify_editor_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project RECORD;
  _editor_name TEXT;
BEGIN
  -- Get project details
  SELECT p.*, a.name as agency_name 
  INTO _project
  FROM projects p
  JOIN agencies a ON a.id = p.agency_id
  WHERE p.id = NEW.project_id;

  -- Create notification for the editor
  PERFORM create_notification(
    NEW.editor_id,
    _project.agency_id,
    'editor_assigned',
    'New Project Assignment',
    'You have been assigned to project: ' || _project.title,
    '/editor/projects',
    jsonb_build_object('project_id', NEW.project_id, 'project_title', _project.title)
  );

  RETURN NEW;
END;
$$;

-- CREATE TRIGGER for editor assignment
CREATE TRIGGER on_editor_assigned
AFTER INSERT ON public.project_editors
FOR EACH ROW
EXECUTE FUNCTION notify_editor_assignment();

-- Create trigger function for project status changes
CREATE OR REPLACE FUNCTION public.notify_project_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _participant RECORD;
  _status_text TEXT;
BEGIN
  -- Only trigger if status actually changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  _status_text := CASE NEW.status
    WHEN 'backlog' THEN 'Backlog'
    WHEN 'in_progress' THEN 'In Progress'
    WHEN 'review' THEN 'Review'
    WHEN 'done' THEN 'Completed'
    WHEN 'proposal' THEN 'Proposal'
    WHEN 'cancelled' THEN 'Cancelled'
    ELSE NEW.status::TEXT
  END;

  -- Notify client if assigned
  IF NEW.client_id IS NOT NULL THEN
    PERFORM create_notification(
      NEW.client_id,
      NEW.agency_id,
      'project_status_change',
      'Project Status Updated',
      'Project "' || NEW.title || '" is now ' || _status_text,
      '/client/projects',
      jsonb_build_object('project_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;

  -- Notify assigned editors
  FOR _participant IN 
    SELECT editor_id FROM project_editors WHERE project_id = NEW.id
  LOOP
    PERFORM create_notification(
      _participant.editor_id,
      NEW.agency_id,
      'project_status_change',
      'Project Status Updated',
      'Project "' || NEW.title || '" is now ' || _status_text,
      '/editor/projects',
      jsonb_build_object('project_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- CREATE TRIGGER for project status changes
CREATE TRIGGER on_project_status_change
AFTER UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION notify_project_status_change();

-- Create trigger function for new proposals
CREATE OR REPLACE FUNCTION public.notify_new_proposal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin RECORD;
  _client_name TEXT;
BEGIN
  -- Only trigger for new proposals
  IF NEW.status != 'proposal' THEN
    RETURN NEW;
  END IF;

  -- Get client name
  SELECT COALESCE(full_name, email) INTO _client_name
  FROM profiles WHERE id = NEW.client_id;

  -- Notify all admins in the agency
  FOR _admin IN 
    SELECT user_id FROM user_roles WHERE agency_id = NEW.agency_id AND role = 'admin'
  LOOP
    PERFORM create_notification(
      _admin.user_id,
      NEW.agency_id,
      'proposal_created',
      'New Project Proposal',
      COALESCE(_client_name, 'A client') || ' submitted a proposal: ' || NEW.title,
      '/admin/projects',
      jsonb_build_object('project_id', NEW.id, 'client_id', NEW.client_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- CREATE TRIGGER for new proposals
CREATE TRIGGER on_new_proposal
AFTER INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION notify_new_proposal();

-- Create trigger function for invoice status changes
CREATE OR REPLACE FUNCTION public.notify_invoice_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project RECORD;
  _admin RECORD;
BEGIN
  -- Get project details
  SELECT * INTO _project FROM projects WHERE id = NEW.project_id;

  -- Notify client when invoice is sent (created)
  IF TG_OP = 'INSERT' THEN
    PERFORM create_notification(
      NEW.client_id,
      NEW.agency_id,
      'invoice_sent',
      'New Invoice',
      'You have received a new invoice for $' || NEW.amount::TEXT || ' for project: ' || _project.title,
      '/client/invoices',
      jsonb_build_object('invoice_id', NEW.id, 'amount', NEW.amount)
    );
  END IF;

  -- Notify admins when invoice is paid
  IF TG_OP = 'UPDATE' AND OLD.status != 'paid' AND NEW.status = 'paid' THEN
    FOR _admin IN 
      SELECT user_id FROM user_roles WHERE agency_id = NEW.agency_id AND role = 'admin'
    LOOP
      PERFORM create_notification(
        _admin.user_id,
        NEW.agency_id,
        'invoice_paid',
        'Invoice Paid',
        'Invoice for $' || NEW.amount::TEXT || ' has been marked as paid',
        '/admin/invoices',
        jsonb_build_object('invoice_id', NEW.id, 'amount', NEW.amount, 'client_id', NEW.client_id)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Create triggers for invoices
DROP TRIGGER IF EXISTS on_invoice_created ON public.invoices;
CREATE TRIGGER on_invoice_created
AFTER INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION notify_invoice_change();

DROP TRIGGER IF EXISTS on_invoice_updated ON public.invoices;
CREATE TRIGGER on_invoice_updated
AFTER UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION notify_invoice_change();

-- CREATE TRIGGER function for new messages
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _channel RECORD;
  _sender_name TEXT;
  _participant RECORD;
  _link TEXT;
  _user_role app_role;
BEGIN
  -- Get channel details
  SELECT c.*, p.title as project_title
  INTO _channel
  FROM channels c
  LEFT JOIN projects p ON p.id = c.project_id
  WHERE c.id = NEW.channel_id;

  -- Get sender name
  SELECT COALESCE(full_name, email) INTO _sender_name
  FROM profiles WHERE id = NEW.sender_id;

  -- Notify all other participants in the channel
  FOR _participant IN 
    SELECT cp.user_id, ur.role
    FROM channel_participants cp
    JOIN user_roles ur ON ur.user_id = cp.user_id AND ur.agency_id = _channel.agency_id
    WHERE cp.channel_id = NEW.channel_id AND cp.user_id != NEW.sender_id
  LOOP
    -- Determine the correct link based on user role
    _link := CASE _participant.role
      WHEN 'admin' THEN '/admin/messages'
      WHEN 'client' THEN '/client/messages'
      WHEN 'editor' THEN '/editor/messages'
      ELSE '/messages'
    END;

    PERFORM create_notification(
      _participant.user_id,
      _channel.agency_id,
      'new_message',
      'New Message',
      COALESCE(_sender_name, 'Someone') || ': ' || LEFT(NEW.content, 100) || CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END,
      _link,
      jsonb_build_object('channel_id', NEW.channel_id, 'message_id', NEW.id, 'sender_id', NEW.sender_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- CREATE TRIGGER for new messages
CREATE TRIGGER on_new_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION notify_new_message();

-- CREATE TRIGGER for updated_at ON notification_preferences
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- >>> 20260204234155_53eb3f7f-91df-49fd-b358-338d00d37acf.sql

-- Create project_containers table for the middle tier (Client > Container > Video)
CREATE TABLE IF NOT EXISTS public.project_containers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add container_id to projects table FIRST (before RLS policies reference it)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS container_id UUID;

-- Enable RLS
ALTER TABLE public.project_containers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_containers
DROP POLICY IF EXISTS "Admins can manage agency project containers" ON public.project_containers;
CREATE POLICY "Admins can manage agency project containers" ON public.project_containers
FOR ALL
USING (
  has_role(auth.uid(), 'admin') 
  AND agency_id = get_user_agency_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin') 
  AND agency_id = get_user_agency_id(auth.uid())
);

DROP POLICY IF EXISTS "Clients can view their project containers" ON public.project_containers;
CREATE POLICY "Clients can view their project containers" ON public.project_containers
FOR SELECT
USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Editors can view containers for assigned projects" ON public.project_containers;
CREATE POLICY "Editors can view containers for assigned projects" ON public.project_containers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.project_editors pe ON pe.project_id = p.id
    WHERE p.container_id = project_containers.id
    AND pe.editor_id = auth.uid()
  )
);

-- Add foreign key constraint after column exists
ALTER TABLE public.projects 
ADD CONSTRAINT fk_projects_container 
FOREIGN KEY (container_id) REFERENCES public.project_containers(id) ON DELETE CASCADE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_container_id ON public.projects(container_id);
CREATE INDEX IF NOT EXISTS idx_project_containers_client_id ON public.project_containers(client_id);
CREATE INDEX IF NOT EXISTS idx_project_containers_agency_id ON public.project_containers(agency_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_project_containers_updated_at ON public.project_containers;
CREATE TRIGGER update_project_containers_updated_at
BEFORE UPDATE ON public.project_containers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if container belongs to agency
CREATE OR REPLACE FUNCTION public.container_belongs_to_agency(_container_id uuid, _agency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_containers pc
    WHERE pc.id = _container_id
      AND pc.agency_id = _agency_id
  )
$$;

-- >>> 20260207121848_b815c9e2-ff19-467c-b298-e24978b5eba6.sql

-- Create payment_methods table for agency payment profiles
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  details TEXT NOT NULL,
  payment_link TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on payment_methods
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Admins can manage payment methods in their agency
DROP POLICY IF EXISTS "Admins can manage payment methods" ON public.payment_methods;
CREATE POLICY "Admins can manage payment methods" ON public.payment_methods FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) AND agency_id = get_user_agency_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND agency_id = get_user_agency_id(auth.uid()));

-- All agency members can view payment methods (needed for invoice display)
DROP POLICY IF EXISTS "Agency members can view payment methods" ON public.payment_methods;
CREATE POLICY "Agency members can view payment methods" ON public.payment_methods FOR SELECT
  USING (user_belongs_to_agency(auth.uid(), agency_id));

-- Create invoice_line_items table
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  rate NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on invoice_line_items
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Admins can manage line items for their agency invoices
DROP POLICY IF EXISTS "Admins can manage invoice line items" ON public.invoice_line_items;
CREATE POLICY "Admins can manage invoice line items" ON public.invoice_line_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_line_items.invoice_id
      AND has_role(auth.uid(), 'admin'::app_role)
      AND i.agency_id = get_user_agency_id(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_line_items.invoice_id
      AND has_role(auth.uid(), 'admin'::app_role)
      AND i.agency_id = get_user_agency_id(auth.uid())
    )
  );

-- Clients can view line items for their invoices
DROP POLICY IF EXISTS "Clients can view their invoice line items" ON public.invoice_line_items;
CREATE POLICY "Clients can view their invoice line items" ON public.invoice_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_line_items.invoice_id
      AND i.client_id = auth.uid()
    )
  );

-- Add new columns to invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_link TEXT,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Create function to generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number(_agency_id UUID)
RETURNS TEXT AS $$
DECLARE
  count INTEGER;
  year_str TEXT;
BEGIN
  year_str := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO count
  FROM invoices
  WHERE agency_id = _agency_id
  AND created_at >= date_trunc('year', now());
  
  RETURN 'INV-' || year_str || '-' || LPAD(count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- CREATE TRIGGER for updated_at ON payment_methods
DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON public.payment_methods;
CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- >>> 20260207131323_acb4b1fd-bf12-4a9f-b370-0eda251c283d.sql

-- Add 'paid' and 'archived' values to project_status enum
-- [migration-export] enum value folded into CREATE TYPE above: ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'paid';
-- [migration-export] enum value folded into CREATE TYPE above: ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'archived';

-- Create a function to notify users when video is approved or revision requested
CREATE OR REPLACE FUNCTION public.notify_video_approval()
RETURNS TRIGGER AS $$
DECLARE
  _agency_id UUID;
  _project_title TEXT;
  _client_name TEXT;
  _editor_id UUID;
  _admin_id UUID;
BEGIN
  -- Only trigger on status changes to 'done' (approved) or 'in_progress' (revision)
  IF OLD.status = 'review' AND (NEW.status = 'done' OR NEW.status = 'in_progress') THEN
    -- Get project details
    _agency_id := NEW.agency_id;
    _project_title := NEW.title;
    
    -- Get client name
    SELECT full_name INTO _client_name
    FROM public.profiles
    WHERE id = NEW.client_id;
    
    -- Get assigned editor
    SELECT editor_id INTO _editor_id
    FROM public.project_editors
    WHERE project_id = NEW.id
    LIMIT 1;
    
    -- Get admin (first admin in agency)
    SELECT user_id INTO _admin_id
    FROM public.user_roles
    WHERE agency_id = _agency_id AND role = 'admin'
    LIMIT 1;
    
    IF NEW.status = 'done' THEN
      -- Video was approved - notify admin
      IF _admin_id IS NOT NULL THEN
        PERFORM public.create_notification(
          _agency_id,
          '/admin/projects',
          format('%s approved "%s"', COALESCE(_client_name, 'Client'), _project_title),
          NULL,
          'Video Approved',
          'project_status_change',
          _admin_id
        );
      END IF;
      
      -- Notify editor if assigned
      IF _editor_id IS NOT NULL THEN
        PERFORM public.create_notification(
          _agency_id,
          '/editor/projects',
          format('"%s" has been approved by the client', _project_title),
          NULL,
          'Video Approved',
          'project_status_change',
          _editor_id
        );
      END IF;
    ELSIF NEW.status = 'in_progress' THEN
      -- Revision requested - notify admin
      IF _admin_id IS NOT NULL THEN
        PERFORM public.create_notification(
          _agency_id,
          '/admin/projects',
          format('%s requested revision for "%s"', COALESCE(_client_name, 'Client'), _project_title),
          NULL,
          'Revision Requested',
          'project_status_change',
          _admin_id
        );
      END IF;
      
      -- Notify editor if assigned
      IF _editor_id IS NOT NULL THEN
        PERFORM public.create_notification(
          _agency_id,
          '/editor/projects',
          format('Revision requested for "%s"', _project_title),
          NULL,
          'Revision Requested',
          'project_status_change',
          _editor_id
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- CREATE TRIGGER for video approval notifications
DROP TRIGGER IF EXISTS trigger_video_approval_notification ON public.projects;
DROP TRIGGER IF EXISTS trigger_video_approval_notification ON public.projects;
CREATE TRIGGER trigger_video_approval_notification
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_video_approval();

-- Update RLS policy for projects to allow clients to update status from review to done or in_progress
DROP POLICY IF EXISTS "Clients can approve their review videos" ON public.projects;
DROP POLICY IF EXISTS "Clients can approve their review videos" ON public.projects;
CREATE POLICY "Clients can approve their review videos" ON public.projects
  FOR UPDATE
  USING (
    auth.uid() = client_id 
    AND status = 'review'
  )
  WITH CHECK (
    auth.uid() = client_id 
    AND (status = 'done' OR status = 'in_progress')
  );

-- >>> 20260207132234_4b6ceeda-e2a2-40ff-b68f-428d77327852.sql

-- Drop the existing trigger that creates channels on every project insert
DROP TRIGGER IF EXISTS trigger_create_project_channel ON public.projects;

-- Create a new function that creates channel when project is approved (status changes from proposal)
CREATE OR REPLACE FUNCTION public.create_channel_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _channel_id UUID;
  _admin_id UUID;
BEGIN
  -- Only create channel when moving FROM proposal to another status
  IF OLD.status = 'proposal' AND NEW.status != 'proposal' THEN
    -- Check if channel already exists
    SELECT id INTO _channel_id
    FROM public.channels
    WHERE project_id = NEW.id AND type = 'project'
    LIMIT 1;
    
    IF _channel_id IS NULL THEN
      -- Create channel for this project
      INSERT INTO public.channels (agency_id, type, project_id, name)
      VALUES (NEW.agency_id, 'project', NEW.id, NEW.title)
      RETURNING id INTO _channel_id;
    END IF;

    -- Add admin (agency creator or first admin)
    SELECT ur.user_id INTO _admin_id
    FROM public.user_roles ur
    WHERE ur.agency_id = NEW.agency_id AND ur.role = 'admin'
    LIMIT 1;

    IF _admin_id IS NOT NULL THEN
      INSERT INTO public.channel_participants (channel_id, user_id)
      VALUES (_channel_id, _admin_id)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Add client if assigned
    IF NEW.client_id IS NOT NULL THEN
      INSERT INTO public.channel_participants (channel_id, user_id)
      VALUES (_channel_id, NEW.client_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- CREATE TRIGGER for channel creation ON approval
DROP TRIGGER IF EXISTS trigger_create_channel_on_approval ON public.projects;
CREATE TRIGGER trigger_create_channel_on_approval
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.create_channel_on_approval();

-- Update the existing create_project_channel trigger function to only fire for non-proposal projects
-- This handles when admin creates a project directly (not from a proposal)
CREATE OR REPLACE FUNCTION public.create_project_channel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _channel_id UUID;
  _admin_id UUID;
BEGIN
  -- Only create channel for new projects that are NOT proposals
  IF NEW.status != 'proposal' THEN
    -- Create channel for this project
    INSERT INTO public.channels (agency_id, type, project_id, name)
    VALUES (NEW.agency_id, 'project', NEW.id, NEW.title)
    RETURNING id INTO _channel_id;

    -- Add admin (agency creator or first admin)
    SELECT ur.user_id INTO _admin_id
    FROM public.user_roles ur
    WHERE ur.agency_id = NEW.agency_id AND ur.role = 'admin'
    LIMIT 1;

    IF _admin_id IS NOT NULL THEN
      INSERT INTO public.channel_participants (channel_id, user_id)
      VALUES (_channel_id, _admin_id)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Add client if assigned
    IF NEW.client_id IS NOT NULL THEN
      INSERT INTO public.channel_participants (channel_id, user_id)
      VALUES (_channel_id, NEW.client_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate the insert trigger for new projects
DROP TRIGGER IF EXISTS trigger_create_project_channel ON public.projects;
CREATE TRIGGER trigger_create_project_channel
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.create_project_channel();

-- >>> 20260208212928_85db4360-d539-4033-800b-d0fe5faaa624.sql

-- Add RLS policy for admins to delete profiles of users in their agency
DROP POLICY IF EXISTS "Admins can delete profiles in their agency" ON public.profiles;
CREATE POLICY "Admins can delete profiles in their agency" ON public.profiles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND id != auth.uid()
  AND (
    -- Check if the target user belongs to the same agency as the admin
    EXISTS (
      SELECT 1 FROM public.user_roles ur_admin
      JOIN public.user_roles ur_target ON ur_target.agency_id = ur_admin.agency_id
      WHERE ur_admin.user_id = auth.uid()
        AND ur_admin.role = 'admin'
        AND ur_target.user_id = profiles.id
    )
  )
);

-- >>> 20260209104304_04b4d24f-3c82-4f70-bc44-a19971441148.sql

-- Add legal compliance fields to agencies table for professional invoicing
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS business_name TEXT,
ADD COLUMN IF NOT EXISTS business_address TEXT,
ADD COLUMN IF NOT EXISTS tax_id TEXT,
ADD COLUMN IF NOT EXISTS invoice_footer TEXT;

-- Add a new status 'request' to the project_status enum for video requests
-- First check if it exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'request' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'project_status')) THEN
NULL; -- enum value folded into CREATE TYPE above
    END IF;
END $$;

-- >>> 20260209105007_53c44969-cdd1-428e-bf80-4de0f0850553.sql

-- Create employment_type enum
DO $do$ BEGIN
  CREATE TYPE public.employment_type AS ENUM ('freelance', 'salaried');
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;

-- Add employment columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS employment_type public.employment_type NOT NULL DEFAULT 'freelance',
ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS accumulated_bonus NUMERIC NOT NULL DEFAULT 0;

-- >>> 20260209143956_67aedf47-d25d-436e-99b5-9e830b790614.sql


-- Add parent_id for reply threads
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

-- Create message_reactions table
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Users can view reactions in their channels
DROP POLICY IF EXISTS "Users can view reactions in their channels" ON public.message_reactions;
CREATE POLICY "Users can view reactions in their channels" ON public.message_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN channel_participants cp ON cp.channel_id = m.channel_id
    WHERE m.id = message_reactions.message_id AND cp.user_id = auth.uid()
  )
);

-- Users can add reactions to messages in their channels
DROP POLICY IF EXISTS "Users can add reactions" ON public.message_reactions;
CREATE POLICY "Users can add reactions" ON public.message_reactions
FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM messages m
    JOIN channel_participants cp ON cp.channel_id = m.channel_id
    WHERE m.id = message_reactions.message_id AND cp.user_id = auth.uid()
  )
);

-- Users can remove their own reactions
DROP POLICY IF EXISTS "Users can remove their own reactions" ON public.message_reactions;
CREATE POLICY "Users can remove their own reactions" ON public.message_reactions
FOR DELETE
USING (user_id = auth.uid());

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

-- CREATE INDEX IF NOT EXISTS for performance
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON public.messages(parent_id);

-- >>> 20260210102859_9536d5e2-2afe-4b53-ad73-fa09a7588d06.sql

DROP POLICY IF EXISTS "Admins can update profiles in their agency" ON public.profiles;
CREATE POLICY "Admins can update profiles in their agency" ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM user_roles ur_admin
    JOIN user_roles ur_target ON ur_target.agency_id = ur_admin.agency_id
    WHERE ur_admin.user_id = auth.uid()
    AND ur_admin.role = 'admin'::app_role
    AND ur_target.user_id = profiles.id
  )
);

-- >>> 20260210103719_65cd3362-d6b5-4d1f-95d2-8c69984b3d9c.sql


-- Payroll payments table to track paid/unpaid status per month
CREATE TABLE IF NOT EXISTS public.payroll_payments (
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

DROP POLICY IF EXISTS "Admins can manage payroll payments" ON public.payroll_payments;
CREATE POLICY "Admins can manage payroll payments" ON public.payroll_payments FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND user_belongs_to_agency(auth.uid(), agency_id)
);

DROP POLICY IF EXISTS "Editors can view their own payments" ON public.payroll_payments;
CREATE POLICY "Editors can view their own payments" ON public.payroll_payments FOR SELECT
USING (auth.uid() = editor_id);

DROP TRIGGER IF EXISTS update_payroll_payments_updated_at ON public.payroll_payments;
CREATE TRIGGER update_payroll_payments_updated_at
BEFORE UPDATE ON public.payroll_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Company owes / balance tracking (security funds, advances, etc.)
CREATE TABLE IF NOT EXISTS public.editor_balances (
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

DROP POLICY IF EXISTS "Admins can manage editor balances" ON public.editor_balances;
CREATE POLICY "Admins can manage editor balances" ON public.editor_balances FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND user_belongs_to_agency(auth.uid(), agency_id)
);

DROP POLICY IF EXISTS "Editors can view their own balances" ON public.editor_balances;
CREATE POLICY "Editors can view their own balances" ON public.editor_balances FOR SELECT
USING (auth.uid() = editor_id);

DROP TRIGGER IF EXISTS update_editor_balances_updated_at ON public.editor_balances;
CREATE TRIGGER update_editor_balances_updated_at
BEFORE UPDATE ON public.editor_balances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- >>> 20260210105213_22ac5da3-e433-41c0-97d0-0673cb02a92c.sql

DROP POLICY IF EXISTS "Clients can create video requests" ON public.projects;
CREATE POLICY "Clients can create video requests" ON public.projects
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'client'::app_role)
  AND client_id = auth.uid()
  AND status = 'request'::project_status
);

-- >>> 20260211235823_6f66fcc4-6d57-45d9-a9a0-147a8709aba3.sql


-- 1. Add container_id column to channels table
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS container_id UUID REFERENCES public.project_containers(id) ON DELETE CASCADE;

-- 2. Drop ALL per-video channel creation triggers (they cause duplicates + wrong level)
DROP TRIGGER IF EXISTS trigger_create_project_channel ON public.projects;
DROP TRIGGER IF EXISTS on_project_created_create_channel ON public.projects;
DROP TRIGGER IF EXISTS trigger_create_channel_on_approval ON public.projects;

-- 3. Drop duplicate editor-to-channel triggers  
DROP TRIGGER IF EXISTS trigger_add_editor_to_channel ON public.project_editors;
DROP TRIGGER IF EXISTS on_editor_assigned_add_to_channel ON public.project_editors;

-- 4. Drop archive triggers (containers don't have status)
DROP TRIGGER IF EXISTS on_project_status_change_archive_channel ON public.projects;
DROP TRIGGER IF EXISTS trigger_auto_archive_project_channel ON public.projects;

-- 5. Create function to create channel when a project container is created
CREATE OR REPLACE FUNCTION public.create_container_channel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _channel_id UUID;
  _admin_id UUID;
BEGIN
  -- Create channel for this container
  INSERT INTO public.channels (agency_id, type, container_id, name)
  VALUES (NEW.agency_id, 'project', NEW.id, NEW.title)
  RETURNING id INTO _channel_id;

  -- Add admin (first admin in agency)
  SELECT ur.user_id INTO _admin_id
  FROM public.user_roles ur
  WHERE ur.agency_id = NEW.agency_id AND ur.role = 'admin'
  LIMIT 1;

  IF _admin_id IS NOT NULL THEN
    INSERT INTO public.channel_participants (channel_id, user_id)
    VALUES (_channel_id, _admin_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Add client
  IF NEW.client_id IS NOT NULL THEN
    INSERT INTO public.channel_participants (channel_id, user_id)
    VALUES (_channel_id, NEW.client_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_container_channel ON public.project_containers;
CREATE TRIGGER trigger_create_container_channel
AFTER INSERT ON public.project_containers
FOR EACH ROW EXECUTE FUNCTION public.create_container_channel();

-- 6. Create function to add editor to container channel when assigned to a video
CREATE OR REPLACE FUNCTION public.add_editor_to_container_channel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _container_id UUID;
  _channel_id UUID;
BEGIN
  -- Get container_id from the project (video)
  SELECT container_id INTO _container_id
  FROM public.projects
  WHERE id = NEW.project_id;

  IF _container_id IS NOT NULL THEN
    -- Find the container's channel
    SELECT id INTO _channel_id
    FROM public.channels
    WHERE container_id = _container_id AND type = 'project'
    LIMIT 1;

    IF _channel_id IS NOT NULL THEN
      INSERT INTO public.channel_participants (channel_id, user_id)
      VALUES (_channel_id, NEW.editor_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_add_editor_to_container_channel ON public.project_editors;
CREATE TRIGGER trigger_add_editor_to_container_channel
AFTER INSERT ON public.project_editors
FOR EACH ROW EXECUTE FUNCTION public.add_editor_to_container_channel();

-- 7. Clean up existing duplicate/per-video channels
-- Delete all per-video project channels (they'll be recreated at container level)
DELETE FROM public.channels WHERE type = 'project' AND project_id IS NOT NULL;

-- >>> 20260212000733_764fd221-32df-43b5-8a74-b2e73d3e49bf.sql


ALTER TABLE public.channels DROP CONSTRAINT channels_project_check;

ALTER TABLE public.channels ADD CONSTRAINT channels_project_check CHECK (
  (type = 'dm' AND project_id IS NULL AND container_id IS NULL)
  OR (type = 'project' AND (project_id IS NOT NULL OR container_id IS NOT NULL))
);

-- >>> 20260212002813_178e8c50-a844-453f-96f6-e711a95b1968.sql


CREATE OR REPLACE FUNCTION public.notify_video_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _agency_id UUID;
  _project_title TEXT;
  _client_name TEXT;
  _editor_id UUID;
  _admin_id UUID;
BEGIN
  IF OLD.status = 'review' AND (NEW.status = 'done' OR NEW.status = 'in_progress') THEN
    _agency_id := NEW.agency_id;
    _project_title := NEW.title;
    
    SELECT full_name INTO _client_name
    FROM public.profiles
    WHERE id = NEW.client_id;
    
    SELECT editor_id INTO _editor_id
    FROM public.project_editors
    WHERE project_id = NEW.id
    LIMIT 1;
    
    SELECT user_id INTO _admin_id
    FROM public.user_roles
    WHERE agency_id = _agency_id AND role = 'admin'
    LIMIT 1;
    
    IF NEW.status = 'done' THEN
      IF _admin_id IS NOT NULL THEN
        PERFORM public.create_notification(
          _admin_id,
          _agency_id,
          'project_status_change',
          'Video Approved',
          format('%s approved "%s"', COALESCE(_client_name, 'Client'), _project_title),
          '/admin/projects'
        );
      END IF;
      
      IF _editor_id IS NOT NULL THEN
        PERFORM public.create_notification(
          _editor_id,
          _agency_id,
          'project_status_change',
          'Video Approved',
          format('"%s" has been approved by the client', _project_title),
          '/editor/projects'
        );
      END IF;
    ELSIF NEW.status = 'in_progress' THEN
      IF _admin_id IS NOT NULL THEN
        PERFORM public.create_notification(
          _admin_id,
          _agency_id,
          'project_status_change',
          'Revision Requested',
          format('%s requested revision for "%s"', COALESCE(_client_name, 'Client'), _project_title),
          '/admin/projects'
        );
      END IF;
      
      IF _editor_id IS NOT NULL THEN
        PERFORM public.create_notification(
          _editor_id,
          _agency_id,
          'project_status_change',
          'Revision Requested',
          format('Revision requested for "%s"', _project_title),
          '/editor/projects'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- >>> 20260213172225_64c89adc-8425-40ce-a5ff-103ab3735c17.sql

-- Allow admins to upload agency logos to the avatars bucket under agency-logos/ path
DROP POLICY IF EXISTS "Admins can upload agency logos" ON storage.objects;
CREATE POLICY "Admins can upload agency logos" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'agency-logos'
  AND has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Admins can update agency logos" ON storage.objects;
CREATE POLICY "Admins can update agency logos" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'agency-logos'
  AND has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Admins can delete agency logos" ON storage.objects;
CREATE POLICY "Admins can delete agency logos" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'agency-logos'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- >>> 20260215131301_601545f8-a8c9-481d-8599-6530ed944c9b.sql


-- 1. Change column default for email_enabled to false
ALTER TABLE public.notification_preferences ALTER COLUMN email_enabled SET DEFAULT false;

-- 2. Update the is_email_notification_enabled function to default to false
CREATE OR REPLACE FUNCTION public.is_email_notification_enabled(_user_id uuid, _agency_id uuid, _type notification_type)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT email_enabled FROM notification_preferences 
     WHERE user_id = _user_id AND agency_id = _agency_id AND notification_type = _type),
    false
  );
$function$;

-- >>> 20260215135259_cee09c83-9d92-4b92-9dee-44a43f7d9350.sql


-- Create push_subscriptions table to store Web Push subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view their own subscriptions" ON public.push_subscriptions FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert their own subscriptions" ON public.push_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update their own subscriptions" ON public.push_subscriptions FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete their own subscriptions" ON public.push_subscriptions FOR DELETE
  USING (user_id = auth.uid());

-- Enable realtime for notifications table (needed for push trigger)
ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;

-- >>> 20260215135523_793f3e24-f162-43c0-b1c9-521ea9a67e2a.sql


-- Create a function that sends web push notifications via the edge function
-- This will be called by a trigger on the notifications table
CREATE OR REPLACE FUNCTION public.trigger_web_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Call the edge function asynchronously via pg_net
  PERFORM net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/send-web-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'link', NEW.link,
      'type', NEW.type
    )
  );
  
  RETURN NEW;
END;
$function$;

-- CREATE TRIGGER to send web push ON notification insert
DROP TRIGGER IF EXISTS on_notification_send_web_push ON public.notifications;
CREATE TRIGGER on_notification_send_web_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_web_push_notification();

-- >>> 20260216051110_2999817b-c1d9-442a-8f93-0b9362e7a51e.sql


-- Drop the trigger that uses pg_net (which doesn't exist on this instance)
DROP TRIGGER IF EXISTS on_notification_send_web_push ON public.notifications;
DROP FUNCTION IF EXISTS public.trigger_web_push_notification();

-- >>> 20260216093514_24d34f20-c7e9-4732-8a1c-814a66b85620.sql


-- Allow users to update their own messages (for editing)
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
CREATE POLICY "Users can update their own messages" ON public.messages
FOR UPDATE
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- Allow users to delete their own messages (hard delete)
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages" ON public.messages
FOR DELETE
USING (sender_id = auth.uid());

-- Also allow cascade delete of reactions when message is deleted
-- Reactions already have DELETE policy for own reactions, but we need
-- a policy so that when a message is deleted, its reactions can be cleaned up
-- We'll handle this in application code before deleting the message

-- >>> 20260216093724_ce6ae32e-7179-42d9-b0c9-b849edae8e51.sql


-- Allow deleting read receipts for messages owned by the deleter
-- This is needed for cleanup when a user deletes their own message
DROP POLICY IF EXISTS "Users can delete read receipts for their messages" ON public.message_read_receipts;
CREATE POLICY "Users can delete read receipts for their messages" ON public.message_read_receipts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_read_receipts.message_id
    AND m.sender_id = auth.uid()
  )
);

-- >>> 20260219010622_0a6dbf39-6e47-4b76-9074-5f708e756304.sql


-- Rename lemon_squeezy_customer_id to paddle_customer_id
ALTER TABLE public.agencies RENAME COLUMN lemon_squeezy_customer_id TO paddle_customer_id;

-- >>> 20260221195955_e077c990-f34e-4f5d-91c3-a25214ed1449.sql

-- Create a public bucket for chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to chat-attachments
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat attachments" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

-- Allow public read access to chat attachments
DROP POLICY IF EXISTS "Public read access to chat attachments" ON storage.objects;
CREATE POLICY "Public read access to chat attachments" ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-attachments');

-- Allow users to delete their own chat attachments
DROP POLICY IF EXISTS "Users can delete own chat attachments" ON storage.objects;
CREATE POLICY "Users can delete own chat attachments" ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- >>> 20260223074439_03344d14-1c41-4c95-b6d6-054a55e1bff7.sql


-- 1. is_super_admin function
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND email = 'hello@fahadkamran.com'
  );
$$;

-- 2. get_admin_agency_stats: security definer function to bypass RLS
CREATE OR REPLACE FUNCTION public.get_admin_agency_stats()
RETURNS TABLE(
  agency_id uuid,
  agency_name text,
  plan_tier text,
  subscription_plan text,
  subscription_ends_at timestamptz,
  storage_used_bytes bigint,
  storage_limit_bytes bigint,
  created_at timestamptz,
  client_count bigint,
  editor_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    a.id AS agency_id,
    a.name AS agency_name,
    a.plan_tier,
    a.subscription_plan,
    a.subscription_ends_at,
    a.storage_used_bytes,
    a.storage_limit_bytes,
    a.created_at,
    COUNT(DISTINCT CASE WHEN ur.role = 'client' THEN ur.user_id END) AS client_count,
    COUNT(DISTINCT CASE WHEN ur.role = 'editor' THEN ur.user_id END) AS editor_count
  FROM public.agencies a
  LEFT JOIN public.user_roles ur ON ur.agency_id = a.id
  GROUP BY a.id, a.name, a.plan_tier, a.subscription_plan, a.subscription_ends_at,
           a.storage_used_bytes, a.storage_limit_bytes, a.created_at;
$$;

-- 3. system_logs table
CREATE TABLE IF NOT EXISTS public.system_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Only super admin can read
DROP POLICY IF EXISTS "Super admin can read system logs" ON public.system_logs;
CREATE POLICY "Super admin can read system logs" ON public.system_logs
FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- No direct inserts from clients - only via security definer functions
-- Create a helper to insert system logs from triggers/functions
CREATE OR REPLACE FUNCTION public.insert_system_log(
  _event_type text,
  _message text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.system_logs (event_type, message, metadata)
  VALUES (_event_type, _message, _metadata);
END;
$$;

-- >>> 20260224172151_2fed5551-bc7c-459e-b6a0-f7594ee444a1.sql


-- Trigger: Log when a new agency is created
CREATE OR REPLACE FUNCTION public.log_new_agency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  PERFORM insert_system_log(
    'new_agency',
    'New agency created: ' || NEW.name || ' (Plan: ' || NEW.plan_tier || ')',
    jsonb_build_object('agency_id', NEW.id, 'plan_tier', NEW.plan_tier, 'created_by', NEW.created_by)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_new_agency ON public.agencies;
CREATE TRIGGER trg_log_new_agency
  AFTER INSERT ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public.log_new_agency();

-- Trigger: Log when subscription/plan changes
CREATE OR REPLACE FUNCTION public.log_subscription_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.plan_tier IS DISTINCT FROM NEW.plan_tier
     OR OLD.subscription_plan IS DISTINCT FROM NEW.subscription_plan
     OR OLD.billing_interval IS DISTINCT FROM NEW.billing_interval THEN
    PERFORM insert_system_log(
      'subscription_change',
      'Agency "' || NEW.name || '" changed plan: ' || OLD.plan_tier || ' → ' || NEW.plan_tier,
      jsonb_build_object(
        'agency_id', NEW.id,
        'old_plan', OLD.plan_tier,
        'new_plan', NEW.plan_tier,
        'old_interval', OLD.billing_interval,
        'new_interval', NEW.billing_interval
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_subscription_change ON public.agencies;
CREATE TRIGGER trg_log_subscription_change
  AFTER UPDATE ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public.log_subscription_change();

-- Trigger: Log new user signups (profile creation)
CREATE OR REPLACE FUNCTION public.log_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  PERFORM insert_system_log(
    'new_signup',
    'New user signed up: ' || COALESCE(NEW.full_name, NEW.email),
    jsonb_build_object('user_id', NEW.id, 'email', NEW.email)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_new_user_signup ON public.profiles;
CREATE TRIGGER trg_log_new_user_signup
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_new_user_signup();

-- >>> 20260302071008_77a9ba25-5b91-4def-8b08-ed724e78e72d.sql


-- Public review links table
CREATE TABLE IF NOT EXISTS public.public_review_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id uuid NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  expires_at timestamp with time zone,
  allow_approval boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Public review comments table (no auth required)
CREATE TABLE IF NOT EXISTS public.public_review_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_link_id uuid NOT NULL REFERENCES public.public_review_links(id) ON DELETE CASCADE,
  reviewer_name text NOT NULL DEFAULT 'Anonymous',
  content text NOT NULL,
  timestamp_seconds numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.public_review_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_review_comments ENABLE ROW LEVEL SECURITY;

-- RLS for review links: only authenticated users who belong to the project's agency
DROP POLICY IF EXISTS "Users can view review links for their deliverables" ON public.public_review_links;
CREATE POLICY "Users can view review links for their deliverables" ON public.public_review_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      JOIN public.projects p ON p.id = d.project_id
      WHERE d.id = public_review_links.deliverable_id
      AND (
        has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), p.agency_id)
        OR p.client_id = auth.uid()
        OR is_project_editor(auth.uid(), p.id)
      )
    )
  );

DROP POLICY IF EXISTS "Admins and editors can create review links" ON public.public_review_links;
CREATE POLICY "Admins and editors can create review links" ON public.public_review_links FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.deliverables d
      JOIN public.projects p ON p.id = d.project_id
      WHERE d.id = public_review_links.deliverable_id
      AND (
        has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), p.agency_id)
        OR is_project_editor(auth.uid(), p.id)
      )
    )
  );

DROP POLICY IF EXISTS "Admins and editors can update review links" ON public.public_review_links;
CREATE POLICY "Admins and editors can update review links" ON public.public_review_links FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      JOIN public.projects p ON p.id = d.project_id
      WHERE d.id = public_review_links.deliverable_id
      AND (
        has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), p.agency_id)
        OR is_project_editor(auth.uid(), p.id)
      )
    )
  );

DROP POLICY IF EXISTS "Admins and editors can delete review links" ON public.public_review_links;
CREATE POLICY "Admins and editors can delete review links" ON public.public_review_links FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverables d
      JOIN public.projects p ON p.id = d.project_id
      WHERE d.id = public_review_links.deliverable_id
      AND (
        has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), p.agency_id)
        OR is_project_editor(auth.uid(), p.id)
      )
    )
  );

-- RLS for review comments: authenticated users can view comments on their deliverables
DROP POLICY IF EXISTS "Users can view public review comments for their deliverables" ON public.public_review_comments;
CREATE POLICY "Users can view public review comments for their deliverables" ON public.public_review_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.public_review_links prl
      JOIN public.deliverables d ON d.id = prl.deliverable_id
      JOIN public.projects p ON p.id = d.project_id
      WHERE prl.id = public_review_comments.review_link_id
      AND (
        has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), p.agency_id)
        OR p.client_id = auth.uid()
        OR is_project_editor(auth.uid(), p.id)
      )
    )
  );

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.public_review_comments;

-- Trigger for updated_at on review links
DROP TRIGGER IF EXISTS update_public_review_links_updated_at ON public.public_review_links;
CREATE TRIGGER update_public_review_links_updated_at
  BEFORE UPDATE ON public.public_review_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- >>> 20260303023425_db62901e-859c-4e53-a6e0-ec9608878859.sql


-- Add granular permissions to public_review_links
ALTER TABLE public.public_review_links
ADD COLUMN IF NOT EXISTS allow_comments boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_download boolean NOT NULL DEFAULT false;

-- >>> 20260306151123_6ea41d05-e185-48c7-bbb8-dd4af75cdbb0.sql


CREATE TABLE IF NOT EXISTS public.bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'bug' CHECK (type IN ('bug', 'suggestion')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reports
DROP POLICY IF EXISTS "Users can create bug reports" ON public.bug_reports;
CREATE POLICY "Users can create bug reports" ON public.bug_reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own reports
DROP POLICY IF EXISTS "Users can view own bug reports" ON public.bug_reports;
CREATE POLICY "Users can view own bug reports" ON public.bug_reports FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Super admin can view all
DROP POLICY IF EXISTS "Super admin can view all bug reports" ON public.bug_reports;
CREATE POLICY "Super admin can view all bug reports" ON public.bug_reports FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Super admin can update all
DROP POLICY IF EXISTS "Super admin can update bug reports" ON public.bug_reports;
CREATE POLICY "Super admin can update bug reports" ON public.bug_reports FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()));

-- >>> 20260307043646_cbccbcef-6b3a-493a-94eb-a69bed90433f.sql


-- Allow admins/editors to delete deliverable comments
DROP POLICY IF EXISTS "Admins and editors can delete comments" ON public.deliverable_comments;
CREATE POLICY "Admins and editors can delete comments" ON public.deliverable_comments
FOR DELETE
TO authenticated
USING (
  (user_id = auth.uid()) OR
  EXISTS (
    SELECT 1
    FROM deliverables d
    JOIN projects p ON p.id = d.project_id
    WHERE d.id = deliverable_comments.deliverable_id
    AND (
      (has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), p.agency_id))
      OR is_project_editor(auth.uid(), p.id)
    )
  )
);

-- Allow admins/editors to update public_review_comments (for resolving)
DROP POLICY IF EXISTS "Admins and editors can update public review comments" ON public.public_review_comments;
CREATE POLICY "Admins and editors can update public review comments" ON public.public_review_comments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public_review_links prl
    JOIN deliverables d ON d.id = prl.deliverable_id
    JOIN projects p ON p.id = d.project_id
    WHERE prl.id = public_review_comments.review_link_id
    AND (
      (has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), p.agency_id))
      OR is_project_editor(auth.uid(), p.id)
    )
  )
);

-- Add is_resolved and resolved columns to public_review_comments
ALTER TABLE public.public_review_comments
ADD COLUMN IF NOT EXISTS is_resolved boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS resolved_by uuid DEFAULT NULL,
ADD COLUMN IF NOT EXISTS resolved_at timestamptz DEFAULT NULL;

-- >>> 20260307044320_cf40cd22-04e5-47b1-be14-0249a5f4a2cc.sql


ALTER TABLE public.deliverable_comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.deliverable_comments(id) ON DELETE CASCADE DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_deliverable_comments_parent_id ON public.deliverable_comments(parent_id);

-- >>> 20260307050751_6dc78227-293f-47ee-8024-4cd8ae3b93e5.sql

-- 1. Update is_super_admin to support both emails
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND email IN ('hello@fahadkamran.com', 'm.fahadkamran0001@gmail.com')
  );
$$;

-- 2. Create agency_restrictions table for warnings/timeouts
CREATE TABLE IF NOT EXISTS public.agency_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  restriction_type text NOT NULL,
  message text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agency_restrictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin can manage restrictions" ON public.agency_restrictions;
CREATE POLICY "Super admin can manage restrictions" ON public.agency_restrictions
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Agency members can view their restrictions" ON public.agency_restrictions;
CREATE POLICY "Agency members can view their restrictions" ON public.agency_restrictions
FOR SELECT
TO authenticated
USING (user_belongs_to_agency(auth.uid(), agency_id) AND is_active = true);

-- 3. Create marketing_emails_log table
CREATE TABLE IF NOT EXISTS public.marketing_emails_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_type text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.marketing_emails_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin can view marketing email logs" ON public.marketing_emails_log;
CREATE POLICY "Super admin can view marketing email logs" ON public.marketing_emails_log
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- >>> 20260310145556_8c93d9e2-e663-4973-be31-a86d3590a26d.sql


-- Create daily_logs table (unified attendance + task logs)
CREATE TABLE IF NOT EXISTS public.daily_logs (
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
CREATE TABLE IF NOT EXISTS public.leave_requests (
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
DROP POLICY IF EXISTS "Editors can insert their own daily logs" ON public.daily_logs;
CREATE POLICY "Editors can insert their own daily logs" ON public.daily_logs FOR INSERT TO authenticated
WITH CHECK (editor_id = auth.uid());

DROP POLICY IF EXISTS "Editors can update their own daily logs" ON public.daily_logs;
CREATE POLICY "Editors can update their own daily logs" ON public.daily_logs FOR UPDATE TO authenticated
USING (editor_id = auth.uid())
WITH CHECK (editor_id = auth.uid());

DROP POLICY IF EXISTS "Editors can view their own daily logs" ON public.daily_logs;
CREATE POLICY "Editors can view their own daily logs" ON public.daily_logs FOR SELECT TO authenticated
USING (editor_id = auth.uid());

-- daily_logs RLS: Admins can view all in their agency
DROP POLICY IF EXISTS "Admins can view agency daily logs" ON public.daily_logs;
CREATE POLICY "Admins can view agency daily logs" ON public.daily_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), agency_id));

-- leave_requests RLS: Editors can insert/select their own
DROP POLICY IF EXISTS "Editors can insert their own leave requests" ON public.leave_requests;
CREATE POLICY "Editors can insert their own leave requests" ON public.leave_requests FOR INSERT TO authenticated
WITH CHECK (editor_id = auth.uid());

DROP POLICY IF EXISTS "Editors can view their own leave requests" ON public.leave_requests;
CREATE POLICY "Editors can view their own leave requests" ON public.leave_requests FOR SELECT TO authenticated
USING (editor_id = auth.uid());

-- leave_requests RLS: Admins can view and update in their agency
DROP POLICY IF EXISTS "Admins can view agency leave requests" ON public.leave_requests;
CREATE POLICY "Admins can view agency leave requests" ON public.leave_requests FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Admins can update agency leave requests" ON public.leave_requests;
CREATE POLICY "Admins can update agency leave requests" ON public.leave_requests FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') AND user_belongs_to_agency(auth.uid(), agency_id));

-- >>> 20260310170522_6ab4979c-ca94-459d-8df8-6a219e8c6f15.sql


CREATE TABLE IF NOT EXISTS public.agency_work_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  working_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  late_threshold_hour integer NOT NULL DEFAULT 10,
  late_threshold_minute integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(agency_id)
);

-- RLS
ALTER TABLE public.agency_work_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage their agency work schedule" ON public.agency_work_schedule;
CREATE POLICY "Admins can manage their agency work schedule" ON public.agency_work_schedule
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_agency(auth.uid(), agency_id))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Agency members can view work schedule" ON public.agency_work_schedule;
CREATE POLICY "Agency members can view work schedule" ON public.agency_work_schedule
FOR SELECT
TO authenticated
USING (user_belongs_to_agency(auth.uid(), agency_id));

-- Updated at trigger
DROP TRIGGER IF EXISTS update_agency_work_schedule_updated_at ON public.agency_work_schedule;
CREATE TRIGGER update_agency_work_schedule_updated_at
  BEFORE UPDATE ON public.agency_work_schedule
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- >>> 20260310172941_482533be-ce03-4201-b95c-bdf19d183d71.sql

ALTER TABLE public.agency_work_schedule ADD COLUMN IF NOT EXISTS auto_monthly_report boolean NOT NULL DEFAULT false;

-- >>> 20260403153352_ce8a12ce-c51f-4572-85a6-b6ce80ad761b.sql

-- [migration-export] enum value folded into CREATE TYPE above: ALTER TYPE public.project_status ADD VALUE 'quality_check' BEFORE 'done';

-- >>> 20260403153415_716c4392-c07f-4272-8c76-178ab01c89e8.sql


-- Add columns
ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Update RLS: split the old SELECT policy into role-specific ones
DROP POLICY IF EXISTS "Users can view deliverables on their projects" ON public.deliverables;

DROP POLICY IF EXISTS "Admins and editors can view all deliverables" ON public.deliverables;
CREATE POLICY "Admins and editors can view all deliverables" ON public.deliverables FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = deliverables.project_id
    AND (
      (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_agency(auth.uid(), p.agency_id))
      OR EXISTS (SELECT 1 FROM project_editors pe WHERE pe.project_id = p.id AND pe.editor_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Clients can view deliverables except quality_check" ON public.deliverables;
CREATE POLICY "Clients can view deliverables except quality_check" ON public.deliverables FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = deliverables.project_id
    AND p.client_id = auth.uid()
    AND p.status != 'quality_check'
  )
);

-- Admin UPDATE policy for lock/unlock
DROP POLICY IF EXISTS "Admins can update deliverables" ON public.deliverables;
CREATE POLICY "Admins can update deliverables" ON public.deliverables FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = deliverables.project_id
    AND has_role(auth.uid(), 'admin'::app_role)
    AND user_belongs_to_agency(auth.uid(), p.agency_id)
  )
);

-- Admin DELETE policy
DROP POLICY IF EXISTS "Admins can delete deliverables" ON public.deliverables;
CREATE POLICY "Admins can delete deliverables" ON public.deliverables FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = deliverables.project_id
    AND has_role(auth.uid(), 'admin'::app_role)
    AND user_belongs_to_agency(auth.uid(), p.agency_id)
  )
);

-- Auto-unlock trigger
CREATE OR REPLACE FUNCTION public.auto_unlock_deliverables_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.status != 'paid' AND NEW.status = 'paid' THEN
    UPDATE public.deliverables
    SET is_locked = false
    WHERE linked_invoice_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_unlock_on_payment ON public.invoices;
CREATE TRIGGER trg_auto_unlock_on_payment
AFTER UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.auto_unlock_deliverables_on_payment();

-- >>> 20260404181216_472cb630-645a-441f-8dc1-1c86d8759c49.sql


CREATE OR REPLACE FUNCTION public.auto_move_to_quality_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only for deliverable file types (not assets)
  IF NEW.file_type = 'deliverable' THEN
    UPDATE public.projects
    SET status = 'quality_check', updated_at = now()
    WHERE id = NEW.project_id
      AND status IN ('in_progress', 'review');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_move_to_quality_check ON public.deliverables;
CREATE TRIGGER trg_auto_move_to_quality_check
AFTER INSERT ON public.deliverables
FOR EACH ROW
EXECUTE FUNCTION public.auto_move_to_quality_check();

-- >>> 20260503125345_5755ac2c-e7d1-4143-ba19-ae7e1f70e98f.sql

CREATE TABLE IF NOT EXISTS public.subscription_cancellation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reason_code TEXT NOT NULL,
  reason_label TEXT NOT NULL,
  detail TEXT,
  subscription_ends_at TIMESTAMPTZ,
  plan_tier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_cancellation_logs_agency ON public.subscription_cancellation_logs(agency_id, created_at DESC);

ALTER TABLE public.subscription_cancellation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view their agency cancellation logs" ON public.subscription_cancellation_logs;
CREATE POLICY "Admins can view their agency cancellation logs" ON public.subscription_cancellation_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND agency_id = get_user_agency_id(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert cancellation logs for their agency" ON public.subscription_cancellation_logs;
CREATE POLICY "Admins can insert cancellation logs for their agency" ON public.subscription_cancellation_logs
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND agency_id = get_user_agency_id(auth.uid())
  AND user_id = auth.uid()
);

DROP POLICY IF EXISTS "Super admin can view all cancellation logs" ON public.subscription_cancellation_logs;
CREATE POLICY "Super admin can view all cancellation logs" ON public.subscription_cancellation_logs
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- >>> 20260505114342_b1c41ea7-87af-4175-8270-6016440b8beb.sql


CREATE TABLE IF NOT EXISTS public.lead_magnet_subscribers (
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

CREATE INDEX IF NOT EXISTS idx_lead_magnet_email ON public.lead_magnet_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_lead_magnet_unsub_token ON public.lead_magnet_subscribers(unsubscribe_token);

ALTER TABLE public.lead_magnet_subscribers ENABLE ROW LEVEL SECURITY;

-- No public access: all access goes through edge functions w/ service role.
-- Allow super-admins (by email) to read via authenticated session.
DROP POLICY IF EXISTS "Super admins can read leads" ON public.lead_magnet_subscribers;
CREATE POLICY "Super admins can read leads" ON public.lead_magnet_subscribers
FOR SELECT
TO authenticated
USING (
  (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('hello@fahadkamran.com','m.fahadkamran0001@gmail.com')
);

-- >>> 20260505120615_3c4ee111-01d5-470b-b503-594922e2099b.sql

insert into storage.buckets (id, name, public) values ('lead-magnet-assets', 'lead-magnet-assets', true) on conflict (id) do update set public = true;

drop policy if exists "Public read lead magnet assets" on storage.objects;
DROP POLICY IF EXISTS "Public read lead magnet assets" ON storage.objects;
CREATE POLICY "Public read lead magnet assets" ON storage.objects for select
using (bucket_id = 'lead-magnet-assets');

-- >>> 20260505121126_f842e0a7-8a4e-4858-9fc9-2c9aa5c18e7d.sql

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
DROP POLICY IF EXISTS "Super admins read lead magnet events" ON public.lead_magnet_email_events;
CREATE POLICY "Super admins read lead magnet events" ON public.lead_magnet_email_events
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- >>> 20260505140935_3587d190-4648-4bce-87e9-5ee3211d3fe6.sql

DROP POLICY IF EXISTS "Super admins can read leads" ON public.lead_magnet_subscribers;

DROP POLICY IF EXISTS "Super admins can read leads" ON public.lead_magnet_subscribers;
CREATE POLICY "Super admins can read leads" ON public.lead_magnet_subscribers
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- >>> 20260512191648_4b5f8b87-60bb-4733-9b3e-5fb2ada5e6bf.sql


-- Permission enum for share links
DO $$ BEGIN
  DO $do$ BEGIN
  CREATE TYPE public.drive_share_permission AS ENUM ('view', 'download', 'upload', 'full', 'edit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  DO $do$ BEGIN
  CREATE TYPE public.drive_folder_kind AS ENUM ('custom', 'project_root', 'client_root', 'container_root');
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ drive_folders ============
CREATE TABLE IF NOT EXISTS public.drive_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL,
  parent_id UUID REFERENCES public.drive_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.drive_folder_kind NOT NULL DEFAULT 'custom',
  project_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drive_folders_agency ON public.drive_folders(agency_id);
CREATE INDEX IF NOT EXISTS idx_drive_folders_parent ON public.drive_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_drive_folders_project ON public.drive_folders(project_id);

ALTER TABLE public.drive_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency members view folders" ON public.drive_folders;
CREATE POLICY "Agency members view folders" ON public.drive_folders FOR SELECT TO authenticated
  USING (user_belongs_to_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Admins manage folders" ON public.drive_folders;
CREATE POLICY "Admins manage folders" ON public.drive_folders FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_agency(auth.uid(), agency_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Members create custom folders" ON public.drive_folders;
CREATE POLICY "Members create custom folders" ON public.drive_folders FOR INSERT TO authenticated
  WITH CHECK (
    user_belongs_to_agency(auth.uid(), agency_id)
    AND created_by = auth.uid()
    AND kind = 'custom'
  );

DROP POLICY IF EXISTS "Members update own folders" ON public.drive_folders;
CREATE POLICY "Members update own folders" ON public.drive_folders FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND kind = 'custom')
  WITH CHECK (created_by = auth.uid() AND kind = 'custom');

DROP POLICY IF EXISTS "Members delete own folders" ON public.drive_folders;
CREATE POLICY "Members delete own folders" ON public.drive_folders FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND kind = 'custom');

-- ============ drive_files ============
CREATE TABLE IF NOT EXISTS public.drive_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL,
  folder_id UUID REFERENCES public.drive_folders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  uploaded_by UUID,
  uploader_label TEXT,
  source TEXT NOT NULL DEFAULT 'user',
  share_link_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drive_files_agency ON public.drive_files(agency_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_folder ON public.drive_files(folder_id);

ALTER TABLE public.drive_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency members view drive files" ON public.drive_files;
CREATE POLICY "Agency members view drive files" ON public.drive_files FOR SELECT TO authenticated
  USING (user_belongs_to_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Admins manage drive files" ON public.drive_files;
CREATE POLICY "Admins manage drive files" ON public.drive_files FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_agency(auth.uid(), agency_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Members upload drive files" ON public.drive_files;
CREATE POLICY "Members upload drive files" ON public.drive_files FOR INSERT TO authenticated
  WITH CHECK (
    user_belongs_to_agency(auth.uid(), agency_id)
    AND uploaded_by = auth.uid()
  );

DROP POLICY IF EXISTS "Members delete own drive files" ON public.drive_files;
CREATE POLICY "Members delete own drive files" ON public.drive_files FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "Members rename own drive files" ON public.drive_files;
CREATE POLICY "Members rename own drive files" ON public.drive_files FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

-- ============ drive_share_links ============
CREATE TABLE IF NOT EXISTS public.drive_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL,
  folder_id UUID NOT NULL REFERENCES public.drive_folders(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  permission public.drive_share_permission NOT NULL DEFAULT 'download',
  password_hash TEXT,
  expires_at TIMESTAMPTZ,
  max_upload_bytes BIGINT,
  max_files INTEGER,
  used_bytes BIGINT NOT NULL DEFAULT 0,
  used_files INTEGER NOT NULL DEFAULT 0,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drive_share_links_token ON public.drive_share_links(token);
CREATE INDEX IF NOT EXISTS idx_drive_share_links_agency ON public.drive_share_links(agency_id);

ALTER TABLE public.drive_share_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage share links" ON public.drive_share_links;
CREATE POLICY "Admins manage share links" ON public.drive_share_links FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_agency(auth.uid(), agency_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Creators view own share links" ON public.drive_share_links;
CREATE POLICY "Creators view own share links" ON public.drive_share_links FOR SELECT TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Members create share links" ON public.drive_share_links;
CREATE POLICY "Members create share links" ON public.drive_share_links FOR INSERT TO authenticated
  WITH CHECK (
    user_belongs_to_agency(auth.uid(), agency_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Creators revoke own share links" ON public.drive_share_links;
CREATE POLICY "Creators revoke own share links" ON public.drive_share_links FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- ============ drive_share_uploads (audit) ============
CREATE TABLE IF NOT EXISTS public.drive_share_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID NOT NULL REFERENCES public.drive_share_links(id) ON DELETE CASCADE,
  file_id UUID REFERENCES public.drive_files(id) ON DELETE SET NULL,
  uploader_name TEXT,
  uploader_email TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drive_share_uploads_link ON public.drive_share_uploads(share_link_id);

ALTER TABLE public.drive_share_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read share upload audit" ON public.drive_share_uploads;
CREATE POLICY "Admins read share upload audit" ON public.drive_share_uploads FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.drive_share_links sl
    WHERE sl.id = drive_share_uploads.share_link_id
      AND has_role(auth.uid(), 'admin'::app_role)
      AND user_belongs_to_agency(auth.uid(), sl.agency_id)
  ));

-- ============ Updated_at trigger ============
DROP TRIGGER IF EXISTS trg_drive_folders_updated ON public.drive_folders;
DROP TRIGGER IF EXISTS trg_drive_folders_updated ON public.drive_folders;
CREATE TRIGGER trg_drive_folders_updated
  BEFORE UPDATE ON public.drive_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Storage accounting trigger for drive_files ============
CREATE OR REPLACE FUNCTION public.update_agency_storage_drive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.agencies
    SET storage_used_bytes = storage_used_bytes + COALESCE(NEW.file_size, 0)
    WHERE id = NEW.agency_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.agencies
    SET storage_used_bytes = GREATEST(0, storage_used_bytes - COALESCE(OLD.file_size, 0))
    WHERE id = OLD.agency_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_drive_files_storage ON public.drive_files;
DROP TRIGGER IF EXISTS trg_drive_files_storage ON public.drive_files;
CREATE TRIGGER trg_drive_files_storage
  AFTER INSERT OR DELETE ON public.drive_files
  FOR EACH ROW EXECUTE FUNCTION public.update_agency_storage_drive();

-- >>> 20260513052040_e524c910-53e4-4fbf-b1c4-71da565a676c.sql

ALTER TABLE public.drive_share_links
  ALTER COLUMN folder_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES public.drive_files(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_drive_share_links_file ON public.drive_share_links(file_id);

ALTER TABLE public.drive_share_links
  DROP CONSTRAINT IF EXISTS drive_share_links_target_chk;

ALTER TABLE public.drive_share_links
  ADD CONSTRAINT drive_share_links_target_chk
  CHECK ((folder_id IS NOT NULL AND file_id IS NULL) OR (folder_id IS NULL AND file_id IS NOT NULL));

-- >>> 20260513054302_3083c5b5-1d64-4d62-8b97-2b36df29544b.sql


-- 1. Soft-delete columns
ALTER TABLE public.drive_files
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.drive_folders
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

CREATE INDEX IF NOT EXISTS idx_drive_files_deleted_at ON public.drive_files(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drive_folders_deleted_at ON public.drive_folders(deleted_at) WHERE deleted_at IS NOT NULL;

-- 2. Tighten "view" RLS so trashed items only show to uploader/creator or admin
-- drive_files
DROP POLICY IF EXISTS "Agency members view drive files" ON public.drive_files;
DROP POLICY IF EXISTS "Agency members view drive files" ON public.drive_files;
CREATE POLICY "Agency members view drive files" ON public.drive_files
FOR SELECT
TO authenticated
USING (
  user_belongs_to_agency(auth.uid(), agency_id)
  AND (
    deleted_at IS NULL
    OR uploaded_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- drive_folders
DROP POLICY IF EXISTS "Agency members view folders" ON public.drive_folders;
DROP POLICY IF EXISTS "Agency members view folders" ON public.drive_folders;
CREATE POLICY "Agency members view folders" ON public.drive_folders
FOR SELECT
TO authenticated
USING (
  user_belongs_to_agency(auth.uid(), agency_id)
  AND (
    deleted_at IS NULL
    OR created_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- >>> 20260513060608_0084dade-fa0f-40a7-852c-fcb303c12b87.sql

-- [migration-export] enum value folded into CREATE TYPE above: ALTER TYPE drive_folder_kind ADD VALUE IF NOT EXISTS 'client_root';
ALTER TABLE public.drive_folders ADD COLUMN IF NOT EXISTS client_id uuid;
CREATE INDEX IF NOT EXISTS idx_drive_folders_client_id ON public.drive_folders(client_id);

-- >>> 20260513061056_082433b3-4cf1-4bfa-aaf0-126611561c30.sql

-- [migration-export] enum value folded into CREATE TYPE above: ALTER TYPE drive_folder_kind ADD VALUE IF NOT EXISTS 'container_root';
ALTER TABLE public.drive_folders ADD COLUMN IF NOT EXISTS container_id uuid;
CREATE INDEX IF NOT EXISTS idx_drive_folders_container_id ON public.drive_folders(container_id);

-- >>> 20260513062341_e1fb510c-d3fb-48d8-9aab-5432c4b59c8c.sql

-- Add 'edit' to drive_share_permission enum
-- [migration-export] enum value folded into CREATE TYPE above: ALTER TYPE public.drive_share_permission ADD VALUE IF NOT EXISTS 'edit';

-- Track which share link created a folder (for share-link recipients to manage their own items)
ALTER TABLE public.drive_folders ADD COLUMN IF NOT EXISTS share_link_id UUID;
CREATE INDEX IF NOT EXISTS idx_drive_folders_share_link_id ON public.drive_folders(share_link_id);

-- >>> 20260606182636_47407602-340d-4d36-8f9c-e2e35f60b22e.sql

REVOKE EXECUTE ON FUNCTION public.get_admin_agency_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_agency_stats() TO service_role;

-- [migration-export] table created outside this project's migrations; ensure it exists
CREATE TABLE IF NOT EXISTS public.tool_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  email TEXT NOT NULL,
  tool_used TEXT NOT NULL,
  input_data JSONB
);
GRANT INSERT ON public.tool_leads TO anon, authenticated;
GRANT ALL ON public.tool_leads TO service_role;
ALTER TABLE public.tool_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert" ON public.tool_leads;
CREATE POLICY "Allow public insert" ON public.tool_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
DROP POLICY IF EXISTS "Service role manages tool leads" ON public.tool_leads;
CREATE POLICY "Service role manages tool leads" ON public.tool_leads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- >>> 20260609065123_17df893d-608d-44d5-b696-790809bedc0b.sql


-- 1. Managed clients table
CREATE TABLE IF NOT EXISTS public.managed_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  company TEXT,
  phone TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  invitation_id UUID REFERENCES public.agency_invitations(id) ON DELETE SET NULL,
  activated_at TIMESTAMPTZ,
  converted_profile_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS managed_clients_agency_email_uniq
  ON public.managed_clients (agency_id, lower(email))
  WHERE converted_profile_id IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.managed_clients TO authenticated;
GRANT ALL ON public.managed_clients TO service_role;

ALTER TABLE public.managed_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage their agency's managed clients" ON public.managed_clients;
CREATE POLICY "Admins manage their agency's managed clients" ON public.managed_clients
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND agency_id = get_user_agency_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND agency_id = get_user_agency_id(auth.uid()));

DROP TRIGGER IF EXISTS update_managed_clients_updated_at ON public.managed_clients;
CREATE TRIGGER update_managed_clients_updated_at
  BEFORE UPDATE ON public.managed_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Optional managed_client_id on projects and invoices
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS managed_client_id UUID REFERENCES public.managed_clients(id) ON DELETE SET NULL;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS managed_client_id UUID REFERENCES public.managed_clients(id) ON DELETE SET NULL;

-- Allow invoices to have either a real client OR a managed client (relax NOT NULL)
ALTER TABLE public.invoices ALTER COLUMN client_id DROP NOT NULL;

-- 3. RPC for admins to activate a managed client (creates invitation)
CREATE OR REPLACE FUNCTION public.activate_managed_client(_managed_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mc RECORD;
  _agency_id UUID;
  _invite_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _mc FROM public.managed_clients WHERE id = _managed_id;
  IF _mc IS NULL THEN
    RAISE EXCEPTION 'Managed client not found';
  END IF;

  _agency_id := get_user_agency_id(auth.uid());
  IF NOT has_role(auth.uid(), 'admin'::app_role) OR _mc.agency_id <> _agency_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _mc.activated_at IS NOT NULL THEN
    RAISE EXCEPTION 'Client already activated';
  END IF;

  -- Reuse pending invitation if already created
  IF _mc.invitation_id IS NOT NULL THEN
    RETURN _mc.invitation_id;
  END IF;

  INSERT INTO public.agency_invitations (agency_id, email, full_name, role, invited_by)
  VALUES (_mc.agency_id, lower(_mc.email), _mc.full_name, 'client'::app_role, auth.uid())
  RETURNING id INTO _invite_id;

  UPDATE public.managed_clients
  SET invitation_id = _invite_id, updated_at = now()
  WHERE id = _managed_id;

  RETURN _invite_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activate_managed_client(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_managed_client(UUID) TO authenticated;

-- 4. Extend accept_agency_invitation to migrate managed-client work
CREATE OR REPLACE FUNCTION public.accept_agency_invitation(_token uuid)
 RETURNS TABLE(out_agency_id uuid, out_role app_role)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv RECORD;
  jwt_email TEXT;
  _mc_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  jwt_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF jwt_email = '' THEN
    RAISE EXCEPTION 'Email missing from session';
  END IF;

  SELECT * INTO inv
  FROM public.agency_invitations i
  WHERE i.id = _token
  LIMIT 1;

  IF inv IS NULL THEN
    RAISE EXCEPTION 'Invalid invitation';
  END IF;

  IF inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation already used';
  END IF;

  IF lower(inv.email) <> jwt_email THEN
    RAISE EXCEPTION 'This invitation is for a different email address';
  END IF;

  -- Ensure profile exists and is linked to this agency
  INSERT INTO public.profiles (id, email, full_name, agency_id, onboarding_completed)
  VALUES (auth.uid(), jwt_email, inv.full_name, inv.agency_id, false)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        agency_id = EXCLUDED.agency_id,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  -- Assign role for this agency
  INSERT INTO public.user_roles (user_id, agency_id, role)
  VALUES (auth.uid(), inv.agency_id, inv.role)
  ON CONFLICT (user_id, agency_id) DO UPDATE
    SET role = EXCLUDED.role;

  -- Mark invitation accepted
  UPDATE public.agency_invitations
  SET accepted_at = now(),
      accepted_by = auth.uid()
  WHERE id = inv.id;

  -- If this invitation came from a managed_client, migrate work to the new auth user
  SELECT id INTO _mc_id FROM public.managed_clients WHERE invitation_id = inv.id;
  IF _mc_id IS NOT NULL THEN
    UPDATE public.projects
      SET client_id = auth.uid(), managed_client_id = NULL
      WHERE managed_client_id = _mc_id;

    UPDATE public.invoices
      SET client_id = auth.uid(), managed_client_id = NULL
      WHERE managed_client_id = _mc_id;

    UPDATE public.managed_clients
      SET activated_at = now(),
          converted_profile_id = auth.uid(),
          updated_at = now()
      WHERE id = _mc_id;
  END IF;

  out_agency_id := inv.agency_id;
  out_role := inv.role;
  RETURN NEXT;
END;
$function$;

-- >>> 20260609070001_fcb100a9-f66d-4eb5-bdaa-7c507e5fb1a7.sql


-- Allow project_containers to belong to a managed client
ALTER TABLE public.project_containers
  ALTER COLUMN client_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS managed_client_id uuid REFERENCES public.managed_clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_containers_managed_client_id
  ON public.project_containers(managed_client_id);

-- Exactly one of client_id / managed_client_id must be set
ALTER TABLE public.project_containers
  DROP CONSTRAINT IF EXISTS project_containers_client_xor_chk;
ALTER TABLE public.project_containers
  ADD CONSTRAINT project_containers_client_xor_chk
  CHECK ((client_id IS NOT NULL)::int + (managed_client_id IS NOT NULL)::int = 1);

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_client_xor_chk;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_client_xor_chk
  CHECK (
    client_id IS NOT NULL
    OR managed_client_id IS NOT NULL
    OR status = 'proposal'
  );

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_client_xor_chk;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_client_xor_chk
  CHECK ((client_id IS NOT NULL)::int + (managed_client_id IS NOT NULL)::int = 1);

-- Extend accept_agency_invitation to also migrate project_containers
CREATE OR REPLACE FUNCTION public.accept_agency_invitation(_token uuid)
 RETURNS TABLE(out_agency_id uuid, out_role app_role)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv RECORD;
  jwt_email TEXT;
  _mc_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  jwt_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF jwt_email = '' THEN
    RAISE EXCEPTION 'Email missing from session';
  END IF;

  SELECT * INTO inv
  FROM public.agency_invitations i
  WHERE i.id = _token
  LIMIT 1;

  IF inv IS NULL THEN
    RAISE EXCEPTION 'Invalid invitation';
  END IF;

  IF inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation already used';
  END IF;

  IF lower(inv.email) <> jwt_email THEN
    RAISE EXCEPTION 'This invitation is for a different email address';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, agency_id, onboarding_completed)
  VALUES (auth.uid(), jwt_email, inv.full_name, inv.agency_id, false)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        agency_id = EXCLUDED.agency_id,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  INSERT INTO public.user_roles (user_id, agency_id, role)
  VALUES (auth.uid(), inv.agency_id, inv.role)
  ON CONFLICT (user_id, agency_id) DO UPDATE
    SET role = EXCLUDED.role;

  UPDATE public.agency_invitations
  SET accepted_at = now(),
      accepted_by = auth.uid()
  WHERE id = inv.id;

  SELECT id INTO _mc_id FROM public.managed_clients WHERE invitation_id = inv.id;
  IF _mc_id IS NOT NULL THEN
    UPDATE public.project_containers
      SET client_id = auth.uid(), managed_client_id = NULL
      WHERE managed_client_id = _mc_id;

    UPDATE public.projects
      SET client_id = auth.uid(), managed_client_id = NULL
      WHERE managed_client_id = _mc_id;

    UPDATE public.invoices
      SET client_id = auth.uid(), managed_client_id = NULL
      WHERE managed_client_id = _mc_id;

    UPDATE public.managed_clients
      SET activated_at = now(),
          converted_profile_id = auth.uid(),
          updated_at = now()
      WHERE id = _mc_id;
  END IF;

  out_agency_id := inv.agency_id;
  out_role := inv.role;
  RETURN NEXT;
END;
$function$;

-- >>> 20260609070206_1ec31090-6915-416c-b440-c301130a3718.sql


CREATE OR REPLACE FUNCTION public.notify_invoice_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _project RECORD;
  _admin RECORD;
BEGIN
  SELECT * INTO _project FROM projects WHERE id = NEW.project_id;

  IF TG_OP = 'INSERT' AND NEW.client_id IS NOT NULL THEN
    PERFORM create_notification(
      NEW.client_id,
      NEW.agency_id,
      'invoice_sent',
      'New Invoice',
      'You have received a new invoice for $' || NEW.amount::TEXT || ' for project: ' || _project.title,
      '/client/invoices',
      jsonb_build_object('invoice_id', NEW.id, 'amount', NEW.amount)
    );
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status != 'paid' AND NEW.status = 'paid' THEN
    FOR _admin IN
      SELECT user_id FROM user_roles WHERE agency_id = NEW.agency_id AND role = 'admin'
    LOOP
      PERFORM create_notification(
        _admin.user_id,
        NEW.agency_id,
        'invoice_paid',
        'Invoice Paid',
        'Invoice for $' || NEW.amount::TEXT || ' has been marked as paid',
        '/admin/invoices',
        jsonb_build_object('invoice_id', NEW.id, 'amount', NEW.amount, 'client_id', NEW.client_id)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- >>> 20260609071345_826300cb-fd2d-4ed0-9956-dcdbf5ed690b.sql


-- 1. Extend app_role enum with 'staff'
-- [migration-export] enum value folded into CREATE TYPE above: ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';

-- 2. staff_roles: reusable permission templates per agency
CREATE TABLE IF NOT EXISTS public.staff_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  scope_clients TEXT NOT NULL DEFAULT 'all' CHECK (scope_clients IN ('all','assigned')),
  scope_projects TEXT NOT NULL DEFAULT 'all' CHECK (scope_projects IN ('all','assigned')),
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agency_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_roles TO authenticated;
GRANT ALL ON public.staff_roles TO service_role;
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency members can view staff roles" ON public.staff_roles;
CREATE POLICY "Agency members can view staff roles" ON public.staff_roles FOR SELECT TO authenticated
  USING (public.user_belongs_to_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Admins manage staff roles" ON public.staff_roles;
CREATE POLICY "Admins manage staff roles" ON public.staff_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id));

DROP TRIGGER IF EXISTS staff_roles_updated_at ON public.staff_roles;
CREATE TRIGGER staff_roles_updated_at
  BEFORE UPDATE ON public.staff_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. staff_members: links a user to a role template with overrides
CREATE TABLE IF NOT EXISTS public.staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  staff_role_id UUID REFERENCES public.staff_roles(id) ON DELETE SET NULL,
  permission_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, agency_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_members TO authenticated;
GRANT ALL ON public.staff_members TO service_role;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view own record" ON public.staff_members;
CREATE POLICY "Staff can view own record" ON public.staff_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view all staff members" ON public.staff_members;
CREATE POLICY "Admins view all staff members" ON public.staff_members FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Admins manage staff members" ON public.staff_members;
CREATE POLICY "Admins manage staff members" ON public.staff_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id));

DROP TRIGGER IF EXISTS staff_members_updated_at ON public.staff_members;
CREATE TRIGGER staff_members_updated_at
  BEFORE UPDATE ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. staff_client_assignments
CREATE TABLE IF NOT EXISTS public.staff_client_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_user_id UUID,
  managed_client_id UUID REFERENCES public.managed_clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((client_user_id IS NOT NULL AND managed_client_id IS NULL) OR (client_user_id IS NULL AND managed_client_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS staff_client_assignments_real_uniq
  ON public.staff_client_assignments (staff_user_id, client_user_id)
  WHERE client_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS staff_client_assignments_managed_uniq
  ON public.staff_client_assignments (staff_user_id, managed_client_id)
  WHERE managed_client_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_client_assignments TO authenticated;
GRANT ALL ON public.staff_client_assignments TO service_role;
ALTER TABLE public.staff_client_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view own client assignments" ON public.staff_client_assignments;
CREATE POLICY "Staff view own client assignments" ON public.staff_client_assignments FOR SELECT TO authenticated
  USING (staff_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage staff client assignments" ON public.staff_client_assignments;
CREATE POLICY "Admins manage staff client assignments" ON public.staff_client_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id));

-- 5. staff_project_assignments
CREATE TABLE IF NOT EXISTS public.staff_project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_user_id, project_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_project_assignments TO authenticated;
GRANT ALL ON public.staff_project_assignments TO service_role;
ALTER TABLE public.staff_project_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view own project assignments" ON public.staff_project_assignments;
CREATE POLICY "Staff view own project assignments" ON public.staff_project_assignments FOR SELECT TO authenticated
  USING (staff_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage staff project assignments" ON public.staff_project_assignments;
CREATE POLICY "Admins manage staff project assignments" ON public.staff_project_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id));

-- 6. Helper functions
CREATE OR REPLACE FUNCTION public.get_staff_permissions(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sm RECORD;
  _role RECORD;
  _result JSONB;
BEGIN
  SELECT * INTO _sm FROM public.staff_members WHERE user_id = _user_id LIMIT 1;
  IF _sm IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT * INTO _role FROM public.staff_roles WHERE id = _sm.staff_role_id;

  _result := COALESCE(_role.permissions, '{}'::jsonb) || COALESCE(_sm.permission_overrides, '{}'::jsonb);
  _result := _result
    || jsonb_build_object('__scope_clients', COALESCE(_role.scope_clients, 'all'))
    || jsonb_build_object('__scope_projects', COALESCE(_role.scope_projects, 'all'))
    || jsonb_build_object('__agency_id', _sm.agency_id);
  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_has_permission(_user_id UUID, _key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((public.get_staff_permissions(_user_id) ->> _key)::boolean, false);
$$;

CREATE OR REPLACE FUNCTION public.staff_client_visible(_staff_user_id UUID, _client_user_id UUID, _managed_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((public.get_staff_permissions(_staff_user_id) ->> '__scope_clients'), 'all') = 'all'
    OR EXISTS (
      SELECT 1 FROM public.staff_client_assignments
      WHERE staff_user_id = _staff_user_id
        AND (
          (_client_user_id IS NOT NULL AND client_user_id = _client_user_id)
          OR (_managed_client_id IS NOT NULL AND managed_client_id = _managed_client_id)
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.staff_project_visible(_staff_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((public.get_staff_permissions(_staff_user_id) ->> '__scope_projects'), 'all') = 'all'
    OR EXISTS (
      SELECT 1 FROM public.staff_project_assignments
      WHERE staff_user_id = _staff_user_id AND project_id = _project_id
    );
$$;

-- 7. Seed system role templates for existing agencies
INSERT INTO public.staff_roles (agency_id, name, description, permissions, scope_clients, scope_projects, is_system)
SELECT a.id, 'Manager', 'Manages clients, projects, and team',
  jsonb_build_object(
    'clients.view', true, 'clients.create', true, 'clients.invite', true, 'clients.edit', true,
    'projects.view', true, 'projects.create', true, 'projects.edit', true, 'projects.assign_editor', true, 'projects.change_status', true,
    'team.view', true,
    'messaging.dm_clients', true, 'messaging.dm_team', true, 'messaging.project_channels', true,
    'storage.view', true, 'storage.upload', true
  ),
  'all', 'all', true
FROM public.agencies a
ON CONFLICT (agency_id, name) DO NOTHING;

INSERT INTO public.staff_roles (agency_id, name, description, permissions, scope_clients, scope_projects, is_system)
SELECT a.id, 'Accountant', 'Manages invoices, payments, and payroll',
  jsonb_build_object(
    'clients.view', true,
    'invoices.view', true, 'invoices.create', true, 'invoices.send', true, 'invoices.mark_paid', true,
    'payments.view_methods', true, 'payments.manage_methods', true,
    'payroll.view', true, 'payroll.pay', true, 'payroll.bonuses', true, 'payroll.balances', true,
    'messaging.dm_team', true
  ),
  'all', 'all', true
FROM public.agencies a
ON CONFLICT (agency_id, name) DO NOTHING;

INSERT INTO public.staff_roles (agency_id, name, description, permissions, scope_clients, scope_projects, is_system)
SELECT a.id, 'HR Coordinator', 'Manages attendance, leave, and performance',
  jsonb_build_object(
    'team.view', true,
    'attendance.view', true, 'attendance.report', true,
    'leave.view', true, 'leave.approve', true,
    'performance.view', true,
    'messaging.dm_team', true
  ),
  'all', 'all', true
FROM public.agencies a
ON CONFLICT (agency_id, name) DO NOTHING;

-- >>> 20260609071651_72e9fe90-d6ca-4816-a927-63acf0358796.sql


ALTER TABLE public.agency_invitations
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Extend accept_agency_invitation to create staff_members row when role='staff'
CREATE OR REPLACE FUNCTION public.accept_agency_invitation(_token uuid)
 RETURNS TABLE(out_agency_id uuid, out_role app_role)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv RECORD;
  jwt_email TEXT;
  _mc_id UUID;
  _staff_role_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  jwt_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF jwt_email = '' THEN
    RAISE EXCEPTION 'Email missing from session';
  END IF;

  SELECT * INTO inv
  FROM public.agency_invitations i
  WHERE i.id = _token
  LIMIT 1;

  IF inv IS NULL THEN
    RAISE EXCEPTION 'Invalid invitation';
  END IF;

  IF inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation already used';
  END IF;

  IF lower(inv.email) <> jwt_email THEN
    RAISE EXCEPTION 'This invitation is for a different email address';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, agency_id, onboarding_completed)
  VALUES (auth.uid(), jwt_email, inv.full_name, inv.agency_id, false)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        agency_id = EXCLUDED.agency_id,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  INSERT INTO public.user_roles (user_id, agency_id, role)
  VALUES (auth.uid(), inv.agency_id, inv.role)
  ON CONFLICT (user_id, agency_id) DO UPDATE
    SET role = EXCLUDED.role;

  UPDATE public.agency_invitations
  SET accepted_at = now(),
      accepted_by = auth.uid()
  WHERE id = inv.id;

  -- Managed client transfer (existing logic)
  SELECT id INTO _mc_id FROM public.managed_clients WHERE invitation_id = inv.id;
  IF _mc_id IS NOT NULL THEN
    UPDATE public.project_containers
      SET client_id = auth.uid(), managed_client_id = NULL
      WHERE managed_client_id = _mc_id;

    UPDATE public.projects
      SET client_id = auth.uid(), managed_client_id = NULL
      WHERE managed_client_id = _mc_id;

    UPDATE public.invoices
      SET client_id = auth.uid(), managed_client_id = NULL
      WHERE managed_client_id = _mc_id;

    UPDATE public.managed_clients
      SET activated_at = now(),
          converted_profile_id = auth.uid(),
          updated_at = now()
      WHERE id = _mc_id;
  END IF;

  -- Staff member creation
  IF inv.role = 'staff'::app_role THEN
    _staff_role_id := NULLIF(inv.metadata ->> 'staff_role_id', '')::uuid;
    INSERT INTO public.staff_members (user_id, agency_id, staff_role_id, permission_overrides, created_by)
    VALUES (auth.uid(), inv.agency_id, _staff_role_id, COALESCE(inv.metadata -> 'overrides', '{}'::jsonb), inv.invited_by)
    ON CONFLICT (user_id, agency_id) DO UPDATE
      SET staff_role_id = EXCLUDED.staff_role_id,
          permission_overrides = EXCLUDED.permission_overrides,
          updated_at = now();
  END IF;

  out_agency_id := inv.agency_id;
  out_role := inv.role;
  RETURN NEXT;
END;
$function$;

-- >>> 20260609202933_54f4de50-3b67-40b4-9eb4-9edd7a7c2b5c.sql


DROP POLICY IF EXISTS "Public read access to chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own chat attachments" ON storage.objects;

DROP POLICY IF EXISTS "Channel members can read chat attachments" ON storage.objects;
CREATE POLICY "Channel members can read chat attachments" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND public.is_channel_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

DROP POLICY IF EXISTS "Channel members can upload chat attachments" ON storage.objects;
CREATE POLICY "Channel members can upload chat attachments" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND public.is_channel_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

DROP POLICY IF EXISTS "Members can delete own chat attachments" ON storage.objects;
CREATE POLICY "Members can delete own chat attachments" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND owner = auth.uid()
);

-- >>> 20260609204701_2e53640b-5e7e-45de-947f-2e710547c95c.sql

ALTER TABLE public.drive_folders ADD COLUMN IF NOT EXISTS managed_client_id uuid REFERENCES public.managed_clients(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS drive_folders_managed_client_idx ON public.drive_folders(agency_id, managed_client_id) WHERE kind = 'client_root';

-- >>> 20260609212551_f2852c56-4570-4913-913c-cc73a481f067.sql

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS container_id uuid REFERENCES public.project_containers(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ALTER COLUMN project_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_container_id ON public.invoices(container_id);

-- >>> 20260611080802_2d1b1255-4d42-4499-a4d8-0ae12bf0fc56.sql


-- 1. payment_methods: restrict SELECT to admins only
DROP POLICY IF EXISTS "Agency members can view payment methods" ON public.payment_methods;

-- 2. profiles: drop unused salary/bonus columns (data lives in employee_compensation)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS monthly_salary;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS accumulated_bonus;

-- 3. storage: deliverables INSERT must check project's agency matches admin's
DROP POLICY IF EXISTS "Admins can manage deliverable files" ON storage.objects;

DROP POLICY IF EXISTS "Admins can read deliverable files" ON storage.objects;
CREATE POLICY "Admins can read deliverable files" ON storage.objects FOR SELECT
USING (
  bucket_id = 'deliverables'
  AND has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.deliverables d
    JOIN public.projects p ON p.id = d.project_id
    WHERE d.file_url LIKE ('%' || objects.name)
      AND user_belongs_to_agency(auth.uid(), p.agency_id)
  )
);

DROP POLICY IF EXISTS "Admins can insert deliverable files in their agency" ON storage.objects;
CREATE POLICY "Admins can insert deliverable files in their agency" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'deliverables'
  AND has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND user_belongs_to_agency(auth.uid(), p.agency_id)
  )
);

DROP POLICY IF EXISTS "Admins can update deliverable files in their agency" ON storage.objects;
CREATE POLICY "Admins can update deliverable files in their agency" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'deliverables'
  AND has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND user_belongs_to_agency(auth.uid(), p.agency_id)
  )
);

DROP POLICY IF EXISTS "Admins can delete deliverable files in their agency" ON storage.objects;
CREATE POLICY "Admins can delete deliverable files in their agency" ON storage.objects FOR DELETE
USING (
  bucket_id = 'deliverables'
  AND has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND user_belongs_to_agency(auth.uid(), p.agency_id)
  )
);

-- 4. storage: payment_proofs admin SELECT must scope to admin's agency
DROP POLICY IF EXISTS "Admins can view payment proofs" ON storage.objects;

DROP POLICY IF EXISTS "Admins can view payment proofs in their agency" ON storage.objects;
CREATE POLICY "Admins can view payment proofs in their agency" ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment_proofs'
  AND has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur_client
    JOIN public.user_roles ur_admin ON ur_admin.agency_id = ur_client.agency_id
    WHERE ur_client.user_id::text = (storage.foldername(name))[1]
      AND ur_client.role = 'client'::app_role
      AND ur_admin.user_id = auth.uid()
      AND ur_admin.role = 'admin'::app_role
  )
);

-- 5. Public buckets: prevent directory listing while keeping file reads working
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Avatar files are publicly readable" ON storage.objects;
CREATE POLICY "Avatar files are publicly readable" ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] IS NOT NULL);

DROP POLICY IF EXISTS "Public read lead magnet assets" ON storage.objects;
DROP POLICY IF EXISTS "Lead magnet files are publicly readable" ON storage.objects;
CREATE POLICY "Lead magnet files are publicly readable" ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'lead-magnet-assets' AND name IS NOT NULL AND position('/' in name) > 0 OR bucket_id = 'lead-magnet-assets' AND name IS NOT NULL);

-- >>> 20260612133308_bdd97691-4362-41c1-b191-7d3c65379fbb.sql


-- Trigger to ensure clients can only modify payment_proof_url on their invoices
CREATE OR REPLACE FUNCTION public.enforce_client_invoice_update_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce for non-admins editing their own invoice as the client
  IF auth.uid() IS NOT NULL
     AND NEW.client_id = auth.uid()
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    IF NEW.agency_id IS DISTINCT FROM OLD.agency_id
       OR NEW.client_id IS DISTINCT FROM OLD.client_id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.managed_client_id IS DISTINCT FROM OLD.managed_client_id
       OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
       OR NEW.due_date IS DISTINCT FROM OLD.due_date
       OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.notes IS DISTINCT FROM OLD.notes
       OR NEW.linked_invoice_id IS DISTINCT FROM OLD.linked_invoice_id THEN
      RAISE EXCEPTION 'Clients can only update the payment proof on their invoices';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_client_invoice_update_columns_trg ON public.invoices;
DROP TRIGGER IF EXISTS enforce_client_invoice_update_columns_trg ON public.invoices;
CREATE TRIGGER enforce_client_invoice_update_columns_trg
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.enforce_client_invoice_update_columns();

-- Tighten the client update policy with an explicit WITH CHECK
DROP POLICY IF EXISTS "Clients can update invoice payment proof" ON public.invoices;
DROP POLICY IF EXISTS "Clients can update invoice payment proof" ON public.invoices;
CREATE POLICY "Clients can update invoice payment proof" ON public.invoices
FOR UPDATE
TO authenticated
USING (client_id = auth.uid())
WITH CHECK (client_id = auth.uid());

-- >>> 20260612151107_10beed52-47f9-46df-bf48-1ff1846c0b99.sql

-- [migration-export] enum value folded into CREATE TYPE above: ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'draft';

-- >>> 20260613170553_8f270bb7-f3d7-43ec-971f-294425fa1649.sql


-- ============ Free plan support ============

-- 1) Allow 'free' on plan_tier check constraints
ALTER TABLE public.agencies DROP CONSTRAINT IF EXISTS agencies_plan_tier_check;
ALTER TABLE public.agencies ADD CONSTRAINT agencies_plan_tier_check
  CHECK (plan_tier = ANY (ARRAY['free'::text,'starter'::text,'growth'::text,'scale'::text]));

ALTER TABLE public.agencies DROP CONSTRAINT IF EXISTS agencies_subscription_plan_check;
ALTER TABLE public.agencies ADD CONSTRAINT agencies_subscription_plan_check
  CHECK (subscription_plan = ANY (ARRAY['free'::text,'starter'::text,'growth'::text,'scale'::text,'pro'::text]));

-- 2) Safe defaults so a partial signup lands on 'free'
ALTER TABLE public.agencies ALTER COLUMN plan_tier SET DEFAULT 'free';
ALTER TABLE public.agencies ALTER COLUMN subscription_plan SET DEFAULT 'free';
ALTER TABLE public.agencies ALTER COLUMN max_clients SET DEFAULT 1;
ALTER TABLE public.agencies ALTER COLUMN storage_limit_bytes SET DEFAULT 2147483648;

-- 3) Active project count helper (excludes done/cancelled/proposal/request)
CREATE OR REPLACE FUNCTION public.get_active_project_count(_agency_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.projects
  WHERE agency_id = _agency_id
    AND status NOT IN ('done','cancelled','proposal','request');
$$;

-- 4) Active project limit check
CREATE OR REPLACE FUNCTION public.check_active_project_limit(_agency_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _tier text; _count integer;
BEGIN
  SELECT plan_tier INTO _tier FROM public.agencies WHERE id = _agency_id;
  IF _tier IS DISTINCT FROM 'free' THEN RETURN true; END IF;
  SELECT public.get_active_project_count(_agency_id) INTO _count;
  RETURN _count < 1;
END;
$$;

-- 5) Trigger: enforce free-plan project cap (INSERT)
CREATE OR REPLACE FUNCTION public.enforce_free_project_limit_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _tier text;
BEGIN
  IF NEW.status IN ('done','cancelled','proposal','request') THEN RETURN NEW; END IF;
  SELECT plan_tier INTO _tier FROM public.agencies WHERE id = NEW.agency_id;
  IF _tier = 'free' AND public.get_active_project_count(NEW.agency_id) >= 1 THEN
    RAISE EXCEPTION 'FREE_PLAN_PROJECT_LIMIT' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_free_project_limit_insert ON public.projects;
DROP TRIGGER IF EXISTS trg_enforce_free_project_limit_insert ON public.projects;
CREATE TRIGGER trg_enforce_free_project_limit_insert
BEFORE INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.enforce_free_project_limit_insert();

-- 6) Trigger: enforce free-plan project cap when status transitions INTO active
CREATE OR REPLACE FUNCTION public.enforce_free_project_limit_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _tier text;
BEGIN
  IF NEW.status NOT IN ('done','cancelled','proposal','request')
     AND OLD.status IN ('done','cancelled','proposal','request') THEN
    SELECT plan_tier INTO _tier FROM public.agencies WHERE id = NEW.agency_id;
    IF _tier = 'free' AND public.get_active_project_count(NEW.agency_id) >= 1 THEN
      RAISE EXCEPTION 'FREE_PLAN_PROJECT_LIMIT' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_free_project_limit_update ON public.projects;
DROP TRIGGER IF EXISTS trg_enforce_free_project_limit_update ON public.projects;
CREATE TRIGGER trg_enforce_free_project_limit_update
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.enforce_free_project_limit_update();

-- 7) Trigger: enforce client cap (uses existing check_client_limit which compares to max_clients)
CREATE OR REPLACE FUNCTION public.enforce_client_limit_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'client'::app_role THEN
    IF NOT public.check_client_limit(NEW.agency_id) THEN
      RAISE EXCEPTION 'CLIENT_LIMIT_REACHED' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_client_limit ON public.user_roles;
DROP TRIGGER IF EXISTS trg_enforce_client_limit ON public.user_roles;
CREATE TRIGGER trg_enforce_client_limit
BEFORE INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_client_limit_trigger();

-- 8) Trigger: enforce storage limit on deliverables
CREATE OR REPLACE FUNCTION public.enforce_storage_limit_deliverables()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _agency_id uuid;
BEGIN
  IF NEW.file_size IS NULL OR NEW.file_size = 0 THEN RETURN NEW; END IF;
  SELECT p.agency_id INTO _agency_id FROM public.projects p WHERE p.id = NEW.project_id;
  IF _agency_id IS NULL THEN RETURN NEW; END IF;
  IF NOT public.check_storage_limit(_agency_id, NEW.file_size) THEN
    RAISE EXCEPTION 'STORAGE_LIMIT_REACHED' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_storage_limit_deliverables ON public.deliverables;
DROP TRIGGER IF EXISTS trg_enforce_storage_limit_deliverables ON public.deliverables;
CREATE TRIGGER trg_enforce_storage_limit_deliverables
BEFORE INSERT ON public.deliverables
FOR EACH ROW EXECUTE FUNCTION public.enforce_storage_limit_deliverables();

-- 9) Trigger: enforce storage limit on drive_files
CREATE OR REPLACE FUNCTION public.enforce_storage_limit_drive()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.file_size IS NULL OR NEW.file_size = 0 THEN RETURN NEW; END IF;
  IF NEW.agency_id IS NULL THEN RETURN NEW; END IF;
  IF NOT public.check_storage_limit(NEW.agency_id, NEW.file_size) THEN
    RAISE EXCEPTION 'STORAGE_LIMIT_REACHED' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_storage_limit_drive ON public.drive_files;
DROP TRIGGER IF EXISTS trg_enforce_storage_limit_drive ON public.drive_files;
CREATE TRIGGER trg_enforce_storage_limit_drive
BEFORE INSERT ON public.drive_files
FOR EACH ROW EXECUTE FUNCTION public.enforce_storage_limit_drive();

-- >>> 20260613172057_f50ea41e-eed0-4da9-a8c2-e94cbf67bccc.sql


-- Restrict what clients can update on their own invoices.
-- Without column-level RLS, we use a BEFORE UPDATE trigger that rejects
-- changes to financial / status fields when the updater is the client
-- (i.e. not an admin/staff of the invoice's agency).

CREATE OR REPLACE FUNCTION public.enforce_client_invoice_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_privileged boolean := false;
BEGIN
  -- Service role / no auth context: allow (server-side flows)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admins, managers, editors, and staff in the invoice's agency can update freely.
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.agency_id = NEW.agency_id
      AND ur.role IN ('admin','manager','editor','staff')
  ) INTO _is_privileged;

  IF _is_privileged THEN
    RETURN NEW;
  END IF;

  -- Otherwise treat as the client: only payment_proof_url (and updated_at) may change.
  IF NEW.status            IS DISTINCT FROM OLD.status            OR
     NEW.amount            IS DISTINCT FROM OLD.amount            OR
     NEW.subtotal          IS DISTINCT FROM OLD.subtotal          OR
     NEW.tax_rate          IS DISTINCT FROM OLD.tax_rate          OR
     NEW.tax_amount        IS DISTINCT FROM OLD.tax_amount        OR
     NEW.paid_at           IS DISTINCT FROM OLD.paid_at           OR
     NEW.due_date          IS DISTINCT FROM OLD.due_date          OR
     NEW.invoice_number    IS DISTINCT FROM OLD.invoice_number    OR
     NEW.payment_method_id IS DISTINCT FROM OLD.payment_method_id OR
     NEW.payment_link      IS DISTINCT FROM OLD.payment_link      OR
     NEW.notes             IS DISTINCT FROM OLD.notes             OR
     NEW.project_id        IS DISTINCT FROM OLD.project_id        OR
     NEW.container_id      IS DISTINCT FROM OLD.container_id      OR
     NEW.client_id         IS DISTINCT FROM OLD.client_id         OR
     NEW.agency_id         IS DISTINCT FROM OLD.agency_id         OR
     NEW.created_at        IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_UPDATE_FORBIDDEN: clients can only upload payment proof'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_client_invoice_update_scope_trg ON public.invoices;
DROP TRIGGER IF EXISTS enforce_client_invoice_update_scope_trg ON public.invoices;
CREATE TRIGGER enforce_client_invoice_update_scope_trg
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.enforce_client_invoice_update_scope();

-- >>> 20260613184508_a3b10c84-db7a-4652-9b3b-8334339fa333.sql

UPDATE public.agencies SET plan_tier = 'free' WHERE plan_tier IS NULL OR plan_tier = '';
UPDATE public.agencies SET subscription_plan = 'free' WHERE subscription_plan IS NULL OR subscription_plan = '';
UPDATE public.agencies SET max_clients = COALESCE(max_clients, 1), storage_limit_bytes = COALESCE(storage_limit_bytes, 2147483648) WHERE plan_tier = 'free';

-- >>> 20260615165236_c28b1c0b-9788-40a3-9383-3f7138fb1707.sql


DROP POLICY IF EXISTS "Users can view agency projects" ON public.projects;

DROP POLICY IF EXISTS "Non-clients can view agency projects" ON public.projects;
CREATE POLICY "Non-clients can view agency projects" ON public.projects
FOR SELECT
USING (
  agency_id = public.get_user_agency_id(auth.uid())
  AND NOT public.has_role(auth.uid(), 'client'::app_role)
);

DROP POLICY IF EXISTS "Clients can view their own projects" ON public.projects;
CREATE POLICY "Clients can view their own projects" ON public.projects
FOR SELECT
USING (
  client_id = auth.uid()
  AND public.has_role(auth.uid(), 'client'::app_role)
);

-- >>> 20260616210228_13a514f1-b59c-4a0e-8ff6-ab58b237be48.sql


CREATE TABLE IF NOT EXISTS public.email_sequences (
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

DROP POLICY IF EXISTS "Users can view own sequence" ON public.email_sequences;
CREATE POLICY "Users can view own sequence" ON public.email_sequences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_email_sequences_cron ON public.email_sequences(created_at, email_1_sent_at, email_2_sent_at, email_3_sent_at) WHERE unsubscribed_at IS NULL;

-- >>> 20260625092809_7e5db7c2-8916-4a28-a65a-9b3644ce3376.sql

CREATE TABLE IF NOT EXISTS public.employee_compensation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  monthly_salary NUMERIC,
  accumulated_bonus NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_compensation TO authenticated;
GRANT ALL ON public.employee_compensation TO service_role;

ALTER TABLE public.employee_compensation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own compensation" ON public.employee_compensation;
CREATE POLICY "Users can view their own compensation" ON public.employee_compensation FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view team compensation" ON public.employee_compensation;
CREATE POLICY "Admins can view team compensation" ON public.employee_compensation FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND public.users_share_agency(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "Admins can insert team compensation" ON public.employee_compensation;
CREATE POLICY "Admins can insert team compensation" ON public.employee_compensation FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND public.users_share_agency(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "Admins can update team compensation" ON public.employee_compensation;
CREATE POLICY "Admins can update team compensation" ON public.employee_compensation FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND public.users_share_agency(auth.uid(), user_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND public.users_share_agency(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "Admins can delete team compensation" ON public.employee_compensation;
CREATE POLICY "Admins can delete team compensation" ON public.employee_compensation FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND public.users_share_agency(auth.uid(), user_id)
  );

DROP TRIGGER IF EXISTS update_employee_compensation_updated_at ON public.employee_compensation;
CREATE TRIGGER update_employee_compensation_updated_at
  BEFORE UPDATE ON public.employee_compensation
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- >>> 20260625093804_e24f926b-1715-429c-8215-8ee132bfb9b2.sql

CREATE OR REPLACE FUNCTION public.get_user_agency_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT agency_id
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY created_at ASC, agency_id ASC
  LIMIT 1
$function$;

-- >>> 20260625094344_5409a70f-4088-40dc-bafc-3cc0353fd8d8.sql

-- Add 'custom' to channel_type enum
-- [migration-export] enum value folded into CREATE TYPE above: ALTER TYPE public.channel_type ADD VALUE IF NOT EXISTS 'custom';

-- >>> 20260625095907_9d9a341d-9b63-4875-b4d6-c2d6887ab242.sql


-- 1. Fix channels INSERT policy: support multi-agency admins by checking membership instead of single-agency match
DROP POLICY IF EXISTS "Admins can create channels" ON public.channels;
DROP POLICY IF EXISTS "Admins can create channels" ON public.channels;
CREATE POLICY "Admins can create channels" ON public.channels
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.user_belongs_to_agency(auth.uid(), agency_id)
);

-- Same fix for UPDATE policy (rename / archive)
DROP POLICY IF EXISTS "Admins can update channels" ON public.channels;
DROP POLICY IF EXISTS "Admins can update channels" ON public.channels;
CREATE POLICY "Admins can update channels" ON public.channels
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.user_belongs_to_agency(auth.uid(), agency_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND public.user_belongs_to_agency(auth.uid(), agency_id)
);

-- 2. Channel groups (admin-created folders inside the Channels sidebar)
CREATE TABLE IF NOT EXISTS public.channel_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_groups TO authenticated;
GRANT ALL ON public.channel_groups TO service_role;

ALTER TABLE public.channel_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view groups" ON public.channel_groups;
CREATE POLICY "Members can view groups" ON public.channel_groups FOR SELECT TO authenticated
USING (public.user_belongs_to_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Admins manage groups insert" ON public.channel_groups;
CREATE POLICY "Admins manage groups insert" ON public.channel_groups FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Admins manage groups update" ON public.channel_groups;
CREATE POLICY "Admins manage groups update" ON public.channel_groups FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id))
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id));

DROP POLICY IF EXISTS "Admins manage groups delete" ON public.channel_groups;
CREATE POLICY "Admins manage groups delete" ON public.channel_groups FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role) AND public.user_belongs_to_agency(auth.uid(), agency_id));

DROP TRIGGER IF EXISTS trg_update_channel_groups_updated_at ON public.channel_groups;
CREATE TRIGGER trg_update_channel_groups_updated_at
BEFORE UPDATE ON public.channel_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Add group_id to channels (nullable; null = ungrouped / auto Projects bucket)
ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.channel_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_channels_group_id ON public.channels(group_id);

-- >>> 20260626151951_55595320-079d-4dbe-80f7-a65d2738d86c.sql

DROP POLICY IF EXISTS "Users can view their channels" ON public.channels;
DROP POLICY IF EXISTS "Users can view their channels" ON public.channels;
CREATE POLICY "Users can view their channels" ON public.channels
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.channel_participants cp
    WHERE cp.channel_id = channels.id AND cp.user_id = auth.uid()
  )
  OR (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND public.user_belongs_to_agency(auth.uid(), agency_id)
  )
);

-- >>> 20260627184401_c4fd06b0-0ad1-4074-8974-5e4137943b05.sql


-- 1. Webhook endpoints table
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  events TEXT[] NOT NULL DEFAULT ARRAY['deliverable_uploaded','review_requested','invoice_paid'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_delivery_at TIMESTAMPTZ,
  last_delivery_status INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_endpoints TO authenticated;
GRANT ALL ON public.webhook_endpoints TO service_role;

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage own agency webhooks" ON public.webhook_endpoints;
CREATE POLICY "Admins manage own agency webhooks" ON public.webhook_endpoints FOR ALL
TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) AND agency_id = get_user_agency_id(auth.uid()))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND agency_id = get_user_agency_id(auth.uid()));

DROP TRIGGER IF EXISTS trg_webhook_endpoints_updated ON public.webhook_endpoints;
CREATE TRIGGER trg_webhook_endpoints_updated
BEFORE UPDATE ON public.webhook_endpoints
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Helper: dispatch webhook event via pg_net
CREATE OR REPLACE FUNCTION public.dispatch_webhook_event(_agency_id uuid, _event text, _payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ep RECORD;
  _body jsonb;
BEGIN
  FOR _ep IN
    SELECT * FROM public.webhook_endpoints
    WHERE agency_id = _agency_id AND is_active = true AND _event = ANY(events)
  LOOP
    _body := jsonb_build_object(
      'event', _event,
      'agency_id', _agency_id,
      'created_at', now(),
      'data', _payload
    );
    PERFORM net.http_post(
      url := _ep.url,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'X-Veylodesk-Event', _event,
        'X-Veylodesk-Secret', _ep.secret
      ),
      body := _body
    );
  END LOOP;
END;
$$;

-- 3. Trigger: notify on deliverable upload + webhook dispatch
CREATE OR REPLACE FUNCTION public.notify_deliverable_uploaded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project RECORD;
  _editor RECORD;
  _uploader_name TEXT;
BEGIN
  IF NEW.file_type IS DISTINCT FROM 'deliverable' THEN
    RETURN NEW;
  END IF;

  SELECT p.*, a.id AS aid FROM projects p JOIN agencies a ON a.id=p.agency_id
    INTO _project WHERE p.id = NEW.project_id;
  IF _project IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(full_name,email) INTO _uploader_name FROM profiles WHERE id = NEW.uploaded_by;

  -- Notify client
  IF _project.client_id IS NOT NULL THEN
    PERFORM create_notification(
      _project.client_id, _project.agency_id, 'deliverable_uploaded'::notification_type,
      'New Deliverable Uploaded',
      COALESCE(_uploader_name,'Editor') || ' uploaded "' || NEW.file_name || '" to ' || _project.title,
      '/client/projects',
      jsonb_build_object('project_id', _project.id, 'deliverable_id', NEW.id)
    );
  END IF;

  -- Notify editors assigned to project (skip uploader)
  FOR _editor IN SELECT editor_id FROM project_editors WHERE project_id = _project.id AND editor_id <> COALESCE(NEW.uploaded_by, '00000000-0000-0000-0000-000000000000'::uuid)
  LOOP
    PERFORM create_notification(
      _editor.editor_id, _project.agency_id, 'deliverable_uploaded'::notification_type,
      'New Deliverable Uploaded',
      COALESCE(_uploader_name,'Someone') || ' uploaded "' || NEW.file_name || '"',
      '/editor/projects',
      jsonb_build_object('project_id', _project.id, 'deliverable_id', NEW.id)
    );
  END LOOP;

  -- Dispatch webhook
  PERFORM dispatch_webhook_event(_project.agency_id, 'deliverable_uploaded', jsonb_build_object(
    'deliverable_id', NEW.id,
    'project_id', _project.id,
    'project_title', _project.title,
    'file_name', NEW.file_name,
    'file_size', NEW.file_size,
    'uploaded_by', NEW.uploaded_by
  ));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_deliverable_uploaded ON public.deliverables;
DROP TRIGGER IF EXISTS trg_notify_deliverable_uploaded ON public.deliverables;
CREATE TRIGGER trg_notify_deliverable_uploaded
AFTER INSERT ON public.deliverables
FOR EACH ROW EXECUTE FUNCTION public.notify_deliverable_uploaded();

-- 4. Trigger: dispatch webhook on review requested (status -> review)
CREATE OR REPLACE FUNCTION public.dispatch_review_requested_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'review' AND OLD.status IS DISTINCT FROM 'review' THEN
    PERFORM dispatch_webhook_event(NEW.agency_id, 'review_requested', jsonb_build_object(
      'project_id', NEW.id,
      'project_title', NEW.title,
      'client_id', NEW.client_id,
      'previous_status', OLD.status
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_review_requested ON public.projects;
DROP TRIGGER IF EXISTS trg_dispatch_review_requested ON public.projects;
CREATE TRIGGER trg_dispatch_review_requested
AFTER UPDATE OF status ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.dispatch_review_requested_webhook();

-- 5. Trigger: dispatch webhook on invoice paid
CREATE OR REPLACE FUNCTION public.dispatch_invoice_paid_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    PERFORM dispatch_webhook_event(NEW.agency_id, 'invoice_paid', jsonb_build_object(
      'invoice_id', NEW.id,
      'invoice_number', NEW.invoice_number,
      'amount', NEW.amount,
      'currency', NEW.currency,
      'client_id', NEW.client_id,
      'project_id', NEW.project_id,
      'paid_at', NEW.paid_at
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_invoice_paid ON public.invoices;
DROP TRIGGER IF EXISTS trg_dispatch_invoice_paid ON public.invoices;
CREATE TRIGGER trg_dispatch_invoice_paid
AFTER UPDATE OF status ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.dispatch_invoice_paid_webhook();

-- 6. Auto-send email when a notification is inserted and user has email enabled
CREATE OR REPLACE FUNCTION public.auto_send_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _enabled boolean;
BEGIN
  SELECT COALESCE(email_enabled, false) INTO _enabled
  FROM notification_preferences
  WHERE user_id = NEW.user_id AND agency_id = NEW.agency_id AND notification_type = NEW.type;

  IF NOT COALESCE(_enabled, false) THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://bwfnxidpifugpklczfyo.supabase.co/functions/v1/send-notification-email',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'agency_id', NEW.agency_id,
      'type', NEW.type,
      'title', NEW.title,
      'message', NEW.message,
      'link', NEW.link,
      'metadata', NEW.metadata
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_send_notification_email ON public.notifications;
DROP TRIGGER IF EXISTS trg_auto_send_notification_email ON public.notifications;
CREATE TRIGGER trg_auto_send_notification_email
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.auto_send_notification_email();

-- >>> 20260704001215_c21e452b-1960-4cae-ad14-c6c2f4ac78b5.sql


-- 1) Restrict client invoice updates to payment_proof_url only via trigger
CREATE OR REPLACE FUNCTION public.restrict_client_invoice_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only apply the restriction to non-admin actors updating their own invoice as a client.
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.client_id IS DISTINCT FROM auth.uid() THEN
    -- Not the client on this row; let other policies decide (or fail).
    RETURN NEW;
  END IF;

  -- Client is only allowed to modify payment_proof_url. Any other change is rejected.
  IF (NEW.status               IS DISTINCT FROM OLD.status)
    OR (NEW.amount             IS DISTINCT FROM OLD.amount)
    OR (NEW.currency           IS DISTINCT FROM OLD.currency)
    OR (NEW.paid_at            IS DISTINCT FROM OLD.paid_at)
    OR (NEW.invoice_number     IS DISTINCT FROM OLD.invoice_number)
    OR (NEW.agency_id          IS DISTINCT FROM OLD.agency_id)
    OR (NEW.client_id          IS DISTINCT FROM OLD.client_id)
    OR (NEW.managed_client_id  IS DISTINCT FROM OLD.managed_client_id)
    OR (NEW.project_id         IS DISTINCT FROM OLD.project_id)
    OR (NEW.due_date           IS DISTINCT FROM OLD.due_date)
    OR (NEW.issued_at          IS DISTINCT FROM OLD.issued_at)
    OR (NEW.notes              IS DISTINCT FROM OLD.notes)
    OR (NEW.description        IS DISTINCT FROM OLD.description)
    OR (NEW.created_at         IS DISTINCT FROM OLD.created_at)
    OR (NEW.id                 IS DISTINCT FROM OLD.id)
  THEN
    RAISE EXCEPTION 'Clients may only update the payment_proof_url on their invoices'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_client_invoice_updates ON public.invoices;
DROP TRIGGER IF EXISTS trg_restrict_client_invoice_updates ON public.invoices;
CREATE TRIGGER trg_restrict_client_invoice_updates
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_client_invoice_updates();

-- 2) Exclude clients from broad drive_files SELECT policy
DROP POLICY IF EXISTS "Agency members view drive files" ON public.drive_files;
DROP POLICY IF EXISTS "Agency members view drive files" ON public.drive_files;
CREATE POLICY "Agency members view drive files" ON public.drive_files
  FOR SELECT
  USING (
    user_belongs_to_agency(auth.uid(), agency_id)
    AND NOT has_role(auth.uid(), 'client'::app_role)
    AND (
      deleted_at IS NULL
      OR uploaded_by = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );
