import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { format, isPast, isToday } from 'date-fns';
import { Calendar, AlertCircle, User, FolderKanban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { stripHtml } from '@/components/ui/rich-text-editor';
import { Project, ProjectStatus } from './KanbanColumn';

interface ProjectListViewProps {
  projects: Project[];
  onProjectClick?: (project: Project) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  showClient?: boolean;
}

const statusConfig: Record<ProjectStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  request: { label: 'Requested', variant: 'outline' },
  proposal: { label: 'Proposal', variant: 'outline' },
  backlog: { label: 'Backlog', variant: 'secondary' },
  in_progress: { label: 'In Progress', variant: 'default' },
  review: { label: 'Review', variant: 'outline' },
  quality_check: { label: 'Quality Check', variant: 'outline' },
  done: { label: 'Done', variant: 'secondary' },
  paid: { label: 'Paid', variant: 'default' },
  archived: { label: 'Archived', variant: 'secondary' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

export function ProjectListView({
  projects,
  onProjectClick,
  selectedIds = [],
  onSelectionChange,
  showClient = true,
}: ProjectListViewProps) {
  const getInitials = (name?: string) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const toggleSelection = (id: string) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (selectedIds.length === projects.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(projects.map(p => p.id));
    }
  };

  const getDueDateDisplay = (dueDate: string | null | undefined) => {
    if (!dueDate) return { text: 'No due date', className: 'text-muted-foreground' };
    
    const date = new Date(dueDate);
    const isOverdue = isPast(date) && !isToday(date);
    const isDueToday = isToday(date);
    
    if (isOverdue) {
      return { text: 'Overdue', className: 'text-destructive', icon: AlertCircle };
    }
    if (isDueToday) {
      return { text: 'Due Today', className: 'text-warning' };
    }
    return { text: format(date, 'MMM d, yyyy'), className: 'text-muted-foreground' };
  };

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FolderKanban className="w-12 h-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No projects found</h3>
        <p className="text-muted-foreground">Try adjusting your filters or create a new project.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            {onSelectionChange && (
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.length === projects.length && projects.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
            )}
            <TableHead className="min-w-[200px]">Project</TableHead>
            {showClient && <TableHead>Client</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Editor</TableHead>
            <TableHead>Due Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => {
            const dueDateInfo = getDueDateDisplay(project.due_date);
            const DueIcon = dueDateInfo.icon || Calendar;
            
            return (
              <TableRow
                key={project.id}
                className="cursor-pointer hover:bg-muted/30"
                onClick={() => onProjectClick?.(project)}
              >
                {onSelectionChange && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(project.id)}
                      onCheckedChange={() => toggleSelection(project.id)}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FolderKanban className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate max-w-[200px]">
                        {project.title}
                      </p>
                      {project.description && stripHtml(project.description) && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {stripHtml(project.description)}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                
                {showClient && (
                  <TableCell>
                    {project.client_name ? (
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm truncate max-w-[120px]">{project.client_name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                )}
                
                <TableCell>
                  <Badge 
                    variant={statusConfig[project.status]?.variant || 'secondary'}
                    className="text-xs whitespace-nowrap"
                  >
                    {statusConfig[project.status]?.label || project.status}
                  </Badge>
                </TableCell>
                
                <TableCell>
                  {project.editor_name ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={project.editor_avatar || undefined} />
                        <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                          {getInitials(project.editor_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate max-w-[100px]">{project.editor_name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">Unassigned</span>
                  )}
                </TableCell>
                
                <TableCell>
                  <div className={cn("flex items-center gap-1.5 text-sm", dueDateInfo.className)}>
                    <DueIcon className="w-3.5 h-3.5" />
                    <span>{dueDateInfo.text}</span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
