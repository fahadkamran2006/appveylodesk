import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Calendar, AlertCircle } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';

interface ProjectCardProps {
  id: string;
  title: string;
  clientName?: string;
  editorName?: string;
  editorAvatar?: string | null;
  dueDate?: string | null;
  onClick?: () => void;
}

export function ProjectCard({
  id,
  title,
  clientName,
  editorName,
  editorAvatar,
  dueDate,
  onClick,
}: ProjectCardProps) {
  const isOverdue = dueDate && isPast(new Date(dueDate)) && !isToday(new Date(dueDate));
  const isDueToday = dueDate && isToday(new Date(dueDate));

  const editorInitials = editorName
    ? editorName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  return (
    <div
      className={cn(
        'glass-card rounded-lg p-4 cursor-pointer transition-all duration-200',
        'hover:border-primary/30 hover:shadow-glow-sm',
        'active:scale-[0.98]'
      )}
      onClick={onClick}
    >
      {/* Title */}
      <h4 className="font-medium text-foreground mb-2 line-clamp-2">{title}</h4>

      {/* Client */}
      {clientName && (
        <p className="text-sm text-muted-foreground mb-3 truncate">
          {clientName}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Due Date */}
        {dueDate ? (
          <div
            className={cn(
              'flex items-center gap-1.5 text-xs',
              isOverdue
                ? 'text-destructive'
                : isDueToday
                ? 'text-warning'
                : 'text-muted-foreground'
            )}
          >
            {isOverdue ? (
              <AlertCircle className="w-3.5 h-3.5" />
            ) : (
              <Calendar className="w-3.5 h-3.5" />
            )}
            <span className="font-medium">
              {isOverdue
                ? 'Overdue'
                : isDueToday
                ? 'Due Today'
                : format(new Date(dueDate), 'MMM d')}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No due date</span>
        )}

        {/* Editor Avatar */}
        {editorName && (
          <Avatar className="w-6 h-6 border border-border/50">
            <AvatarImage src={editorAvatar || undefined} alt={editorName} />
            <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-medium">
              {editorInitials}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}