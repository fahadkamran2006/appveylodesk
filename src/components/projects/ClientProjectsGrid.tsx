import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { FolderKanban, Plus, Calendar, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ProjectInfo {
  id: string;
  title: string;
  description?: string | null;
  videoCount: number;
  activeCount: number;
  completedCount: number;
  due_date?: string | null;
}

interface ClientProjectsGridProps {
  clientName: string;
  clientAvatar?: string | null;
  projects: ProjectInfo[];
  onProjectClick: (projectId: string) => void;
  onCreateProject: () => void;
}

export function ClientProjectsGrid({
  clientName,
  clientAvatar,
  projects,
  onProjectClick,
  onCreateProject,
}: ClientProjectsGridProps) {
  const clientInitials = clientName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6">
      {/* Client Info Header */}
      <div className="flex items-center gap-4 p-4 rounded-xl glass-card">
        <Avatar className="w-12 h-12 border-2 border-primary/30">
          <AvatarImage src={clientAvatar || undefined} alt={clientName} />
          <AvatarFallback className="bg-primary/20 text-primary font-semibold">
            {clientInitials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground">{clientName}</h2>
          <p className="text-sm text-muted-foreground">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={onCreateProject} className="gap-2">
          <Plus className="w-4 h-4" />
          New Project
        </Button>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-border">
          <FolderKanban className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No projects yet</h3>
          <p className="text-muted-foreground mb-4">
            Create a project to organize videos for this client.
          </p>
          <Button onClick={onCreateProject} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Create First Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => onProjectClick(project.id)}
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
                <span className="text-xs text-muted-foreground">
                  {project.videoCount} video{project.videoCount !== 1 ? 's' : ''}
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
                <span className="flex items-center gap-1">
                  <Video className="w-3 h-3 text-primary" />
                  {project.activeCount} active
                </span>
                <span className="flex items-center gap-1 text-success">
                  {project.completedCount} done
                </span>
              </div>
              
              {project.due_date && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                  <Calendar className="w-3 h-3" />
                  Due {format(new Date(project.due_date), 'MMM d')}
                </div>
              )}
            </div>
          ))}
          
          {/* Add Project Card */}
          <div
            onClick={onCreateProject}
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
  );
}
