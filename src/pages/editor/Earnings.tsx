import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { EditorSidebar } from '@/components/editor/EditorSidebar';
import { DollarSign, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import type { Database } from '@/integrations/supabase/types';

type ProjectStatus = Database['public']['Enums']['project_status'];

interface ProjectEarning {
  id: string;
  title: string;
  status: ProjectStatus;
  editor_rate: number | null;
}

const EditorEarnings = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [projects, setProjects] = useState<ProjectEarning[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Allow admin god mode
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
    if (!loading && userRole && userRole !== 'editor' && userRole !== 'admin') {
      navigate('/client/dashboard');
    }
  }, [user, userRole, loading, navigate]);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    
    try {
      // Fetch projects assigned to this editor with their rates
      const { data, error } = await supabase
        .from('project_editors')
        .select(`
          project:projects(
            id,
            title,
            status,
            editor_rate
          )
        `)
        .eq('editor_id', user.id);

      if (error) throw error;

      const projectsData: ProjectEarning[] = (data || [])
        .map(pe => pe.project)
        .filter((p): p is NonNullable<typeof p> => p !== null);
      
      setProjects(projectsData);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: "Error loading earnings",
        description: "Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user && (userRole === 'editor' || userRole === 'admin')) {
      fetchProjects();
    }
  }, [user, userRole, fetchProjects]);

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      backlog: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
      in_progress: { label: 'In Progress', className: 'bg-primary/10 text-primary border border-primary/20' },
      review: { label: 'In Review', className: 'bg-warning/10 text-warning border border-warning/20' },
      done: { label: 'Completed', className: 'bg-success/10 text-success border border-success/20' },
    };
    return statusMap[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  };

  const completedProjects = projects.filter(p => p.status === 'done');
  const inProgressProjects = projects.filter(p => p.status !== 'done');
  
  const stats = {
    totalEarned: completedProjects.reduce((sum, p) => sum + (p.editor_rate || 0), 0),
    pendingEarnings: inProgressProjects.reduce((sum, p) => sum + (p.editor_rate || 0), 0),
    completedCount: completedProjects.length,
    inProgressCount: inProgressProjects.length,
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>My Earnings | Veylodesk</title>
        <meta name="description" content="View your project earnings." />
      </Helmet>

      <div className="min-h-screen bg-background flex">
        <EditorSidebar />

        <main className="flex-1 p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">My Earnings</h1>
            <p className="text-muted-foreground">Track your project payments and earnings.</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Earned</p>
                  <p className="text-2xl font-bold text-foreground">${stats.totalEarned.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-foreground">${stats.pendingEarnings.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed Jobs</p>
                  <p className="text-2xl font-bold text-foreground">{stats.completedCount}</p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Jobs</p>
                  <p className="text-2xl font-bold text-foreground">{stats.inProgressCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Projects List */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">All Projects</h2>
            
            {projects.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No projects assigned yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Project</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">My Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {projects.map((project) => {
                      const statusInfo = getStatusInfo(project.status);
                      return (
                        <tr key={project.id} className="hover:bg-muted/20">
                          <td className="p-4 font-medium text-foreground">
                            {project.title}
                          </td>
                          <td className="p-4">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium",
                              statusInfo.className
                            )}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <span className={cn(
                              "font-semibold",
                              project.status === 'done' ? "text-success" : "text-foreground"
                            )}>
                              {project.editor_rate 
                                ? `$${project.editor_rate.toLocaleString()}` 
                                : '-'
                              }
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-muted/50">
                    <tr>
                      <td colSpan={2} className="p-4 font-semibold text-foreground">
                        Total Earned (Completed)
                      </td>
                      <td className="p-4 text-right font-bold text-success text-lg">
                        ${stats.totalEarned.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default EditorEarnings;