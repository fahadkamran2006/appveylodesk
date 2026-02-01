import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { NotificationBell } from './NotificationBell';
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

  return (
    <div className="flex items-center justify-end gap-3 mb-6">
      <NotificationBell />
      
      {showProfile && (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || 'User'} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {getInitials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>
  );
}
