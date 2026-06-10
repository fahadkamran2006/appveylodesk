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
      onClick={onClick}
      className={cn(
        'group relative rounded-2xl p-4 cursor-pointer overflow-hidden',
        'bg-card/80 border border-border/60',
        'transition-[transform,border-color,box-shadow,background-color] duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]',
        'hover:border-primary/40 hover:-translate-y-[1px]',
        'hover:shadow-[0_10px_28px_-14px_rgba(75,75,225,0.4)]',
        'active:scale-[0.99] active:duration-75'
      )}
    >
      {/* Client micro-label */}
      {clientName && (
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary/90 truncate mb-2">
          {clientName}
        </p>
      )}

      {/* Title */}
      <h4 className="font-semibold text-sm text-foreground leading-snug line-clamp-2 mb-4 group-hover:text-primary transition-colors">
        {title}
      </h4>

      {/* Divider + Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border/40">
        {dueDate ? (
          <div
            className={cn(
              'flex items-center gap-1.5 text-[11px] font-medium',
              isOverdue
                ? 'text-destructive'
                : isDueToday
                ? 'text-amber-400'
                : 'text-muted-foreground'
            )}
          >
            {isOverdue ? (
              <AlertCircle className="w-3.5 h-3.5" />
            ) : (
              <Calendar className="w-3.5 h-3.5" />
            )}
            <span>
              {isOverdue
                ? 'Overdue'
                : isDueToday
                ? 'Due Today'
                : format(new Date(dueDate), 'MMM d')}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground/70">No due date</span>
        )}

        {editorName && (
          <Avatar className="w-6 h-6 ring-2 ring-card">
            <AvatarImage src={editorAvatar || undefined} alt={editorName} />
            <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-semibold">
              {editorInitials}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
