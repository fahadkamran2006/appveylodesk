import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, startOfMonth, subDays } from 'date-fns';

export type TimePeriod = 'week' | 'month' | 'all';

interface ClientStats {
  activeProjects: number;
  totalSpent: number;
  projects: Array<{ id: string; name: string; status: string }>;
}

interface EditorStats {
  currentLoad: number;
  completedProjects: number;
  avgDeliveryDays: number | null;
  projects: Array<{ id: string; name: string; status: string }>;
}

const getDateRangeStart = (period: TimePeriod): Date | null => {
  const now = new Date();
  switch (period) {
    case 'week':
      return startOfWeek(now, { weekStartsOn: 1 });
    case 'month':
      return startOfMonth(now);
    case 'all':
    default:
      return null;
  }
};

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

export async function fetchEditorStats(editorId: string, period: TimePeriod = 'all'): Promise<EditorStats> {
  const dateStart = getDateRangeStart(period);
  
  // Fetch current load (active assigned projects) with assignment and completion dates
  const { data: activeData } = await supabase
    .from('project_editors')
    .select(`
      project_id,
      assigned_at,
      projects!inner (
        id,
        title,
        status,
        completed_at
      )
    `)
    .eq('editor_id', editorId);

  const activeProjects = activeData?.filter(
    (pe: any) => pe.projects && !['done', 'cancelled'].includes(pe.projects.status)
  ) || [];

  // Filter completed projects by time period
  const completedProjects = activeData?.filter((pe: any) => {
    if (!pe.projects || pe.projects.status !== 'done') return false;
    if (!dateStart) return true;
    const completedAt = pe.projects.completed_at ? new Date(pe.projects.completed_at) : null;
    return completedAt && completedAt >= dateStart;
  }) || [];

  // Calculate average delivery time in days (only for projects in time period)
  let avgDeliveryDays: number | null = null;
  const deliveryTimes: number[] = [];
  
  completedProjects.forEach((pe: any) => {
    const assignedAt = pe.assigned_at ? new Date(pe.assigned_at) : null;
    const completedAt = pe.projects?.completed_at ? new Date(pe.projects.completed_at) : null;
    
    if (assignedAt && completedAt) {
      const diffMs = completedAt.getTime() - assignedAt.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays >= 0) {
        deliveryTimes.push(diffDays);
      }
    }
  });

  if (deliveryTimes.length > 0) {
    avgDeliveryDays = deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length;
  }

  const allProjects = activeData?.map((pe: any) => ({
    id: pe.projects?.id || '',
    name: pe.projects?.title || '',
    status: pe.projects?.status || '',
  })).filter(p => p.id) || [];

  return {
    currentLoad: activeProjects.length,
    completedProjects: completedProjects.length,
    avgDeliveryDays,
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

export function useEditorStats(editorIds: string[], period: TimePeriod = 'all') {
  const [stats, setStats] = useState<Record<string, EditorStats>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editorIds.length === 0) return;

    const fetchAll = async () => {
      setLoading(true);
      const results: Record<string, EditorStats> = {};
      
      await Promise.all(
        editorIds.map(async (id) => {
          const editorStats = await fetchEditorStats(id, period);
          results[id] = editorStats;
        })
      );
      
      setStats(results);
      setLoading(false);
    };

    fetchAll();
  }, [editorIds.join(','), period]);

  return { stats, loading };
}
