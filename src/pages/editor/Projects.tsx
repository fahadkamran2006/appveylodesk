import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Clock, Upload } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { EditorSidebar } from '@/components/editor/EditorSidebar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

type ProjectStatus = 'backlog' | 'in_progress' | 'review' | 'done';

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  due_date: string | null;
  editor_rate: number | null;
}

const COLUMNS: { id: ProjectStatus; title: string }[] = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Done' },
];

const columnStyles: Record<ProjectStatus, string> = {
  backlog: 'border-muted-foreground/30',
  in_progress: 'border-primary/50',
  review: 'border-amber-500/50',
  done: 'border-emerald-500/50',
};

export default function EditorProjects() {
  const navigate = useNavigate();
  const { user, userRole, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!user) return;

    try {
      // Get projects where this editor is assigned
      const { data: assignments, error: assignError } = await supabase
        .from('project_editors')
        .select('project_id')
        .eq('editor_id', user.id);

      if (assignError) throw assignError;

      if (!assignments || assignments.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }

      const projectIds = assignments.map(a => a.project_id);

      const { data, error } = await supabase
        .from('projects')
        .select('id, title, description, status, due_date, editor_rate')
        .in('id', projectIds)
        .in('status', ['backlog', 'in_progress', 'review', 'done'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects((data || []) as Project[]);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth/login');
    } else if (!authLoading && userRole && userRole !== 'editor' && userRole !== 'admin') {
      navigate(`/${userRole}/dashboard`);
    }
  }, [user, userRole, authLoading, navigate]);

  useEffect(() => {
    if (user && (userRole === 'editor' || userRole === 'admin')) {
      fetchProjects();
    }
  }, [user, userRole, fetchProjects]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const newStatus = destination.droppableId as ProjectStatus;

    // Optimistic update
    setProjects(prev =>
      prev.map(p =>
        p.id === draggableId ? { ...p, status: newStatus } : p
      )
    );

    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', draggableId);

      if (error) throw error;

      toast({
        title: 'Project updated',
        description: `Moved to ${COLUMNS.find(c => c.id === newStatus)?.title}`,
      });
    } catch (error) {
      console.error('Error updating project:', error);
      fetchProjects(); // Revert on error
      toast({
        title: 'Error',
        description: 'Failed to update project status',
        variant: 'destructive',
      });
    }
  };

  const getProjectsByStatus = (status: ProjectStatus) =>
    projects.filter(p => p.status === status);

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
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
        <title>My Projects | Veylodesk</title>
        <meta name="description" content="Manage your assigned projects and upload deliverables" />
      </Helmet>

      <div className="flex min-h-screen bg-background">
        <EditorSidebar />

        <main className="flex-1 p-8 overflow-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">My Projects</h1>
            <p className="text-muted-foreground mt-1">
              Manage your assigned projects and upload deliverables
            </p>
          </div>

          {/* Kanban Board */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-4 gap-4 min-h-[600px]">
              {COLUMNS.map((column) => (
                <div key={column.id} className="flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-foreground">{column.title}</h3>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                      {getProjectsByStatus(column.id).length}
                    </span>
                  </div>

                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 rounded-xl border-2 border-dashed p-3 transition-colors ${
                          snapshot.isDraggingOver
                            ? 'border-primary bg-primary/5'
                            : columnStyles[column.id] + ' bg-card/50'
                        }`}
                      >
                        <div className="space-y-3">
                          {getProjectsByStatus(column.id).map((project, index) => (
                            <Draggable
                              key={project.id}
                              draggableId={project.id}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`p-4 rounded-lg border bg-card transition-shadow ${
                                    snapshot.isDragging
                                      ? 'shadow-lg border-primary'
                                      : 'border-border hover:border-primary/30'
                                  }`}
                                >
                                  <h4 className="font-medium text-foreground text-sm">
                                    {project.title}
                                  </h4>
                                  {project.description && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                      {project.description}
                                    </p>
                                  )}
                                  <div className="flex items-center justify-between mt-3">
                                    {project.due_date && (
                                      <span
                                        className={`text-xs flex items-center gap-1 ${
                                          isOverdue(project.due_date)
                                            ? 'text-destructive'
                                            : 'text-muted-foreground'
                                        }`}
                                      >
                                        <Clock className="w-3 h-3" />
                                        {format(new Date(project.due_date), 'MMM d')}
                                      </span>
                                    )}
                                    {project.editor_rate && (
                                      <span className="text-xs text-emerald-500">
                                        ${project.editor_rate}
                                      </span>
                                    )}
                                  </div>
                                  {column.id === 'in_progress' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="w-full mt-3 text-xs"
                                    >
                                      <Upload className="w-3 h-3 mr-1" />
                                      Upload Deliverable
                                    </Button>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                        </div>
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
        </main>
      </div>
    </>
  );
}
