-- =====================================================
-- MESSAGING SYSTEM SCHEMA
-- =====================================================

-- Create channel types enum
CREATE TYPE public.channel_type AS ENUM ('dm', 'project');

-- Create channels table
CREATE TABLE public.channels (
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
CREATE TABLE public.channel_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Create channel mutes table (for client muting feature)
CREATE TABLE public.channel_mutes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  muted_by UUID NOT NULL,
  muted_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(channel_id, muted_by, muted_user_id)
);

-- Modify messages table to use channels instead of projects
ALTER TABLE public.messages 
  ADD COLUMN channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  ALTER COLUMN project_id DROP NOT NULL;

-- Create indexes for performance
CREATE INDEX idx_channels_agency ON public.channels(agency_id);
CREATE INDEX idx_channels_project ON public.channels(project_id);
CREATE INDEX idx_channels_type ON public.channels(type);
CREATE INDEX idx_channel_participants_channel ON public.channel_participants(channel_id);
CREATE INDEX idx_channel_participants_user ON public.channel_participants(user_id);
CREATE INDEX idx_messages_channel ON public.messages(channel_id);
CREATE INDEX idx_channel_mutes_channel ON public.channel_mutes(channel_id);

-- Enable RLS on all tables
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_mutes ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES FOR CHANNELS
-- =====================================================

-- Users can view channels they participate in
CREATE POLICY "Users can view their channels"
ON public.channels FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.channel_participants cp
    WHERE cp.channel_id = channels.id AND cp.user_id = auth.uid()
  )
);

-- Admins can create channels in their agency
CREATE POLICY "Admins can create channels"
ON public.channels FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') AND 
  agency_id = get_user_agency_id(auth.uid())
);

-- Admins can update channels in their agency
CREATE POLICY "Admins can update channels"
ON public.channels FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') AND 
  agency_id = get_user_agency_id(auth.uid())
);

-- =====================================================
-- RLS POLICIES FOR CHANNEL PARTICIPANTS
-- =====================================================

-- Users can view participants in channels they belong to
CREATE POLICY "Users can view channel participants"
ON public.channel_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.channel_participants my_participation
    WHERE my_participation.channel_id = channel_participants.channel_id 
    AND my_participation.user_id = auth.uid()
  )
);

-- Admins can manage participants
CREATE POLICY "Admins can manage participants"
ON public.channel_participants FOR ALL
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
CREATE POLICY "Clients can manage mutes in their project channels"
ON public.channel_mutes FOR ALL
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
CREATE POLICY "Admins can manage all mutes"
ON public.channel_mutes FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = channel_mutes.channel_id 
    AND has_role(auth.uid(), 'admin')
    AND c.agency_id = get_user_agency_id(auth.uid())
  )
);

-- Users can view mutes in channels they participate in
CREATE POLICY "Users can view mutes in their channels"
ON public.channel_mutes FOR SELECT
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
CREATE POLICY "Users can send messages to their channels"
ON public.messages FOR INSERT
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
CREATE POLICY "Users can view messages in their channels"
ON public.messages FOR SELECT
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

-- Create trigger for auto-creating project channels
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

-- Create trigger for adding editors to channels
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

-- Create trigger for archiving channels
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
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =====================================================
-- REALTIME: Enable for messages and channels
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;

-- Update timestamps trigger for channels
CREATE TRIGGER update_channels_updated_at
  BEFORE UPDATE ON public.channels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();