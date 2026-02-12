
ALTER TABLE public.channels DROP CONSTRAINT channels_project_check;

ALTER TABLE public.channels ADD CONSTRAINT channels_project_check CHECK (
  (type = 'dm' AND project_id IS NULL AND container_id IS NULL)
  OR (type = 'project' AND (project_id IS NOT NULL OR container_id IS NOT NULL))
);
