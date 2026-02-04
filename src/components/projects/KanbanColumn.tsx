import { Droppable, Draggable } from '@hello-pangea/dnd';
import { ProjectCard } from './ProjectCard';
import { cn } from '@/lib/utils';

export type ProjectStatus = 'proposal' | 'backlog' | 'in_progress' | 'review' | 'done' | 'cancelled';

export interface Project {
  id: string;
  title: string;
  description?: string | null;
  client_id?: string | null;
  client_name?: string;
  container_id?: string | null;
  editor_id?: string | null;
  editor_name?: string;
  editor_avatar?: string | null;
  due_date?: string | null;
  status: ProjectStatus;
}

interface KanbanColumnProps {
  id: ProjectStatus;
  title: string;
  projects: Project[];
  onProjectClick?: (project: Project) => void;
}

const columnStyles: Record<ProjectStatus, { bg: string; border: string; dot: string }> = {
  proposal: {
    bg: 'bg-purple-500/5',
    border: 'border-purple-500/20',
    dot: 'bg-purple-500',
  },
  backlog: {
    bg: 'bg-muted/30',
    border: 'border-muted-foreground/20',
    dot: 'bg-muted-foreground',
  },
  in_progress: {
    bg: 'bg-primary/5',
    border: 'border-primary/20',
    dot: 'bg-primary',
  },
  review: {
    bg: 'bg-warning/5',
    border: 'border-warning/20',
    dot: 'bg-warning',
  },
  done: {
    bg: 'bg-success/5',
    border: 'border-success/20',
    dot: 'bg-success',
  },
  cancelled: {
    bg: 'bg-destructive/5',
    border: 'border-destructive/20',
    dot: 'bg-destructive',
  },
};

export function KanbanColumn({
  id,
  title,
  projects,
  onProjectClick,
}: KanbanColumnProps) {
  const styles = columnStyles[id];

  return (
    <div className="flex flex-col w-80 shrink-0">
      {/* Column Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg mb-3',
          styles.bg,
          'border',
          styles.border
        )}
      >
        <div className={cn('w-2 h-2 rounded-full', styles.dot)} />
        <h3 className="font-medium text-foreground text-sm">{title}</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {projects.length}
        </span>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'flex-1 min-h-[200px] p-2 rounded-lg transition-colors space-y-3',
              snapshot.isDraggingOver
                ? 'bg-primary/10 border-2 border-dashed border-primary/30'
                : 'bg-surface-elevated/30'
            )}
          >
            {projects.map((project, index) => (
              <Draggable key={project.id} draggableId={project.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={cn(
                      snapshot.isDragging && 'rotate-2 shadow-lg'
                    )}
                  >
                    <ProjectCard
                      id={project.id}
                      title={project.title}
                      clientName={project.client_name}
                      editorName={project.editor_name}
                      editorAvatar={project.editor_avatar}
                      dueDate={project.due_date}
                      onClick={() => onProjectClick?.(project)}
                    />
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
}