import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Clock, Upload, Inbox, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ProjectDetailSheet } from '@/components/projects/ProjectDetailSheet';
import { stripHtml } from '@/components/ui/rich-text-editor';

type ProjectStatus = 'backlog' | 'in_progress' | 'review' | 'quality_check' | 'done';

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
  { id: 'quality_check', title: 'Quality Check' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Delivered' },
];

const columnAccents: Partial<Record<ProjectStatus, string>> = {
  backlog: 'bg-muted-foreground/60',
  in_progress: 'bg-primary',
  quality_check: 'bg-indigo-500',
  review: 'bg-amber-500',
  done: 'bg-emerald-500',
};


export default function EditorProjects() {
  const navigate = useNavigate();
  const { user, userRole, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);


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

      const projectIds = assignments.map((a) => a.project_id);

      const { data, error } = await supabase
        .from('projects')
        .select('id, title, description, status, due_date, editor_rate')
        .in('id', projectIds)
        .in('status', ['backlog', 'in_progress', 'review', 'quality_check', 'done'])
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

    const { draggableId, destination, source } = result;
    const newStatus = destination.droppableId as ProjectStatus;
    if (source.droppableId === destination.droppableId) return;

    // Editors cannot move projects to 'review' or 'done' — only admin can
    if (newStatus === 'review' || newStatus === 'done') {
      toast({
        title: 'Not allowed',
        description: 'Only admin can move projects to Review or Delivered.',
        variant: 'destructive',
      });
      return;
    }

    const targetTitle = COLUMNS.find((c) => c.id === newStatus)?.title ?? newStatus;
    const movedProject = projects.find((p) => p.id === draggableId);

    // Optimistic update + loading state
    setMovingId(draggableId);
    setProjects((prev) => prev.map((p) => (p.id === draggableId ? { ...p, status: newStatus } : p)));

    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', draggableId);

      if (error) throw error;

      toast({
        title: '✓ Moved to ' + targetTitle,
        description: movedProject ? `"${movedProject.title}" is now in ${targetTitle}.` : undefined,
      });
    } catch (error) {
      console.error('Error updating project:', error);
      fetchProjects(); // Revert on error
      toast({
        title: 'Could not move project',
        description: 'We saved your change locally but the server rejected it. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setMovingId(null);
    }
  };


  const getProjectsByStatus = (status: ProjectStatus) => projects.filter((p) => p.status === status);

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const isInitialLoading = authLoading || loading;
  const hasNoProjects = !isInitialLoading && projects.length === 0;


  return (
    <>
      <Helmet>
        <title>My Projects | Veylodesk</title>
        <meta name="description" content="Manage your assigned projects and upload deliverables" />
      </Helmet>

      <div className="flex min-h-screen bg-background">
        <div className="hidden md:block">
          <CollapsibleSidebar role="editor" />
        </div>

        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-auto">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">My Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Drag a card to update its status. Tap any project to open its workspace.
            </p>
          </div>

          {isInitialLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {COLUMNS.map((column) => (
                <div key={column.id} className="flex flex-col min-w-0">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${columnAccents[column.id] ?? 'bg-muted-foreground/40'}`} />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <Skeleton className="h-5 w-6 rounded-full" />
                  </div>
                  <div className="flex-1 rounded-xl border border-border/60 bg-muted/30 p-2.5 space-y-2.5 min-h-[300px]">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="p-3.5 rounded-lg border border-border/70 bg-card space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                        <div className="flex justify-between pt-1">
                          <Skeleton className="h-3 w-12" />
                          <Skeleton className="h-3 w-10" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : hasNoProjects ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 py-16 px-6 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <Inbox className="w-7 h-7 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">No projects assigned yet</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
                When an admin assigns you to a project, it will appear here. You'll be able to upload
                deliverables, track revisions, and move work through the pipeline.
              </p>
            </div>
          ) : (
          <DragDropContext onDragEnd={handleDragEnd}>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 min-h-[600px]">
              {COLUMNS.map((column) => {
                const items = getProjectsByStatus(column.id);
                return (
                  <div key={column.id} className="flex flex-col min-w-0">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${columnAccents[column.id] ?? 'bg-muted-foreground/40'}`} />
                        <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase">{column.title}</h3>
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {items.length}
                      </span>
                    </div>

                    <Droppable droppableId={column.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 rounded-xl border p-2.5 transition-colors ${
                            snapshot.isDraggingOver
                              ? 'border-primary/60 bg-primary/5'
                              : 'border-border/60 bg-muted/30'
                          }`}
                        >
                          <div className="space-y-2.5">
                            {items.length === 0 && (
                              <div className="text-center text-xs text-muted-foreground/70 py-8">
                                Nothing here
                              </div>
                            )}
                            {items.map((project, index) => (
                              <Draggable key={project.id} draggableId={project.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={() => {
                                      if (snapshot.isDragging) return;
                                      setSelectedProjectId(project.id);
                                    }}
                                    className={`group relative p-3.5 rounded-lg border bg-card transition-all duration-200 cursor-pointer ${
                                      snapshot.isDragging
                                        ? 'shadow-xl border-primary ring-2 ring-primary/30 rotate-[0.5deg] scale-[1.02]'
                                        : 'border-border/70 hover:border-primary/40 hover:shadow-sm hover:-translate-y-0.5'
                                    } ${movingId === project.id ? 'opacity-70' : ''}`}
                                  >
                                    {movingId === project.id && (
                                      <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                        Moving
                                      </div>
                                    )}
                                    <h4 className="font-medium text-foreground text-sm leading-snug line-clamp-2 pr-14">
                                      {project.title}
                                    </h4>

                                    {project.description && stripHtml(project.description) && (
                                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                                        {stripHtml(project.description)}
                                      </p>
                                    )}
                                    <div className="flex items-center justify-between mt-3 gap-2">
                                      {project.due_date ? (
                                        <span
                                          className={`text-[11px] flex items-center gap-1 font-medium ${
                                            isOverdue(project.due_date) ? 'text-destructive' : 'text-muted-foreground'
                                          }`}
                                        >
                                          <Clock className="w-3 h-3" />
                                          {format(new Date(project.due_date), 'MMM d')}
                                        </span>
                                      ) : <span />}
                                      {project.editor_rate && (
                                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                          ${project.editor_rate}
                                        </span>
                                      )}
                                    </div>
                                    {column.id === 'in_progress' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full mt-3 h-8 text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedProjectId(project.id);
                                        }}
                                      >
                                        <Upload className="w-3 h-3 mr-1.5" />
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
                );
              })}
            </div>
          </DragDropContext>
          )}

        </main>
      </div>


      <ProjectDetailSheet
        projectId={selectedProjectId}
        open={!!selectedProjectId}
        onOpenChange={(open) => !open && setSelectedProjectId(null)}
        onProjectDeleted={fetchProjects}
      />
      <MobileBottomNav role="editor" />
    </>
  );
}
