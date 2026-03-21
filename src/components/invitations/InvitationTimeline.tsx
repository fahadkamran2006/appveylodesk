import { Check, Mail, MousePointerClick, UserPlus, Building2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface InvitationTimelineProps {
  createdAt: string;
  acceptedAt: string | null;
  role: 'client' | 'editor' | 'admin';
}

interface TimelineStep {
  label: string;
  icon: React.ReactNode;
  status: 'completed' | 'active' | 'pending';
  detail?: string;
}

export function InvitationTimeline({ createdAt, acceptedAt, role }: InvitationTimelineProps) {
  const isAccepted = !!acceptedAt;

  const steps: TimelineStep[] = [
    {
      label: 'Invitation sent',
      icon: <Mail className="w-3 h-3" />,
      status: 'completed',
      detail: formatDistanceToNow(new Date(createdAt), { addSuffix: true }),
    },
    {
      label: 'Awaiting response',
      icon: <MousePointerClick className="w-3 h-3" />,
      status: isAccepted ? 'completed' : 'active',
    },
    {
      label: 'Account created',
      icon: <UserPlus className="w-3 h-3" />,
      status: isAccepted ? 'completed' : 'pending',
    },
    {
      label: `Joined as ${role}`,
      icon: <Building2 className="w-3 h-3" />,
      status: isAccepted ? 'completed' : 'pending',
      detail: isAccepted && acceptedAt 
        ? formatDistanceToNow(new Date(acceptedAt), { addSuffix: true }) 
        : undefined,
    },
  ];

  return (
    <div className="flex items-center gap-0 mt-3 w-full">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center flex-1 min-w-0 last:flex-none">
          {/* Step dot/icon */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all',
                step.status === 'completed' && 'bg-primary border-primary text-primary-foreground',
                step.status === 'active' && 'border-primary bg-primary/10 text-primary animate-pulse',
                step.status === 'pending' && 'border-muted-foreground/30 bg-muted/50 text-muted-foreground/50'
              )}
            >
              {step.status === 'completed' ? (
                <Check className="w-3 h-3" />
              ) : (
                step.icon
              )}
            </div>
            <div className="text-center max-w-[70px]">
              <p className={cn(
                'text-[10px] leading-tight font-medium',
                step.status === 'completed' && 'text-foreground',
                step.status === 'active' && 'text-primary',
                step.status === 'pending' && 'text-muted-foreground/50'
              )}>
                {step.label}
              </p>
              {step.detail && (
                <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                  {step.detail}
                </p>
              )}
            </div>
          </div>

          {/* Connector line */}
          {i < steps.length - 1 && (
            <div
              className={cn(
                'flex-1 h-0.5 mx-1 rounded-full mt-[-20px]',
                step.status === 'completed' ? 'bg-primary' : 'bg-muted-foreground/20'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
