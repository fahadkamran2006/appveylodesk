import { Droppable, Draggable } from '@hello-pangea/dnd';
import { ProjectCard } from './ProjectCard';
import { cn } from '@/lib/utils';

export type ProjectStatus = 'request' | 'proposal' | 'backlog' | 'in_progress' | 'review' | 'quality_check' | 'done' | 'paid' | 'archived' | 'cancelled';

export interface Project {
  id: string;
  title: string;
  description?: string | null;
  client_id?: string | null;
  managed_client_id?: string | null;
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

const columnStyles: Record<ProjectStatus, { dot: string; chip: string; glow: string }> = {
  request:       { dot: 'bg-amber-500',   chip: 'bg-amber-500/10 text-amber-400',     glow: 'shadow-[0_0_10px_rgba(245,158,11,0.45)]' },
  proposal:      { dot: 'bg-purple-500',  chip: 'bg-purple-500/10 text-purple-300',   glow: 'shadow-[0_0_10px_rgba(168,85,247,0.45)]' },
  backlog:       { dot: 'bg-slate-500',   chip: 'bg-white/5 text-muted-foreground',   glow: '' },
  in_progress:   { dot: 'bg-primary',     chip: 'bg-primary/15 text-primary',         glow: 'shadow-[0_0_10px_rgba(75,75,225,0.45)]' },
  review:        { dot: 'bg-amber-400',   chip: 'bg-amber-500/10 text-amber-400',     glow: 'shadow-[0_0_10px_rgba(251,191,36,0.45)]' },
  quality_check: { dot: 'bg-cyan-400',    chip: 'bg-cyan-500/10 text-cyan-300',       glow: 'shadow-[0_0_10px_rgba(34,211,238,0.45)]' },
  done:          { dot: 'bg-emerald-500', chip: 'bg-emerald-500/10 text-emerald-400', glow: '' },
  paid:          { dot: 'bg-emerald-400', chip: 'bg-emerald-500/10 text-emerald-400', glow: '' },
  archived:      { dot: 'bg-slate-500',   chip: 'bg-white/5 text-muted-foreground',   glow: '' },
  cancelled:     { dot: 'bg-destructive', chip: 'bg-destructive/10 text-destructive', glow: '' },
};

export function KanbanColumn({
  id,
  title,
  projects,
  onProjectClick,
}: KanbanColumnProps) {
  const styles = columnStyles[id];
  const isEmpty = projects.length === 0;

  return (
    <div className="flex flex-col w-[280px] md:w-[320px] shrink-0 gap-3">
      {/* Column Header — minimal, airy */}
      <div className="flex items-center justify-between px-2 h-8">
        <div className="flex items-center gap-2.5">
          <div className={cn('w-2 h-2 rounded-full', styles.dot, styles.glow)} />
          <h3 className="text-[11px] font-bold text-foreground/80 uppercase tracking-[0.14em]">
            {title}
          </h3>
        </div>
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md', styles.chip)}>
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
              'flex-1 min-h-[420px] p-3 rounded-2xl transition-all space-y-3',
              snapshot.isDraggingOver
                ? 'bg-primary/[0.06] border border-dashed border-primary/40'
                : isEmpty
                  ? 'bg-white/[0.015] border border-dashed border-white/[0.06]'
                  : 'bg-white/[0.02] border border-white/[0.04]'
            )}
          >
            {isEmpty && !snapshot.isDraggingOver && (
              <div className="h-full min-h-[380px] flex items-center justify-center">
                <p className="text-[11px] text-muted-foreground/60 font-medium italic">
                  Drop projects here
                </p>
              </div>
            )}
            {projects.map((project, index) => (
              <Draggable key={project.id} draggableId={project.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={cn(
                      'transition-transform',
                      snapshot.isDragging && 'rotate-1 scale-[1.02]'
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
