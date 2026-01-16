import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ClientStats {
  activeProjects: number;
  totalSpent: number;
  projects: Array<{ id: string; name: string; status: string }>;
}

interface EditorStats {
  currentLoad: number;
  completedProjects: number;
  projects: Array<{ id: string; name: string; status: string }>;
}

export async function fetchClientStats(clientId: string): Promise<ClientStats> {
  // Fetch active projects count
  const { data: activeProjectsData, error: activeError } = await supabase
    .from('projects')
    .select('id', { count: 'exact' })
    .eq('client_id', clientId)
    .not('status', 'in', '("done","cancelled")');

  // Fetch total spent from paid invoices
  const { data: invoicesData, error: invoiceError } = await supabase
    .from('invoices')
    .select('amount')
    .eq('client_id', clientId)
    .eq('status', 'paid');

  const totalSpent = invoicesData?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;

  // Fetch project history
  const { data: projectsData, error: projectsError } = await supabase
    .from('projects')
    .select('id, title, status')
    .eq('client_id', clientId)
    .order('updated_at', { ascending: false })
    .limit(10);

  return {
    activeProjects: activeProjectsData?.length || 0,
    totalSpent,
    projects: projectsData?.map(p => ({
      id: p.id,
      name: p.title,
      status: p.status,
    })) || [],
  };
}

export async function fetchEditorStats(editorId: string): Promise<EditorStats> {
  // Fetch current load (active assigned projects)
  const { data: activeData } = await supabase
    .from('project_editors')
    .select(`
      project_id,
      projects!inner (
        id,
        title,
        status
      )
    `)
    .eq('editor_id', editorId);

  const activeProjects = activeData?.filter(
    (pe: any) => pe.projects && !['done', 'cancelled'].includes(pe.projects.status)
  ) || [];

  const completedProjects = activeData?.filter(
    (pe: any) => pe.projects && pe.projects.status === 'done'
  ) || [];

  const allProjects = activeData?.map((pe: any) => ({
    id: pe.projects?.id || '',
    name: pe.projects?.title || '',
    status: pe.projects?.status || '',
  })).filter(p => p.id) || [];

  return {
    currentLoad: activeProjects.length,
    completedProjects: completedProjects.length,
    projects: allProjects.slice(0, 10),
  };
}

export function useClientStats(clientIds: string[]) {
  const [stats, setStats] = useState<Record<string, ClientStats>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (clientIds.length === 0) return;

    const fetchAll = async () => {
      setLoading(true);
      const results: Record<string, ClientStats> = {};
      
      await Promise.all(
        clientIds.map(async (id) => {
          const clientStats = await fetchClientStats(id);
          results[id] = clientStats;
        })
      );
      
      setStats(results);
      setLoading(false);
    };

    fetchAll();
  }, [clientIds.join(',')]);

  return { stats, loading };
}

export function useEditorStats(editorIds: string[]) {
  const [stats, setStats] = useState<Record<string, EditorStats>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editorIds.length === 0) return;

    const fetchAll = async () => {
      setLoading(true);
      const results: Record<string, EditorStats> = {};
      
      await Promise.all(
        editorIds.map(async (id) => {
          const editorStats = await fetchEditorStats(id);
          results[id] = editorStats;
        })
      );
      
      setStats(results);
      setLoading(false);
    };

    fetchAll();
  }, [editorIds.join(',')]);

  return { stats, loading };
}
