import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle2, FolderKanban, Upload, ClipboardList, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import { AttendanceCard } from '@/components/attendance/AttendanceCard';
import { LeaveRequestCard } from '@/components/attendance/LeaveRequestCard';
import type { Database } from '@/integrations/supabase/types';

type ProjectStatus = Database['public']['Enums']['project_status'];

interface Project {
  id: string;
  title: string;
  status: ProjectStatus;
  due_date: string | null;
  description: string | null;
}

const COLUMNS: { id: ProjectStatus; title: string }[] = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Delivered' },
];

const EditorDashboard = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [employmentType, setEmploymentType] = useState<'salaried' | 'freelance'>('freelance');
  const [agencyId, setAgencyId] = useState<string>('');

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
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('employment_type').eq('id', user.id).maybeSingle(),
        supabase.from('user_roles').select('agency_id').eq('user_id', user.id).maybeSingle(),
      ]);

      if (profileRes.data?.employment_type) {
        setEmploymentType(profileRes.data.employment_type as 'salaried' | 'freelance');
      }
      if (roleRes.data?.agency_id) {
        setAgencyId(roleRes.data.agency_id);
      }

      const { data, error } = await supabase
        .from('project_editors')
        .select(`
          project:projects(
            id,
            title,
            status,
            due_date,
            description
          )
        `)
        .eq('editor_id', user.id);

      if (error) throw error;

      const projectsData = data
        ?.map(pe => pe.project)
        .filter((p): p is Project => p !== null) || [];
      
      setProjects(projectsData);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: "Error loading projects",
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

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination || destination.droppableId === source.droppableId) {
      return;
    }

    const newStatus = destination.droppableId as ProjectStatus;
    
    setProjects(prev => 
      prev.map(p => p.id === draggableId ? { ...p, status: newStatus } : p)
    );

    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', draggableId);

      if (error) throw error;

      toast({
        title: "Status updated",
        description: `Project moved to ${COLUMNS.find(c => c.id === newStatus)?.title}`,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      fetchProjects();
      toast({
        title: "Update failed",
        description: "Could not update project status.",
        variant: "destructive",
      });
    }
  };

  const getProjectsByStatus = (status: ProjectStatus) => 
    projects.filter(p => p.status === status);

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
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
        <title>Editor Dashboard | Veylodesk</title>
        <meta name="description" content="Manage your assigned projects." />
      </Helmet>

      <DashboardLayout role="editor">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">My Projects</h1>
            <p className="text-sm md:text-base text-muted-foreground">Manage your assigned projects and upload deliverables.</p>
          </div>
          <div className="glass-card rounded-xl px-4 md:px-6 py-3 md:py-4 w-full sm:w-auto">
            <p className="text-xs md:text-sm text-muted-foreground">Assigned to you</p>
            <p className="text-xl md:text-2xl font-bold text-primary">{projects.length} projects</p>
          </div>
        </div>

        {/* Quick Attendance & Leave Section */}
        {agencyId && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                Quick Actions
              </h2>
              <Link to="/editor/work-logs">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  View Work Logs
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AttendanceCard employmentType={employmentType} agencyId={agencyId} />
              <LeaveRequestCard agencyId={agencyId} />
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FolderKanban className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-foreground">
                  {projects.filter(p => p.status === 'in_progress').length}
                </p>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">In Review</p>
                <p className="text-2xl font-bold text-foreground">
                  {projects.filter(p => p.status === 'review').length}
                </p>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-success" />
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

        {/* Kanban Board */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 hide-scrollbar-mobile">
            {COLUMNS.map((column) => {
              const columnProjects = getProjectsByStatus(column.id);
              return (
                <div key={column.id} className="w-72 flex-shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-foreground">{column.title}</h3>
                    <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {columnProjects.length}
                    </span>
                  </div>
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "min-h-[400px] rounded-xl p-3 transition-colors",
                          snapshot.isDraggingOver
                            ? "bg-primary/10 border-2 border-dashed border-primary"
                            : "bg-muted/30 border border-border/50"
                        )}
                      >
                        {columnProjects.map((project, index) => (
                          <Draggable key={project.id} draggableId={project.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={cn(
                                  "bg-background rounded-lg p-4 mb-3 border border-border/50 cursor-grab active:cursor-grabbing transition-shadow",
                                  snapshot.isDragging && "shadow-lg ring-2 ring-primary"
                                )}
                              >
                                <h4 className="font-medium text-foreground mb-2">{project.title}</h4>
                                {project.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                    {project.description}
                                  </p>
                                )}
                                {project.due_date && (
                                  <div className={cn(
                                    "flex items-center gap-1 text-xs",
                                    isOverdue(project.due_date) ? "text-destructive" : "text-muted-foreground"
                                  )}>
                                    <Clock className="w-3 h-3" />
                                    {isOverdue(project.due_date) ? 'Overdue: ' : 'Due '}
                                    {new Date(project.due_date).toLocaleDateString()}
                                  </div>
                                )}
                                {column.id === 'in_progress' && (
                                  <Button variant="outline" size="sm" className="w-full mt-3">
                                    <Upload className="w-4 h-4 mr-2" />
                                    Upload Deliverable
                                  </Button>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </DashboardLayout>
    </>
  );
};

export default EditorDashboard;
