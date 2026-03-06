import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { NotificationBell } from './NotificationBell';
import { BugReportModal } from '@/components/BugReportModal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface DashboardHeaderProps {
  title?: string;
  showProfile?: boolean;
}

export function DashboardHeader({ title, showProfile = true }: DashboardHeaderProps) {
  const { user } = useAuth();
  const { profile } = useProfile();

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getFirstName = (name: string | null | undefined) => {
    if (!name) return 'there';
    return name.split(' ')[0];
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getMotivationalText = () => {
    const texts = [
      "Let's crush some edits today.",
      "Ready to create something amazing?",
      "Time to make magic happen.",
      "Your projects are waiting.",
      "Let's get things done!",
    ];
    // Use date to pick consistent message for the day
    const dayIndex = new Date().getDate() % texts.length;
    return texts[dayIndex];
  };

  return (
    <div className="flex items-center justify-between gap-4 mb-6">
      {/* Personalized Greeting */}
      <div className="flex-1 min-w-0">
        <h2 className="text-lg md:text-xl font-semibold text-foreground truncate">
          {getGreeting()}, {getFirstName(profile?.full_name)}! 👋
        </h2>
        <p className="text-sm text-muted-foreground truncate">
          {getMotivationalText()}
        </p>
      </div>

      {/* Right side - Notification Bell + Profile */}
      <div className="flex items-center gap-2 shrink-0">
        <BugReportModal />
        <NotificationBell />
        
        {showProfile && (
          <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-border">
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium text-foreground truncate max-w-[120px]">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                {profile?.email}
              </p>
            </div>
            <Avatar className="h-9 w-9 ring-2 ring-primary/10">
              <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || 'User'} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {getInitials(profile?.full_name)}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>
    </div>
  );
}
