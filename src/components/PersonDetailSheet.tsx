import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AttendanceReport } from '@/components/admin/AttendanceReport';
import { LeaveManagement } from '@/components/admin/LeaveManagement';
import { Mail, Calendar, FolderKanban, DollarSign, CheckCircle } from 'lucide-react';

interface PersonDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    role?: 'client' | 'editor';
    createdAt?: string;
  } | null;
  variant?: 'client' | 'team';
  stats?: {
    totalProjects?: number;
    totalSpent?: number;
    completedTasks?: number;
    avgDeliveryDays?: number | null;
  };
  projects?: Array<{ id: string; name: string; status: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  done: 'bg-success/20 text-success',
  in_progress: 'bg-primary/20 text-primary',
  review: 'bg-warning/20 text-warning',
  backlog: 'bg-muted text-muted-foreground',
  proposal: 'bg-blue-500/20 text-blue-500',
  cancelled: 'bg-destructive/20 text-destructive',
};

export function PersonDetailSheet({
  open,
  onOpenChange,
  person,
  variant = 'client',
  stats,
  projects = [],
}: PersonDetailSheetProps) {
  if (!person) return null;

  const initials = person.name
    ? person.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : person.email.slice(0, 2).toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="glass-card border-l-border/50 w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-4 mb-2">
            <Avatar className="w-16 h-16 border-2 border-border/50">
              <AvatarImage src={person.avatarUrl || undefined} alt={person.name} />
              <AvatarFallback className="bg-primary/20 text-primary text-xl font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle className="text-xl text-foreground">
                {person.name || 'Unnamed User'}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                {person.role && (
                  <Badge variant="secondary" className="capitalize">
                    {person.role}
                  </Badge>
                )}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Contact Info */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Contact Information
            </h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{person.email}</span>
              </div>
              {person.createdAt && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">
                    Joined {new Date(person.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Stats Summary */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              {variant === 'client' ? 'Client Summary' : 'Performance Summary'}
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card-premium rounded-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <FolderKanban className="w-4 h-4" />
                  <span className="text-xs">
                    {variant === 'client' ? 'Total Projects' : 'Active Projects'}
                  </span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {stats?.totalProjects ?? 0}
                </p>
              </div>
              <div className="glass-card-premium rounded-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  {variant === 'client' ? (
                    <DollarSign className="w-4 h-4" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  <span className="text-xs">
                    {variant === 'client' ? 'Total Spent' : 'Completed'}
                  </span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {variant === 'client' 
                    ? `$${(stats?.totalSpent ?? 0).toLocaleString()}` 
                    : `${stats?.completedTasks ?? 0} projects`}
                </p>
              </div>
            </div>

            {/* Average Delivery Time for editors */}
            {variant === 'team' && stats?.avgDeliveryDays != null && (
              <div className="glass-card-premium rounded-lg p-4 mt-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs">Avg. Delivery Time</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.avgDeliveryDays < 1 
                    ? `${Math.round(stats.avgDeliveryDays * 24)} hours`
                    : `${stats.avgDeliveryDays.toFixed(1)} days`}
                </p>
              </div>
            )}
          </div>

          <Separator className="bg-border/50" />

          {/* Project History */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              {variant === 'client' ? 'Project History' : 'Assigned Projects'}
            </h4>
            {projects.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No projects yet
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated/50"
                  >
                    <span className="text-sm text-foreground">{project.name}</span>
                    <Badge
                      variant="secondary"
                      className={STATUS_COLORS[project.status] || 'bg-muted text-muted-foreground'}
                    >
                      {project.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
