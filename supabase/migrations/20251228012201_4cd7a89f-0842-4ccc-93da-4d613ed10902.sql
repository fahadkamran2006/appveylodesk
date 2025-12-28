-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'client', 'editor');

-- Create enum for project status
CREATE TYPE public.project_status AS ENUM ('backlog', 'in_progress', 'review', 'done');

-- Create enum for invoice status
CREATE TYPE public.invoice_status AS ENUM ('unpaid', 'paid', 'overdue');

-- Agencies table
CREATE TABLE public.agencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
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
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'client',
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, agency_id)
);

-- Projects table
CREATE TABLE public.projects (
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
CREATE TABLE public.project_editors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  editor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, editor_id)
);

-- Invoices table
CREATE TABLE public.invoices (
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
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Project deliverables/files
CREATE TABLE public.deliverables (
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
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view agency profiles"
ON public.profiles FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') AND
  agency_id = public.get_user_agency_id(auth.uid())
);

-- Agencies policies
CREATE POLICY "Users can view their agency"
ON public.agencies FOR SELECT
USING (
  public.user_belongs_to_agency(auth.uid(), id)
);

CREATE POLICY "Admins can update their agency"
ON public.agencies FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin') AND
  public.user_belongs_to_agency(auth.uid(), id)
);

CREATE POLICY "Authenticated users can create agencies"
ON public.agencies FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- User roles policies
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles in their agency"
ON public.user_roles FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') AND
  agency_id = public.get_user_agency_id(auth.uid())
);

CREATE POLICY "Users can insert their own role during signup"
ON public.user_roles FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Projects policies
CREATE POLICY "Admins can manage all agency projects"
ON public.projects FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') AND
  public.user_belongs_to_agency(auth.uid(), agency_id)
);

CREATE POLICY "Clients can view their projects"
ON public.projects FOR SELECT
USING (client_id = auth.uid());

CREATE POLICY "Editors can view assigned projects"
ON public.projects FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.project_editors
    WHERE project_id = id AND editor_id = auth.uid()
  )
);

CREATE POLICY "Editors can update assigned projects"
ON public.projects FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.project_editors
    WHERE project_id = id AND editor_id = auth.uid()
  )
);

-- Project editors policies
CREATE POLICY "Admins can manage editor assignments"
ON public.project_editors FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') AND
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
      AND public.user_belongs_to_agency(auth.uid(), p.agency_id)
  )
);

CREATE POLICY "Editors can view their assignments"
ON public.project_editors FOR SELECT
USING (editor_id = auth.uid());

-- Invoices policies
CREATE POLICY "Admins can manage agency invoices"
ON public.invoices FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') AND
  public.user_belongs_to_agency(auth.uid(), agency_id)
);

CREATE POLICY "Clients can view their invoices"
ON public.invoices FOR SELECT
USING (client_id = auth.uid());

CREATE POLICY "Clients can update invoice payment proof"
ON public.invoices FOR UPDATE
USING (client_id = auth.uid());

-- Messages policies
CREATE POLICY "Users can view messages on their projects"
ON public.messages FOR SELECT
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

CREATE POLICY "Users can send messages on their projects"
ON public.messages FOR INSERT
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
CREATE POLICY "Users can view deliverables on their projects"
ON public.deliverables FOR SELECT
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

CREATE POLICY "Editors and admins can upload deliverables"
ON public.deliverables FOR INSERT
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
CREATE TRIGGER update_agencies_updated_at
  BEFORE UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();