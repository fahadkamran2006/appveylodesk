import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { FolderKanban, Clock, CheckCircle, AlertCircle, Send, Plus, Search, ArrowLeft, LayoutGrid, Video, List } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ClientCreateProjectModal } from '@/components/projects/ClientCreateProjectModal';
import { ClientProposalModal } from '@/components/projects/ClientProposalModal';
import { ProjectDetailSheet } from '@/components/projects/ProjectDetailSheet';
import { ProjectBreadcrumb } from '@/components/projects/ProjectBreadcrumb';
import { cn } from '@/lib/utils';

interface ProjectContainer {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
}

interface ProjectContainerStats extends ProjectContainer {
  videoCount: number;
  activeCount: number;
  completedCount: number;
}

interface VideoProject {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  budget: number | null;
  container_id: string | null;
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
  
  const [projectContainers, setProjectContainers] = useState<ProjectContainerStats[]>([]);
  const [videos, setVideos] = useState<VideoProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false);
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Determine current view from URL params
  const selectedProjectId = searchParams.get('project');
  const viewMode = searchParams.get('view');
  const isAllVideosView = viewMode === 'all';
  const isProjectBoardView = !!selectedProjectId;
  const isProjectListView = !isAllVideosView && !isProjectBoardView;

  // Get current project container details
  const currentProject = useMemo(() => {
    return projectContainers.find(p => p.id === selectedProjectId);
  }, [projectContainers, selectedProjectId]);

  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch project containers
      const { data: containersData, error: containersError } = await supabase
        .from('project_containers')
        .select('id, title, description, created_at')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      if (containersError) throw containersError;

      // Fetch all videos for this client
      const { data: videosData, error: videosError } = await supabase
        .from('projects')
        .select('id, title, description, status, due_date, budget, container_id')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      if (videosError) throw videosError;
      setVideos(videosData || []);

      // Build stats for each container
      const containerStats: ProjectContainerStats[] = (containersData || []).map(container => {
        const containerVideos = (videosData || []).filter(v => v.container_id === container.id);
        return {
          ...container,
          videoCount: containerVideos.length,
          activeCount: containerVideos.filter(v => ['in_progress', 'review', 'backlog', 'proposal'].includes(v.status)).length,
          completedCount: containerVideos.filter(v => v.status === 'done').length,
        };
      });

      setProjectContainers(containerStats);
    } catch (error) {
      console.error('Error fetching data:', error);
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
      fetchData();
    }
  }, [user, userRole, fetchData]);

  // Filter videos based on current view
  const filteredVideos = useMemo(() => {
    let result = videos;

    // Filter by project if in project board view
    if (isProjectBoardView && selectedProjectId) {
      result = result.filter(v => v.container_id === selectedProjectId);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(video =>
        video.title.toLowerCase().includes(query) ||
        video.description?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [videos, isProjectBoardView, selectedProjectId, searchQuery]);

  // Filter project containers for search
  const filteredContainers = useMemo(() => {
    if (!searchQuery) return projectContainers;
    const query = searchQuery.toLowerCase();
    return projectContainers.filter(container =>
      container.title.toLowerCase().includes(query) ||
      container.description?.toLowerCase().includes(query)
    );
  }, [projectContainers, searchQuery]);

  const getStatusInfo = (status: string) => {
    return statusConfig[status] || statusConfig.backlog;
  };

  // Build breadcrumb items
  const breadcrumbItems = useMemo(() => {
    const items: { label: string; href?: string; icon?: 'home' | 'projects' | 'client' }[] = [
      { label: 'My Projects', href: '/client/projects', icon: 'projects' },
    ];

    if (isAllVideosView) {
      items.push({ label: 'All Videos' });
    } else if (isProjectBoardView && currentProject) {
      items.push({ label: currentProject.title });
    }

    return items;
  }, [isAllVideosView, isProjectBoardView, currentProject]);

  const handleBack = () => {
    setSearchParams({});
    setSearchQuery('');
  };

  const handleProjectClick = (containerId: string) => {
    setSearchParams({ project: containerId });
    setSearchQuery('');
  };

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
        <title>
          {isProjectBoardView && currentProject 
            ? `${currentProject.title} | Veylodesk`
            : isAllVideosView 
              ? 'All Videos | Veylodesk'
              : 'My Projects | Veylodesk'
          }
        </title>
        <meta name="description" content="View and track your project progress" />
      </Helmet>

      <DashboardLayout role="client">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <ProjectBreadcrumb items={breadcrumbItems} />

          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
            <div className="flex items-center gap-3">
              {(isProjectBoardView || isAllVideosView) && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleBack}
                  className="shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <div>
                <h1 className="text-xl md:text-3xl font-bold text-foreground">
                  {isProjectBoardView && currentProject 
                    ? currentProject.title
                    : isAllVideosView 
                      ? 'All Videos'
                      : 'My Projects'
                  }
                </h1>
                <p className="text-sm md:text-base text-muted-foreground mt-1">
                  {isProjectBoardView
                    ? `${filteredVideos.length} videos in this project`
                    : isAllVideosView 
                      ? `${filteredVideos.length} videos across all projects`
                      : 'Organize your video work into projects'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {isProjectListView && (
                <Button 
                  variant="outline" 
                  onClick={() => setSearchParams({ view: 'all' })}
                  className="gap-2"
                >
                  <List className="w-4 h-4" />
                  <span className="hidden sm:inline">All Videos</span>
                </Button>
              )}
              {isProjectBoardView ? (
                <Button variant="hero" onClick={() => setProposalModalOpen(true)} className="flex-1 sm:flex-initial">
                  <Plus className="w-4 h-4 mr-2" />
                  New Video
                </Button>
              ) : (
                <Button variant="hero" onClick={() => setCreateProjectModalOpen(true)} className="flex-1 sm:flex-initial">
                  <Plus className="w-4 h-4 mr-2" />
                  New Project
                </Button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4 md:mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={isProjectBoardView || isAllVideosView ? "Search videos..." : "Search projects..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Content based on view mode */}
          {isProjectListView ? (
            /* Project Containers Grid */
            <div className="space-y-4">
              {filteredContainers.length === 0 ? (
                <div className="text-center py-12 rounded-xl border border-border bg-card">
                  <FolderKanban className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  {searchQuery ? (
                    <p className="text-muted-foreground">No projects match your search</p>
                  ) : (
                    <>
                      <p className="text-muted-foreground mb-4">No projects yet</p>
                      <Button variant="hero" onClick={() => setCreateProjectModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Your First Project
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredContainers.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => handleProjectClick(project.id)}
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
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Video className="w-3 h-3" />
                          {project.videoCount}
                        </span>
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
                        {project.activeCount > 0 && (
                          <span className="text-primary">{project.activeCount} active</span>
                        )}
                        {project.completedCount > 0 && (
                          <span className="text-success">{project.completedCount} done</span>
                        )}
                        {project.videoCount === 0 && (
                          <span className="text-muted-foreground">No videos yet</span>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Add Project Card */}
                  <div
                    onClick={() => setCreateProjectModalOpen(true)}
                    className={cn(
                      'rounded-xl p-5 cursor-pointer transition-all duration-200',
                      'border-2 border-dashed border-border hover:border-primary/50',
                      'hover:bg-primary/5 flex flex-col items-center justify-center min-h-[150px]'
                    )}
                  >
                    <Plus className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm font-medium text-muted-foreground">Add Project</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Videos List (for both project board and all videos view) */
            <div className="space-y-4">
              {filteredVideos.length === 0 ? (
                <div className="text-center py-12 rounded-xl border border-border bg-card">
                  <Video className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  {searchQuery ? (
                    <p className="text-muted-foreground">No videos match your search</p>
                  ) : (
                    <>
                      <p className="text-muted-foreground mb-4">No videos in this project yet</p>
                      {isProjectBoardView && (
                        <Button variant="hero" onClick={() => setProposalModalOpen(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Submit Your First Video
                        </Button>
                      )}
                    </>
                  )}
                </div>
              ) : (
                filteredVideos.map((video) => {
                  const statusInfo = getStatusInfo(video.status);
                  const StatusIcon = statusInfo.icon;
                  
                  return (
                    <div
                      key={video.id}
                      onClick={() => setSelectedVideoId(video.id)}
                      className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">{video.title}</h3>
                          {video.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {video.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-3">
                            {video.due_date && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Due {format(new Date(video.due_date), 'MMM d, yyyy')}
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
          )}
        </div>
      </DashboardLayout>

      {/* Create Project Modal (for project containers) */}
      <ClientCreateProjectModal
        open={createProjectModalOpen}
        onOpenChange={setCreateProjectModalOpen}
        onSuccess={fetchData}
      />

      {/* Proposal Modal (for creating videos within a project) */}
      <ClientProposalModal
        open={proposalModalOpen}
        onOpenChange={setProposalModalOpen}
        onSuccess={fetchData}
        preselectedContainerId={selectedProjectId || undefined}
      />

      {/* Video Detail Sheet */}
      <ProjectDetailSheet
        projectId={selectedVideoId}
        open={!!selectedVideoId}
        onOpenChange={(open) => !open && setSelectedVideoId(null)}
        onProjectDeleted={fetchData}
      />
    </>
  );
}
