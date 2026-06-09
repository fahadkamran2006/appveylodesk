import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronRight, DollarSign, FolderKanban, Zap, Trash2, Pencil, Briefcase, KeyRound, LucideIcon } from 'lucide-react';

interface PersonCardProps {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role?: 'client' | 'editor';
  employmentType?: 'freelance' | 'salaried';
  badgeLabel?: string;
  secondaryAction?: {
    label: string;
    icon?: LucideIcon;
    onClick: (id: string) => void;
    disabled?: boolean;
  };
  stats?: {
    activeProjects?: number;
    totalSpent?: number;
    currentLoad?: number;
    status?: 'active' | 'offline';
  };
  onExpand?: (id: string) => void;
  onRemove?: (id: string) => void;
  onEdit?: (id: string) => void;
  variant?: 'client' | 'team';
}

export function PersonCard({
  id,
  name,
  email,
  avatarUrl,
  role,
  employmentType,
  badgeLabel,
  secondaryAction,
  stats,
  onExpand,
  onRemove,
  onEdit,
  variant = 'client',
}: PersonCardProps) {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : email.slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        'glass-card rounded-xl p-5 transition-all duration-300 hover:border-primary/30 cursor-pointer group',
        'hover:shadow-glow-sm'
      )}
      onClick={() => onExpand?.(id)}
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <Avatar className="w-12 h-12 border-2 border-border/50">
          <AvatarImage src={avatarUrl || undefined} alt={name || email} />
          <AvatarFallback className="bg-primary/20 text-primary font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">
            {name || 'Unnamed'}
          </h3>
          <p className="text-sm text-muted-foreground truncate">{email}</p>
        </div>

        {variant === 'team' && (
          <div className="flex items-center gap-2 shrink-0">
            {employmentType && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  employmentType === 'salaried' 
                    ? 'bg-primary/10 text-primary border-primary/30' 
                    : 'bg-muted text-muted-foreground border-border'
                )}
              >
                <Briefcase className="w-3 h-3 mr-1" />
                {employmentType === 'salaried' ? 'Salaried' : 'Freelance'}
              </Badge>
            )}
            {role && (
              <Badge
                variant="secondary"
                className={cn(
                  'capitalize',
                  role === 'editor' && 'bg-primary/20 text-primary border-primary/30'
                )}
              >
                {role}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        {variant === 'client' && (
          <>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FolderKanban className="w-4 h-4" />
              <span>
                Active Projects:{' '}
                <span className="text-foreground font-medium">
                  {stats?.activeProjects ?? 0}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <DollarSign className="w-4 h-4" />
              <span>
                Total Spent:{' '}
                <span className="text-foreground font-medium">
                  ${stats?.totalSpent?.toLocaleString() ?? 0}
                </span>
              </span>
            </div>
          </>
        )}

        {variant === 'team' && (
          <>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FolderKanban className="w-4 h-4" />
              <span>
                Current Load:{' '}
                <span className="text-foreground font-medium">
                  {stats?.currentLoad ?? 0} Projects
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap
                className={cn(
                  'w-4 h-4',
                  stats?.status === 'active' ? 'text-success' : 'text-muted-foreground'
                )}
              />
              <span
                className={cn(
                  'font-medium',
                  stats?.status === 'active' ? 'text-success' : 'text-muted-foreground'
                )}
              >
                {stats?.status === 'active' ? 'Active' : 'Offline'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-2">
        <Button
          variant="ghost"
          className="flex-1 justify-between text-muted-foreground hover:text-foreground group-hover:bg-surface-elevated"
        >
          {variant === 'client' ? 'View Details' : 'View Performance'}
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Button>
        {onEdit && variant === 'team' && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(id);
            }}
          >
            <Pencil className="w-4 h-4" />
          </Button>
        )}
        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(id);
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}