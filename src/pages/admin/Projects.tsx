import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { KanbanColumn, Project, ProjectStatus } from '@/components/projects/KanbanColumn';
import { WorkspaceCard } from '@/components/projects/WorkspaceCard';
import { ClientProjectsGrid } from '@/components/projects/ClientProjectsGrid';
import { ProjectListView } from '@/components/projects/ProjectListView';
import { ProjectFilters, ViewMode } from '@/components/projects/ProjectFilters';
import { ProjectBreadcrumb } from '@/components/projects/ProjectBreadcrumb';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { CreateProjectContainerModal } from '@/components/projects/CreateProjectContainerModal';
import { ProjectDetailSheet } from '@/components/projects/ProjectDetailSheet';
import { DeliverVideoModal } from '@/components/projects/DeliverVideoModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, ArrowLeft, LayoutGrid, Video } from 'lucide-react';

const COLUMNS: { id: ProjectStatus; title: string }[] = [
  { id: 'request', title: 'Requests' },
  { id: 'proposal', title: 'Proposals' },
  { id: 'backlog', title: 'Backlog' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'quality_check', title: 'Quality Check' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Delivered' },
  { id: 'paid', title: 'Paid' },
  { id: 'archived', title: 'Archived' },
];

interface ClientWorkspace {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  projectCount: number;
  activeCount: number;
  completedCount: number;
}

interface ProjectContainer {
  id: string;
  title: string;
  description?: string | null;
  client_id: string | null;
  managed_client_id?: string | null;
  videoCount: number;
  activeCount: number;
  completedCount: number;
}

interface EditorInfo {
  id: string;
  name: string;
}

const AdminProjects = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  
  // View state
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectContainers, setProjectContainers] = useState<ProjectContainer[]>([]);
  const [workspaces, setWorkspaces] = useState<ClientWorkspace[]>([]);
  const [editors, setEditors] = useState<EditorInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createVideoModalOpen, setCreateVideoModalOpen] = useState(false);
  const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [deliverModalProject, setDeliverModalProject] = useState<{ id: string; title: string } | null>(null);
  
  // Filter state
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [clientFilter, setClientFilter] = useState<string | 'all'>('all');
  const [editorFilter, setEditorFilter] = useState<string | 'all' | 'my_work'>('all');
  const [showArchived, setShowArchived] = useState(false);

  // URL parameters for navigation
  const selectedClientId = searchParams.get('workspace');
  const selectedProjectContainerId = searchParams.get('project');
  const isGlobalView = searchParams.get('workspace') === 'all';
  const isWorkspaceLanding = !selectedClientId;
  const isClientProjectsView = selectedClientId && !selectedProjectContainerId && selectedClientId !== 'all';
  const isProjectBoardView = selectedClientId && selectedProjectContainerId;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
    if (!loading && userRole && userRole !== 'admin' && userRole !== 'staff') {
      navigate(userRole === 'client' ? '/client/dashboard' : '/editor/dashboard');
    }
  }, [user, userRole, loading, navigate]);

  const fetchData = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Get agency_id
      const { data: userRoleData } = await supabase
        .from('user_roles')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRoleData?.agency_id) {
        setIsLoading(false);
        return;
      }

      const agencyId = userRoleData.agency_id;

      // Fetch all clients in this agency
      const { data: clientRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('agency_id', agencyId)
        .eq('role', 'client');

      const clientIds = clientRoles?.map(r => r.user_id) || [];

      // Fetch client profiles
      let clientProfiles: any[] = [];
      if (clientIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', clientIds);
        clientProfiles = data || [];
      }

      // Fetch managed (manual, not-yet-activated) clients — treated as workspaces too
      const { data: managedClientsData } = await supabase
        .from('managed_clients')
        .select('id, full_name, email')
        .eq('agency_id', agencyId)
        .is('converted_profile_id', null);
      const managedClients = managedClientsData || [];


      // Fetch all editors in this agency
      const { data: editorRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('agency_id', agencyId)
        .eq('role', 'editor');

      const editorIds = editorRoles?.map(r => r.user_id) || [];
      let editorProfiles: any[] = [];
      if (editorIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', editorIds);
        editorProfiles = data || [];
      }
      
      setEditors(editorProfiles.map(e => ({ 
        id: e.id, 
        name: e.full_name || e.email 
      })));

      // Fetch all videos (projects table) - these are the work items
      const { data: videosData, error: videosError } = await supabase
        .from('projects')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (videosError) throw videosError;

      // Fetch all project containers
      const { data: containersData, error: containersError } = await supabase
        .from('project_containers')
        .select('*')
        .eq('agency_id', agencyId)
        .order('title', { ascending: true });

      if (containersError) throw containersError;

      // Track stats for workspaces (client level) and containers
      const clientStats: Record<string, { total: number; active: number; completed: number }> = {};
      const containerStats: Record<string, { total: number; active: number; completed: number }> = {};

      // Build video details (projects are videos in this hierarchy)
      const videosWithDetails: Project[] = await Promise.all(
        (videosData || []).map(async (video) => {
          let clientName: string | undefined;
          let editorName: string | undefined;
          let editorAvatar: string | null | undefined;

          // Resolve client name (real or managed) + track workspace stats
          const workspaceKey: string | null = video.client_id
            ? video.client_id
            : video.managed_client_id
              ? `mc:${video.managed_client_id}`
              : null;

          if (video.client_id) {
            const client = clientProfiles.find(c => c.id === video.client_id);
            clientName = client?.full_name || client?.email;
          } else if (video.managed_client_id) {
            const mc = managedClients.find((m: any) => m.id === video.managed_client_id);
            clientName = mc ? `${mc.full_name || mc.email} (Manual)` : undefined;
          }

          if (workspaceKey) {
            if (!clientStats[workspaceKey]) {
              clientStats[workspaceKey] = { total: 0, active: 0, completed: 0 };
            }
            clientStats[workspaceKey].total++;
            if (['in_progress', 'review', 'backlog'].includes(video.status)) {
              clientStats[workspaceKey].active++;
            }
            if (video.status === 'done') {
              clientStats[workspaceKey].completed++;
            }
          }

          // Track container stats
          if (video.container_id) {
            if (!containerStats[video.container_id]) {
              containerStats[video.container_id] = { total: 0, active: 0, completed: 0 };
            }
            containerStats[video.container_id].total++;
            if (['in_progress', 'review', 'backlog'].includes(video.status)) {
              containerStats[video.container_id].active++;
            }
            if (video.status === 'done') {
              containerStats[video.container_id].completed++;
            }
          }

          // Get editor info
          const { data: projectEditor } = await supabase
            .from('project_editors')
            .select('editor_id')
            .eq('project_id', video.id)
            .maybeSingle();

          if (projectEditor?.editor_id) {
            const editor = editorProfiles.find(e => e.id === projectEditor.editor_id);
            editorName = editor?.full_name || editor?.email;
            
            const { data: editorProfile } = await supabase
              .from('profiles')
              .select('avatar_url')
              .eq('id', projectEditor.editor_id)
              .maybeSingle();
            editorAvatar = editorProfile?.avatar_url;
          }

          return {
            id: video.id,
            title: video.title,
            description: video.description,
            client_id: video.client_id,
            managed_client_id: video.managed_client_id,
            client_name: clientName,
            container_id: video.container_id,
            editor_id: projectEditor?.editor_id,
            editor_name: editorName,
            editor_avatar: editorAvatar,
            due_date: video.due_date,
            status: video.status as ProjectStatus,
          };
        })
      );

      setProjects(videosWithDetails);

      // Build workspaces from real clients
      const workspaceList: ClientWorkspace[] = clientProfiles.map(client => ({
        id: client.id,
        name: client.full_name || client.email,
        email: client.email,
        avatar: client.avatar_url,
        projectCount: clientStats[client.id]?.total || 0,
        activeCount: clientStats[client.id]?.active || 0,
        completedCount: clientStats[client.id]?.completed || 0,
      }));

      // Add manual clients as workspaces (mc: prefix)
      for (const mc of managedClients as any[]) {
        const key = `mc:${mc.id}`;
        workspaceList.push({
          id: key,
          name: `${mc.full_name || mc.email} (Manual)`,
          email: mc.email,
          avatar: null,
          projectCount: clientStats[key]?.total || 0,
          activeCount: clientStats[key]?.active || 0,
          completedCount: clientStats[key]?.completed || 0,
        });
      }

      setWorkspaces(workspaceList.sort((a, b) => b.projectCount - a.projectCount));

      // Build project containers list from the actual project_containers table
      const containersList: ProjectContainer[] = (containersData || []).map(container => ({
        id: container.id,
        title: container.title,
        description: container.description,
        client_id: container.client_id,
        managed_client_id: (container as any).managed_client_id,
        videoCount: containerStats[container.id]?.total || 0,
        activeCount: containerStats[container.id]?.active || 0,
        completedCount: containerStats[container.id]?.completed || 0,
      }));

      setProjectContainers(containersList);


    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: 'Error',
        description: 'Failed to load projects',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user && userRole === 'admin') {
      fetchData();
    }
  }, [user, userRole, fetchData]);

  // Filter projects based on current view and filters
  const filteredProjects = useMemo(() => {
    let result = projects;

    // Filter by specific project container (project board view) - show videos in that container
    if (selectedProjectContainerId) {
      result = result.filter(p => p.container_id === selectedProjectContainerId);
    }
    // Filter by client workspace (handles mc: managed prefix)
    else if (selectedClientId && selectedClientId !== 'all') {
      if (selectedClientId.startsWith('mc:')) {
        const mid = selectedClientId.slice(3);
        result = result.filter(p => p.managed_client_id === mid);
      } else {
        result = result.filter(p => p.client_id === selectedClientId);
      }
    }

    // Additional filters for global view
    if (isGlobalView && clientFilter !== 'all') {
      if (clientFilter.startsWith('mc:')) {
        const mid = clientFilter.slice(3);
        result = result.filter(p => p.managed_client_id === mid);
      } else {
        result = result.filter(p => p.client_id === clientFilter);
      }
    }

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }

    // Filter by editor
    if (editorFilter === 'my_work') {
      result = result.filter(p => p.editor_id === user?.id);
    } else if (editorFilter !== 'all') {
      result = result.filter(p => p.editor_id === editorFilter);
    }

    // Filter archived (paid/archived/cancelled)
    if (!showArchived) {
      result = result.filter(p => !['done', 'paid', 'archived', 'cancelled'].includes(p.status));
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.title.toLowerCase().includes(query) ||
        p.client_name?.toLowerCase().includes(query) ||
        p.editor_name?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [projects, selectedClientId, selectedProjectContainerId, isGlobalView, clientFilter, statusFilter, editorFilter, showArchived, searchQuery, user?.id]);

  // Get project containers for a specific client (for ClientProjectsGrid)
  const clientProjectContainers = useMemo(() => {
    if (!selectedClientId || selectedClientId === 'all') return [];
    
    return projectContainers.filter(c => c.client_id === selectedClientId);
  }, [projectContainers, selectedClientId]);

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const newStatus = destination.droppableId as ProjectStatus;
    const oldStatus = source.droppableId as ProjectStatus;

    // Intercept QC → Review: show the DeliverVideoModal instead (only admin can send to review)
    if (oldStatus === 'quality_check' && newStatus === 'review') {
      const project = projects.find(p => p.id === draggableId);
      if (project) {
        setDeliverModalProject({ id: project.id, title: project.title });
      }
      return; // Don't move yet — modal handles it
    }

    // Optimistic update
    setProjects((prev) =>
      prev.map((p) =>
        p.id === draggableId ? { ...p, status: newStatus } : p
      )
    );

    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', draggableId);

      if (error) throw error;

      toast({
        title: 'Project moved',
        description: `Moved to ${COLUMNS.find((c) => c.id === newStatus)?.title}`,
      });
    } catch (error: any) {
      fetchData();
      toast({
        title: 'Error',
        description: 'Failed to update project status',
        variant: 'destructive',
      });
    }
  };

  const getProjectsByStatus = (status: ProjectStatus) =>
    filteredProjects.filter((p) => p.status === status);

  // Navigation handlers
  const openClientWorkspace = (clientId: string) => {
    setSearchParams({ workspace: clientId });
  };

  const openProjectBoard = (projectId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('project', projectId);
    setSearchParams(params);
  };

  const goBack = () => {
    if (selectedProjectContainerId) {
      // Go back to client projects view
      const params = new URLSearchParams(searchParams);
      params.delete('project');
      setSearchParams(params);
    } else if (selectedClientId) {
      // Go back to workspace landing
      setSearchParams({});
    }
  };

  const openGlobalView = () => {
    setSearchParams({ workspace: 'all' });
  };

  // Get current context for breadcrumbs and headers
  const currentWorkspace = selectedClientId && selectedClientId !== 'all'
    ? workspaces.find(w => w.id === selectedClientId) 
    : null;

  const currentProjectContainer = selectedProjectContainerId
    ? projectContainers.find(c => c.id === selectedProjectContainerId)
    : null;

  // Build breadcrumb items
  const breadcrumbItems = useMemo(() => {
    const items: { label: string; href?: string; icon?: 'home' | 'projects' | 'client' }[] = [
      { label: 'Clients', href: '/admin/projects', icon: 'projects' },
    ];

    if (isGlobalView) {
      items.push({ label: 'All Projects' });
    } else if (currentWorkspace) {
      items.push({ 
        label: currentWorkspace.name, 
        href: `/admin/projects?workspace=${currentWorkspace.id}`,
        icon: 'client' 
      });
      
      if (currentProjectContainer) {
        items.push({ label: currentProjectContainer.title });
      }
    }

    return items;
  }, [isGlobalView, currentWorkspace, currentProjectContainer]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>
          {currentProjectContainer 
            ? `${currentProjectContainer.title} - Projects` 
            : currentWorkspace 
              ? `${currentWorkspace.name} - Projects`
              : isGlobalView 
                ? 'All Projects'
                : 'Client Workspaces'
          } | Veylodesk
        </title>
        <meta name="description" content="Manage your agency projects with Kanban board." />
      </Helmet>

      <DashboardLayout role="admin">
        {/* Breadcrumb Navigation */}
        <ProjectBreadcrumb items={breadcrumbItems} />

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            {(selectedClientId || selectedProjectContainerId) && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={goBack}
                className="shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground">
                {currentProjectContainer
                  ? currentProjectContainer.title
                  : currentWorkspace 
                    ? `${currentWorkspace.name}'s Projects`
                    : isGlobalView 
                      ? 'All Projects' 
                      : 'Client Workspaces'
                }
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                {currentProjectContainer
                  ? `Video board for ${currentWorkspace?.name || 'client'}`
                  : currentWorkspace 
                    ? `${clientProjectContainers.length} project${clientProjectContainers.length !== 1 ? 's' : ''}`
                    : isGlobalView
                      ? `${projects.length} total videos across all clients`
                      : `${workspaces.length} clients • ${projectContainers.length} total projects`
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isWorkspaceLanding && (
              <Button
                variant="outline"
                onClick={openGlobalView}
                className="gap-2"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">View All Projects</span>
              </Button>
            )}
            
            {/* Show appropriate create button based on view */}
            {(isProjectBoardView || isGlobalView) ? (
              <Button
                onClick={() => setCreateVideoModalOpen(true)}
                className="bg-primary hover:bg-primary/90 flex-1 sm:flex-initial"
              >
                <Video className="w-4 h-4 mr-2" />
                New Video
              </Button>
            ) : null}
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : isWorkspaceLanding ? (
          /* Workspace Cards View (Level 1: Clients) */
          <div className="space-y-6">
            {workspaces.length === 0 ? (
              <div className="text-center py-16">
                <LayoutGrid className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No clients yet</h3>
                <p className="text-muted-foreground mb-4">
                  Invite clients to start creating project workspaces.
                </p>
                <Button variant="outline" onClick={() => navigate('/admin/clients')}>
                  Manage Clients
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {workspaces.map((workspace) => (
                  <WorkspaceCard
                    key={workspace.id}
                    clientId={workspace.id}
                    clientName={workspace.name}
                    clientAvatar={workspace.avatar}
                    clientEmail={workspace.email}
                    projectCount={workspace.projectCount}
                    activeCount={workspace.activeCount}
                    completedCount={workspace.completedCount}
                    onClick={() => openClientWorkspace(workspace.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : isClientProjectsView && currentWorkspace ? (
          /* Client Projects Grid (Level 2: Project Containers within a Client) */
          <ClientProjectsGrid
            clientName={currentWorkspace.name}
            clientAvatar={currentWorkspace.avatar}
            projects={clientProjectContainers}
            onProjectClick={(containerId) => openProjectBoard(containerId)}
            onCreateProject={() => setCreateProjectModalOpen(true)}
            onProjectDeleted={fetchData}
          />
        ) : (
          /* Project Board/List View (Level 3: Videos within a Project OR Global View) */
          <div className="space-y-4">
            <ProjectFilters
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              clientFilter={clientFilter}
              onClientFilterChange={setClientFilter}
              editorFilter={editorFilter}
              onEditorFilterChange={setEditorFilter}
              clients={workspaces.map(w => ({ id: w.id, name: w.name }))}
              editors={editors}
              currentUserId={user?.id}
              showArchived={showArchived}
              onShowArchivedChange={setShowArchived}
            />

            {viewMode === 'kanban' ? (
              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                <DragDropContext onDragEnd={handleDragEnd}>
                  <div className="flex gap-4 md:gap-6 min-w-max pb-4 hide-scrollbar-mobile">
                    {COLUMNS.filter(col => showArchived || !['done', 'paid', 'archived', 'cancelled'].includes(col.id)).map((column) => (
                      <KanbanColumn
                        key={column.id}
                        id={column.id}
                        title={column.title}
                        projects={getProjectsByStatus(column.id)}
                        onProjectClick={(project) => {
                          setSelectedProjectId(project.id);
                        }}
                      />
                    ))}
                  </div>
                </DragDropContext>
              </div>
            ) : (
              <ProjectListView
                projects={filteredProjects}
                onProjectClick={(project) => setSelectedProjectId(project.id)}
                showClient={isGlobalView}
              />
            )}
          </div>
        )}
      </DashboardLayout>

      {/* Create Video Modal (Full video creation with all details) */}
      <CreateProjectModal
        open={createVideoModalOpen}
        onOpenChange={setCreateVideoModalOpen}
        onSuccess={fetchData}
        preselectedClientId={selectedClientId && selectedClientId !== 'all' ? selectedClientId : undefined}
        preselectedContainerId={selectedProjectContainerId || undefined}
      />

      {/* Create Project Container Modal (Simple container creation) */}
      <CreateProjectContainerModal
        open={createProjectModalOpen}
        onOpenChange={setCreateProjectModalOpen}
        onSuccess={fetchData}
        preselectedClientId={selectedClientId && selectedClientId !== 'all' ? selectedClientId : undefined}
      />

      {/* Project Detail Sheet */}
      <ProjectDetailSheet
        projectId={selectedProjectId}
        open={!!selectedProjectId}
        onOpenChange={(open) => !open && setSelectedProjectId(null)}
        onProjectDeleted={fetchData}
      />

      {/* Deliver Video Modal (QC → Done) */}
      {deliverModalProject && (
        <DeliverVideoModal
          open={!!deliverModalProject}
          onOpenChange={(open) => !open && setDeliverModalProject(null)}
          projectId={deliverModalProject.id}
          projectTitle={deliverModalProject.title}
          onSuccess={fetchData}
        />
      )}
    </>
  );
};

export default AdminProjects;
