import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { KanbanColumn, Project, ProjectStatus } from '@/components/projects/KanbanColumn';
import { WorkspaceCard } from '@/components/projects/WorkspaceCard';
import { ProjectListView } from '@/components/projects/ProjectListView';
import { ProjectFilters, ViewMode } from '@/components/projects/ProjectFilters';
import { ProjectBreadcrumb } from '@/components/projects/ProjectBreadcrumb';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { ProjectDetailSheet } from '@/components/projects/ProjectDetailSheet';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, ArrowLeft, LayoutGrid } from 'lucide-react';

const COLUMNS: { id: ProjectStatus; title: string }[] = [
  { id: 'proposal', title: 'Proposals' },
  { id: 'backlog', title: 'Backlog' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Delivered' },
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
  const [workspaces, setWorkspaces] = useState<ClientWorkspace[]>([]);
  const [editors, setEditors] = useState<EditorInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  // Filter state
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [clientFilter, setClientFilter] = useState<string | 'all'>('all');
  const [editorFilter, setEditorFilter] = useState<string | 'all' | 'my_work'>('all');
  const [showArchived, setShowArchived] = useState(false);

  // Get current workspace from URL
  const selectedClientId = searchParams.get('workspace');
  const isGlobalView = !selectedClientId;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
    if (!loading && userRole && userRole !== 'admin') {
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

      // Fetch all projects
      const { data: projectsData, error } = await supabase
        .from('projects')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Build project details and workspace stats
      const clientProjectCounts: Record<string, { total: number; active: number; completed: number }> = {};
      
      const projectsWithDetails: Project[] = await Promise.all(
        (projectsData || []).map(async (project) => {
          let clientName: string | undefined;
          let editorName: string | undefined;
          let editorAvatar: string | null | undefined;

          // Get client name
          if (project.client_id) {
            const client = clientProfiles.find(c => c.id === project.client_id);
            clientName = client?.full_name || client?.email;

            // Track workspace stats
            if (!clientProjectCounts[project.client_id]) {
              clientProjectCounts[project.client_id] = { total: 0, active: 0, completed: 0 };
            }
            clientProjectCounts[project.client_id].total++;
            if (['in_progress', 'review', 'backlog'].includes(project.status)) {
              clientProjectCounts[project.client_id].active++;
            }
            if (project.status === 'done') {
              clientProjectCounts[project.client_id].completed++;
            }
          }

          // Get editor info
          const { data: projectEditor } = await supabase
            .from('project_editors')
            .select('editor_id')
            .eq('project_id', project.id)
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
            id: project.id,
            title: project.title,
            description: project.description,
            client_id: project.client_id,
            client_name: clientName,
            editor_id: projectEditor?.editor_id,
            editor_name: editorName,
            editor_avatar: editorAvatar,
            due_date: project.due_date,
            status: project.status as ProjectStatus,
          };
        })
      );

      setProjects(projectsWithDetails);

      // Build workspaces from clients
      const workspaceList: ClientWorkspace[] = clientProfiles.map(client => ({
        id: client.id,
        name: client.full_name || client.email,
        email: client.email,
        avatar: client.avatar_url,
        projectCount: clientProjectCounts[client.id]?.total || 0,
        activeCount: clientProjectCounts[client.id]?.active || 0,
        completedCount: clientProjectCounts[client.id]?.completed || 0,
      }));

      setWorkspaces(workspaceList.sort((a, b) => b.projectCount - a.projectCount));
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

  // Filter projects
  const filteredProjects = useMemo(() => {
    let result = projects;

    // Filter by workspace/client
    if (selectedClientId) {
      result = result.filter(p => p.client_id === selectedClientId);
    }

    // Filter by client (in global view)
    if (isGlobalView && clientFilter !== 'all') {
      result = result.filter(p => p.client_id === clientFilter);
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

    // Filter archived (done/cancelled)
    if (!showArchived) {
      result = result.filter(p => !['done', 'cancelled'].includes(p.status));
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
  }, [projects, selectedClientId, isGlobalView, clientFilter, statusFilter, editorFilter, showArchived, searchQuery, user?.id]);

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const newStatus = destination.droppableId as ProjectStatus;

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

  const openWorkspace = (clientId: string) => {
    setSearchParams({ workspace: clientId });
    setClientFilter('all');
  };

  const closeWorkspace = () => {
    setSearchParams({});
  };

  const currentWorkspace = selectedClientId 
    ? workspaces.find(w => w.id === selectedClientId) 
    : null;

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
        <title>{currentWorkspace ? `${currentWorkspace.name} - Projects` : 'Projects'} | Veylodesk</title>
        <meta name="description" content="Manage your agency projects with Kanban board." />
      </Helmet>

      <DashboardLayout role="admin">
        {/* Breadcrumb Navigation */}
        <ProjectBreadcrumb 
          items={[
            { label: 'Projects', href: '/admin/projects', icon: 'projects' },
            ...(currentWorkspace ? [{ label: currentWorkspace.name, icon: 'client' as const }] : []),
          ]} 
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            {currentWorkspace && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={closeWorkspace}
                className="shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground">
                {currentWorkspace ? currentWorkspace.name : 'Client Workspaces'}
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                {currentWorkspace 
                  ? `${currentWorkspace.projectCount} projects • ${currentWorkspace.activeCount} active`
                  : `${workspaces.length} clients • ${projects.length} total projects`
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isGlobalView && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchParams({ workspace: 'all' });
                }}
                className="gap-2"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">View All Projects</span>
              </Button>
            )}
            <Button
              onClick={() => setCreateModalOpen(true)}
              className="bg-primary hover:bg-primary/90 flex-1 sm:flex-initial"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : isGlobalView && searchParams.get('workspace') !== 'all' ? (
          /* Workspace Cards View */
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
                    onClick={() => openWorkspace(workspace.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Project Board/List View */
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
                    {COLUMNS.filter(col => showArchived || !['done', 'cancelled'].includes(col.id)).map((column) => (
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
                showClient={!currentWorkspace}
              />
            )}
          </div>
        )}
      </DashboardLayout>

      <CreateProjectModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={fetchData}
      />

      <ProjectDetailSheet
        projectId={selectedProjectId}
        open={!!selectedProjectId}
        onOpenChange={(open) => !open && setSelectedProjectId(null)}
        onProjectDeleted={fetchData}
      />
    </>
  );
};

export default AdminProjects;
