REVOKE EXECUTE ON FUNCTION public.get_admin_agency_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_agency_stats() TO service_role;

DROP POLICY IF EXISTS "Allow public insert" ON public.tool_leads;
CREATE POLICY "Service role manages tool leads"
  ON public.tool_leads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);