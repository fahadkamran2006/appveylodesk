import { Link, useLocation } from 'react-router-dom';
import { Command, LayoutDashboard, FolderKanban, Receipt, MessageSquare, LogOut, HardDrive, Settings, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useBranding } from '@/contexts/BrandingContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/client/dashboard' },
  { label: 'Projects', icon: FolderKanban, href: '/client/projects' },
  { label: 'Invoices', icon: Receipt, href: '/client/invoices' },
  { label: 'Storage', icon: HardDrive, href: '/client/storage' },
  { label: 'Messages', icon: MessageSquare, href: '/client/messages' },
  { label: 'Calendar', icon: Calendar, href: '/client/calendar' },
  { label: 'Settings', icon: Settings, href: '/client/settings' },
];

export const ClientSidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { totalUnread } = useUnreadMessages();
  const { branding, isCustomBrandingActive } = useBranding();

  const showCustomLogo = isCustomBrandingActive && branding?.logo_url;

  return (
    <aside className="w-64 bg-surface-dark border-r border-border/50 flex flex-col sticky top-0 h-screen overflow-y-auto">
      <div className="p-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          {showCustomLogo ? (
            <img 
              src={branding.logo_url} 
              alt={branding.agency_name || 'Agency'} 
              className="w-9 h-9 rounded-lg object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Command className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
          <span className="text-xl font-bold text-foreground">
            {isCustomBrandingActive && branding?.agency_name ? (
              branding.agency_name
            ) : (
              <>Veylo<span className="text-gradient">desk</span></>
            )}
          </span>
        </Link>
        <ThemeToggle />
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const isMessages = item.label === 'Messages';
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="flex-1">{item.label}</span>
              {isMessages && totalUnread > 0 && (
                <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 min-w-[20px] text-center">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border/50">
        <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={signOut}>
          <LogOut className="w-5 h-5 mr-3" />
          Sign out
        </Button>
      </div>
    </aside>
  );
};
