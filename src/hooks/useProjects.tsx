import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type ProjectStatus = Database['public']['Enums']['project_status'];

export interface ProjectEditor {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  client_id: string | null;
  client_name?: string;
  agency_id: string;
  status: ProjectStatus;
  due_date: string | null;
  budget: number | null;
  editor_rate: number | null;
  editors: ProjectEditor[];
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  totalRevenue: number;
  activeProjects: number;
  pendingInvoices: number;
  pendingInvoiceCount: number;
  activeClients: number;
  totalClients: number;
  totalEditors: number;
  proposalsCount: number;
}

// Module-level cache so navigating away/back shows data instantly
const projectsCache = new Map<string, { projects: Project[]; agencyId: string | null }>();

export function useProjects(role: 'admin' | 'editor' | 'client') {
  const { user } = useAuth();
  const { toast } = useToast();
  const cacheKey = user ? `${role}:${user.id}` : '';
  const cached = cacheKey ? projectsCache.get(cacheKey) : undefined;
  const [projects, setProjects] = useState<Project[]>(cached?.projects || []);
  const [loading, setLoading] = useState(!cached);
  const [agencyId, setAgencyId] = useState<string | null>(cached?.agencyId ?? null);

  const fetchProjects = useCallback(async () => {
    if (!user) return;

    // Only show full loading state on first load; otherwise refresh silently in background
    if (!projectsCache.has(`${role}:${user.id}`)) setLoading(true);
    try {
      const { data: userRoleData } = await supabase
        .from('user_roles')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRoleData?.agency_id) {
        setLoading(false);
        return;
      }

      setAgencyId(userRoleData.agency_id);

      let projectsQuery = supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (role === 'admin') {
        projectsQuery = projectsQuery.eq('agency_id', userRoleData.agency_id);
      } else if (role === 'client') {
        projectsQuery = projectsQuery.eq('client_id', user.id);
      } else if (role === 'editor') {
        const { data: assignments } = await supabase
          .from('project_editors')
          .select('project_id')
          .eq('editor_id', user.id);

        const projectIds = assignments?.map(a => a.project_id) || [];
        if (projectIds.length === 0) {
          setProjects([]);
          projectsCache.set(`${role}:${user.id}`, { projects: [], agencyId: userRoleData.agency_id });
          setLoading(false);
          return;
        }
        projectsQuery = projectsQuery.in('id', projectIds);
      }

      const { data: projectsData, error } = await projectsQuery;
      if (error) throw error;

      const projectList = projectsData || [];
      const projectIds = projectList.map(p => p.id);
      const clientIds = [...new Set(projectList.map(p => p.client_id).filter(Boolean) as string[])];

      // BATCHED enrichment: 3 queries total instead of N*3
      const [clientsRes, projectEditorsRes] = await Promise.all([
        clientIds.length
          ? supabase.from('profiles').select('id, full_name, email').in('id', clientIds)
          : Promise.resolve({ data: [] as any[] }),
        projectIds.length
          ? supabase.from('project_editors').select('project_id, editor_id').in('project_id', projectIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const clientMap = new Map<string, { full_name: string | null; email: string | null }>();
      (clientsRes.data || []).forEach((c: any) => clientMap.set(c.id, c));

      const editorIds = [...new Set((projectEditorsRes.data || []).map((pe: any) => pe.editor_id))];
      const editorProfilesRes = editorIds.length
        ? await supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', editorIds)
        : { data: [] as any[] };
      const editorProfileMap = new Map<string, any>();
      (editorProfilesRes.data || []).forEach((p: any) => editorProfileMap.set(p.id, p));

      const editorsByProject = new Map<string, ProjectEditor[]>();
      (projectEditorsRes.data || []).forEach((pe: any) => {
        const prof = editorProfileMap.get(pe.editor_id);
        if (!prof) return;
        const list = editorsByProject.get(pe.project_id) || [];
        list.push({ id: prof.id, full_name: prof.full_name, email: prof.email, avatar_url: prof.avatar_url });
        editorsByProject.set(pe.project_id, list);
      });

      const enrichedProjects: Project[] = projectList.map((project) => {
        const client = project.client_id ? clientMap.get(project.client_id) : undefined;
        return {
          id: project.id,
          title: project.title,
          description: project.description,
          client_id: project.client_id,
          client_name: client?.full_name || client?.email || undefined,
          agency_id: project.agency_id,
          status: project.status as ProjectStatus,
          due_date: project.due_date,
          budget: project.budget,
          editor_rate: project.editor_rate,
          editors: editorsByProject.get(project.id) || [],
          created_at: project.created_at,
          updated_at: project.updated_at,
        };
      });

      setProjects(enrichedProjects);
      projectsCache.set(`${role}:${user.id}`, { projects: enrichedProjects, agencyId: userRoleData.agency_id });
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: 'Error',
        description: 'Failed to load projects',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, role, toast]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const updateProjectStatus = async (projectId: string, newStatus: ProjectStatus) => {
    // Optimistic update
    setProjects(prev =>
      prev.map(p => (p.id === projectId ? { ...p, status: newStatus } : p))
    );

    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', projectId);

      if (error) throw error;
      return true;
    } catch (error) {
      // Revert on error
      fetchProjects();
      toast({
        title: 'Error',
        description: 'Failed to update project status',
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      // Step 1: Clean up Bunny assets (fail-safe - block if cleanup fails)
      const { data: assetResult, error: assetError } = await supabase.functions.invoke('delete-asset', {
        body: { action: 'delete_project_files', projectId },
      });

      if (assetError || assetResult?.error) {
        console.error('Asset cleanup failed:', assetError || assetResult?.error);
        toast({
          title: 'Cleanup failed',
          description: 'Could not remove files from storage. Project deletion blocked.',
          variant: 'destructive',
        });
        return false;
      }

      // Step 2: Delete the project from database
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;
      
      setProjects(prev => prev.filter(p => p.id !== projectId));
      toast({
        title: 'Project deleted',
        description: 'All files and data have been permanently removed.',
      });
      return true;
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete project',
        variant: 'destructive',
      });
      return false;
    }
  };

  const requestCancellation = async (projectId: string, reason: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('cancellation_requests')
        .insert({
          project_id: projectId,
          requested_by: user.id,
          reason,
        });

      if (error) throw error;

      toast({
        title: 'Request submitted',
        description: 'Your cancellation request has been sent to the admin.',
      });
      return true;
    } catch (error) {
      console.error('Error requesting cancellation:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit cancellation request',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    projects,
    loading,
    agencyId,
    fetchProjects,
    updateProjectStatus,
    deleteProject,
    requestCancellation,
  };
}

// Module-level cache so the dashboard renders instantly on revisit
const statsCache = new Map<string, DashboardStats>();

export function useDashboardStats() {
  const { user } = useAuth();
  const cachedStats = user ? statsCache.get(user.id) : undefined;
  const [stats, setStats] = useState<DashboardStats>(cachedStats || {
    totalRevenue: 0,
    activeProjects: 0,
    pendingInvoices: 0,
    pendingInvoiceCount: 0,
    activeClients: 0,
    totalClients: 0,
    totalEditors: 0,
    proposalsCount: 0,
  });
  const [loading, setLoading] = useState(!cachedStats);

  const fetchStats = useCallback(async () => {
    if (!user) return;

    try {
      // Get agency_id
      const { data: userRoleData } = await supabase
        .from('user_roles')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRoleData?.agency_id) return;

      const agencyId = userRoleData.agency_id;

      // Parallel data fetching
      const [
        projectsResult,
        invoicesResult,
        clientsResult,
        managedClientsResult,
        editorsResult,
      ] = await Promise.all([
        supabase
          .from('projects')
          .select('id, status, client_id, managed_client_id')
          .eq('agency_id', agencyId),
        supabase
          .from('invoices')
          .select('id, amount, status')
          .eq('agency_id', agencyId),
        supabase
          .from('user_roles')
          .select('user_id')
          .eq('agency_id', agencyId)
          .eq('role', 'client'),
        supabase
          .from('managed_clients')
          .select('id')
          .eq('agency_id', agencyId),
        supabase
          .from('user_roles')
          .select('user_id')
          .eq('agency_id', agencyId)
          .eq('role', 'editor'),
      ]);

      const projects = projectsResult.data || [];
      const invoices = invoicesResult.data || [];
      const clients = clientsResult.data || [];
      const managedClients = managedClientsResult.data || [];
      const editors = editorsResult.data || [];

      // Calculate stats
      const activeProjects = projects.filter(p => 
        p.status === 'in_progress' || p.status === 'review'
      ).length;

      const proposals = projects.filter(p => p.status === 'proposal').length;

      // Active clients = unique clients (real OR managed) with active projects
      const activeClientKeys = new Set(
        projects
          .filter(p => p.status === 'in_progress' || p.status === 'review')
          .map(p => p.client_id ? `c:${p.client_id}` : p.managed_client_id ? `m:${p.managed_client_id}` : null)
          .filter(Boolean) as string[]
      );

      // Calculate revenue and pending invoices
      const paidInvoices = invoices.filter(i => i.status === 'paid');
      const unpaidInvoices = invoices.filter(i => i.status === 'unpaid' || i.status === 'pending');
      
      const totalRevenue = paidInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
      const pendingInvoices = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);

      const newStats: DashboardStats = {
        totalRevenue,
        activeProjects,
        pendingInvoices,
        pendingInvoiceCount: unpaidInvoices.length,
        activeClients: activeClientKeys.size,
        totalClients: clients.length + managedClients.length,
        totalEditors: editors.length,
        proposalsCount: proposals,
      };
      setStats(newStats);
      statsCache.set(user.id, newStats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
