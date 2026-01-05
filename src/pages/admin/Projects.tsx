import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { useAuth } from '@/hooks/useAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { KanbanColumn, Project, ProjectStatus } from '@/components/projects/KanbanColumn';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2 } from 'lucide-react';

const COLUMNS: { id: ProjectStatus; title: string }[] = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Delivered' },
];

const AdminProjects = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
    if (!loading && userRole && userRole !== 'admin') {
      navigate(userRole === 'client' ? '/client/dashboard' : '/editor/dashboard');
    }
  }, [user, userRole, loading, navigate]);

  const fetchProjects = useCallback(async () => {
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

      // Fetch projects for this agency
      const { data: projectsData, error } = await supabase
        .from('projects')
        .select('*')
        .eq('agency_id', userRoleData.agency_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get client and editor info
      const projectsWithDetails: Project[] = await Promise.all(
        (projectsData || []).map(async (project) => {
          let clientName: string | undefined;
          let editorName: string | undefined;
          let editorAvatar: string | null | undefined;

          // Get client name
          if (project.client_id) {
            const { data: clientProfile } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', project.client_id)
              .maybeSingle();

            clientName = clientProfile?.full_name || clientProfile?.email;
          }

          // Get editor info
          const { data: projectEditor } = await supabase
            .from('project_editors')
            .select('editor_id')
            .eq('project_id', project.id)
            .maybeSingle();

          if (projectEditor?.editor_id) {
            const { data: editorProfile } = await supabase
              .from('profiles')
              .select('full_name, email, avatar_url')
              .eq('id', projectEditor.editor_id)
              .maybeSingle();

            editorName = editorProfile?.full_name || editorProfile?.email;
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
      fetchProjects();
    }
  }, [user, userRole, fetchProjects]);

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // Dropped outside a column
    if (!destination) return;

    // Dropped in same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const newStatus = destination.droppableId as ProjectStatus;

    // Optimistic update
    setProjects((prev) =>
      prev.map((p) =>
        p.id === draggableId ? { ...p, status: newStatus } : p
      )
    );

    // Update in database
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
      // Revert on error
      fetchProjects();
      toast({
        title: 'Error',
        description: 'Failed to update project status',
        variant: 'destructive',
      });
    }
  };

  const getProjectsByStatus = (status: ProjectStatus) =>
    projects.filter((p) => p.status === status);

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
        <title>Projects | Veylodesk</title>
        <meta name="description" content="Manage your agency projects with Kanban board." />
      </Helmet>

      <div className="min-h-screen bg-background flex">
        <AppSidebar role="admin" />

        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-6 border-b border-border/50">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Projects</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Drag and drop to update project status
              </p>
            </div>
            <Button
              onClick={() => setCreateModalOpen(true)}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>

          {/* Kanban Board */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex-1 overflow-x-auto p-6">
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex gap-6 min-w-max h-full">
                  {COLUMNS.map((column) => (
                    <KanbanColumn
                      key={column.id}
                      id={column.id}
                      title={column.title}
                      projects={getProjectsByStatus(column.id)}
                      onProjectClick={(project) => {
                        // TODO: Open project detail modal
                        console.log('Clicked project:', project);
                      }}
                    />
                  ))}
                </div>
              </DragDropContext>
            </div>
          )}
        </main>
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={fetchProjects}
      />
    </>
  );
};

export default AdminProjects;