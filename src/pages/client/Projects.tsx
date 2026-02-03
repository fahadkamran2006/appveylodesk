import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { FolderKanban, Clock, CheckCircle, AlertCircle, Send, Plus, Search, ArrowLeft, LayoutGrid, Video } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ClientProposalModal } from '@/components/projects/ClientProposalModal';
import { ProjectDetailSheet } from '@/components/projects/ProjectDetailSheet';
import { ProjectBreadcrumb } from '@/components/projects/ProjectBreadcrumb';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  budget: number | null;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  proposal: { label: 'Proposal', icon: Send, className: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  backlog: { label: 'Backlog', icon: Clock, className: 'bg-muted text-muted-foreground border-border' },
  in_progress: { label: 'In Progress', icon: AlertCircle, className: 'bg-primary/10 text-primary border-primary/20' },
  review: { label: 'In Review', icon: Clock, className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  done: { label: 'Delivered', icon: CheckCircle, className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  cancelled: { label: 'Cancelled', icon: AlertCircle, className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export default function ClientProjects() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, userRole, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // View mode: 'grid' (projects) or 'all' (all videos/work)
  const viewMode = searchParams.get('view') || 'grid';
  const isAllWorkView = viewMode === 'all';

  const fetchProjects = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, description, status, due_date, budget')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth/login');
    } else if (!authLoading && userRole && userRole !== 'client' && userRole !== 'admin') {
      navigate(`/${userRole}/dashboard`);
    }
  }, [user, userRole, authLoading, navigate]);

  useEffect(() => {
    if (user && (userRole === 'client' || userRole === 'admin')) {
      fetchProjects();
    }
  }, [user, userRole, fetchProjects]);

  const filteredProjects = useMemo(() => {
    let result = projects;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(project =>
        project.title.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [projects, searchQuery]);

  const getStatusInfo = (status: string) => {
    return statusConfig[status] || statusConfig.backlog;
  };

  const activeProjects = projects.filter(p => !['done', 'cancelled'].includes(p.status));
  const completedProjects = projects.filter(p => p.status === 'done');

  // Build breadcrumb items
  const breadcrumbItems = useMemo(() => {
    const items: { label: string; href?: string; icon?: 'home' | 'projects' | 'client' }[] = [
      { label: 'My Projects', href: '/client/projects', icon: 'projects' },
    ];

    if (isAllWorkView) {
      items.push({ label: 'All Work' });
    }

    return items;
  }, [isAllWorkView]);

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{isAllWorkView ? 'All Work' : 'My Projects'} | Veylodesk</title>
        <meta name="description" content="View and track your project progress" />
      </Helmet>

      <DashboardLayout role="client">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <ProjectBreadcrumb items={breadcrumbItems} />

          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
            <div className="flex items-center gap-3">
              {isAllWorkView && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setSearchParams({})}
                  className="shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <div>
                <h1 className="text-xl md:text-3xl font-bold text-foreground">
                  {isAllWorkView ? 'All Work' : 'My Projects'}
                </h1>
                <p className="text-sm md:text-base text-muted-foreground mt-1">
                  {isAllWorkView 
                    ? `${filteredProjects.length} videos across all projects`
                    : 'Track the progress of all your projects'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {!isAllWorkView && (
                <Button 
                  variant="outline" 
                  onClick={() => setSearchParams({ view: 'all' })}
                  className="gap-2"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden sm:inline">View All Work</span>
                </Button>
              )}
              <Button variant="hero" onClick={() => setProposalModalOpen(true)} className="flex-1 sm:flex-initial">
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4 md:mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FolderKanban className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Projects</p>
                  <p className="text-2xl font-bold text-foreground">{projects.length}</p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Send className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Proposals</p>
                  <p className="text-2xl font-bold text-foreground">
                    {projects.filter(p => p.status === 'proposal').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <AlertCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold text-foreground">
                    {projects.filter(p => p.status === 'in_progress').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Delivered</p>
                  <p className="text-2xl font-bold text-foreground">
                    {projects.filter(p => p.status === 'done').length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Content based on view mode */}
          {isAllWorkView ? (
            /* All Work List View - Shows all videos/projects */
            <div className="space-y-4">
              {filteredProjects.length === 0 ? (
                <div className="text-center py-12 rounded-xl border border-border bg-card">
                  <Video className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  {searchQuery ? (
                    <p className="text-muted-foreground">No work matches your search</p>
                  ) : (
                    <>
                      <p className="text-muted-foreground mb-4">No work in progress</p>
                      <Button variant="hero" onClick={() => setProposalModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Start Your First Project
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                filteredProjects.map((project) => {
                  const statusInfo = getStatusInfo(project.status);
                  const StatusIcon = statusInfo.icon;
                  
                  return (
                    <div
                      key={project.id}
                      onClick={() => setSelectedProjectId(project.id)}
                      className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">{project.title}</h3>
                          {project.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {project.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-3">
                            {project.due_date && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Due {format(new Date(project.due_date), 'MMM d, yyyy')}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className={statusInfo.className}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Projects Grid View - Shows project cards */
            <div className="space-y-4">
              {filteredProjects.length === 0 ? (
                <div className="text-center py-12 rounded-xl border border-border bg-card">
                  <FolderKanban className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  {searchQuery ? (
                    <p className="text-muted-foreground">No projects match your search</p>
                  ) : (
                    <>
                      <p className="text-muted-foreground mb-4">No projects yet</p>
                      <Button variant="hero" onClick={() => setProposalModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Start Your First Project
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredProjects.map((project) => {
                    const statusInfo = getStatusInfo(project.status);
                    const isActive = ['in_progress', 'review', 'backlog'].includes(project.status);
                    const isComplete = project.status === 'done';
                    
                    return (
                      <div
                        key={project.id}
                        onClick={() => setSelectedProjectId(project.id)}
                        className={cn(
                          'glass-card rounded-xl p-5 cursor-pointer transition-all duration-200',
                          'hover:border-primary/30 hover:shadow-glow-sm',
                          'active:scale-[0.98]'
                        )}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FolderKanban className="w-5 h-5 text-primary" />
                          </div>
                          <Badge variant="outline" className={cn('text-[10px]', statusInfo.className)}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                        
                        <h3 className="font-semibold text-foreground mb-1 line-clamp-1">
                          {project.title}
                        </h3>
                        
                        {project.description && (
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {project.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {isActive && <span className="text-primary">Active</span>}
                          {isComplete && <span className="text-success">Delivered</span>}
                        </div>
                        
                        {project.due_date && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                            <Clock className="w-3 h-3" />
                            Due {format(new Date(project.due_date), 'MMM d')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </DashboardLayout>

      {/* Proposal Modal */}
      <ClientProposalModal
        open={proposalModalOpen}
        onOpenChange={setProposalModalOpen}
        onSuccess={fetchProjects}
      />

      {/* Project Detail Sheet */}
      <ProjectDetailSheet
        projectId={selectedProjectId}
        open={!!selectedProjectId}
        onOpenChange={(open) => !open && setSelectedProjectId(null)}
        onProjectDeleted={fetchProjects}
      />
    </>
  );
}
