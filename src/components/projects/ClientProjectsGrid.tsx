import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FolderKanban, Plus, Video, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProjectInfo {
  id: string;
  title: string;
  description?: string | null;
  videoCount: number;
  activeCount: number;
  completedCount: number;
}

interface ClientProjectsGridProps {
  clientName: string;
  clientAvatar?: string | null;
  projects: ProjectInfo[];
  onProjectClick: (projectId: string) => void;
  onCreateProject: () => void;
  onProjectDeleted?: () => void;
}

export function ClientProjectsGrid({
  clientName,
  clientAvatar,
  projects,
  onProjectClick,
  onCreateProject,
  onProjectDeleted,
}: ClientProjectsGridProps) {
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<ProjectInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const clientInitials = clientName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleDeleteContainer = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      // 1. Fetch all videos in this container
      const { data: videos, error: fetchErr } = await supabase
        .from('projects')
        .select('id')
        .eq('container_id', deleteTarget.id);

      if (fetchErr) throw fetchErr;

      // 2. For each video, delete its deliverables/assets via the edge function
      if (videos && videos.length > 0) {
        for (const video of videos) {
          // Fetch deliverables for this video
          const { data: deliverables } = await supabase
            .from('deliverables')
            .select('id, file_url, file_type')
            .eq('project_id', video.id);

          if (deliverables && deliverables.length > 0) {
            for (const d of deliverables) {
              try {
                await supabase.functions.invoke('delete-asset', {
                  body: { deliverableId: d.id },
                });
              } catch (e) {
                console.error('Failed to delete asset:', d.id, e);
              }
            }
          }

          // Delete the video record
          await supabase.from('projects').delete().eq('id', video.id);
        }
      }

      // 3. Delete the container itself
      const { error: deleteErr } = await supabase
        .from('project_containers')
        .delete()
        .eq('id', deleteTarget.id);

      if (deleteErr) throw deleteErr;

      toast({
        title: 'Project deleted',
        description: `"${deleteTarget.title}" and all its videos have been removed.`,
      });

      setDeleteTarget(null);
      onProjectDeleted?.();
    } catch (error: any) {
      console.error('Delete container error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete project',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

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
              className={cn(
                'glass-card rounded-xl p-5 cursor-pointer transition-all duration-200 group relative',
                'hover:border-primary/30 hover:shadow-glow-sm',
                'active:scale-[0.98]'
              )}
            >
              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(project);
                }}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                title="Delete project"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div onClick={() => onProjectClick(project.id)}>
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
                
                {project.description && stripHtml(project.description) && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {stripHtml(project.description)}
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
              </div>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this project and all {deleteTarget?.videoCount || 0} video{deleteTarget?.videoCount !== 1 ? 's' : ''} inside it, including their files and deliverables. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContainer}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Project'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
