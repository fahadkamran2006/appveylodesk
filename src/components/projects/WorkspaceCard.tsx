import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { FolderKanban, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkspaceCardProps {
  clientId: string;
  clientName: string;
  clientAvatar?: string | null;
  clientEmail?: string;
  projectCount: number;
  activeCount: number;
  completedCount: number;
  onClick?: () => void;
}

export function WorkspaceCard({
  clientId,
  clientName,
  clientAvatar,
  clientEmail,
  projectCount,
  activeCount,
  completedCount,
  onClick,
}: WorkspaceCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 group",
        "hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5",
        "active:scale-[0.98]"
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        {/* Header with Avatar and Name */}
        <div className="flex items-start gap-4 mb-4">
          <Avatar className="h-12 w-12 ring-2 ring-primary/10 group-hover:ring-primary/30 transition-all">
            <AvatarImage src={clientAvatar || undefined} alt={clientName} />
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
              {getInitials(clientName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {clientName}
            </h3>
            {clientEmail && (
              <p className="text-sm text-muted-foreground truncate">
                {clientEmail}
              </p>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <FolderKanban className="w-4 h-4" />
            <span className="text-sm font-medium">{projectCount}</span>
            <span className="text-xs">projects</span>
          </div>

          <div className="w-px h-4 bg-border" />

          <div className="flex items-center gap-1.5 text-primary">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-sm font-medium">{activeCount}</span>
            <span className="text-xs text-muted-foreground">active</span>
          </div>

          <div className="flex items-center gap-1.5 text-success">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="text-sm font-medium">{completedCount}</span>
          </div>
        </div>

        {/* View Button */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <span className="text-sm text-primary font-medium group-hover:underline">
            Open Workspace →
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
