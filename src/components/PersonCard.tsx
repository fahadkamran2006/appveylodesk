import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronRight, DollarSign, FolderKanban, Zap } from 'lucide-react';

interface PersonCardProps {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role?: 'client' | 'editor';
  stats?: {
    activeProjects?: number;
    totalSpent?: number;
    currentLoad?: number;
    status?: 'active' | 'offline';
  };
  onExpand?: (id: string) => void;
  variant?: 'client' | 'team';
}

export function PersonCard({
  id,
  name,
  email,
  avatarUrl,
  role,
  stats,
  onExpand,
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

        {variant === 'team' && role && (
          <Badge
            variant="secondary"
            className={cn(
              'capitalize shrink-0',
              role === 'editor' && 'bg-primary/20 text-primary border-primary/30'
            )}
          >
            {role}
          </Badge>
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
      <Button
        variant="ghost"
        className="w-full justify-between text-muted-foreground hover:text-foreground group-hover:bg-surface-elevated"
      >
        {variant === 'client' ? 'View Details' : 'View Performance'}
        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </Button>
    </div>
  );
}