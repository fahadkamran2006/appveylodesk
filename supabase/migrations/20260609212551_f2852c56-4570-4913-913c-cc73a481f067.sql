ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS container_id uuid REFERENCES public.project_containers(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ALTER COLUMN project_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_container_id ON public.invoices(container_id);