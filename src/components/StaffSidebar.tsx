import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useSidebar } from '@/hooks/useSidebar';
import { useBranding } from '@/contexts/BrandingContext';
import { usePermissions } from '@/hooks/usePermissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Command, LayoutDashboard, Users, UsersRound, FolderKanban, Receipt,
  Settings, LogOut, MessageSquare, HardDrive, DollarSign, ChevronLeft,
  ChevronRight, Calendar, FileBarChart,
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  permission?: string;
}

const items: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/staff/dashboard' },
  { label: 'Projects', icon: FolderKanban, href: '/admin/projects', permission: 'projects.view' },
  { label: 'Clients', icon: Users, href: '/admin/clients', permission: 'clients.view' },
  { label: 'Team', icon: UsersRound, href: '/admin/team', permission: 'team.view' },
  { label: 'Invoices', icon: Receipt, href: '/admin/invoices', permission: 'invoices.view' },
  { label: 'Payroll', icon: DollarSign, href: '/admin/payroll', permission: 'payroll.view' },
  { label: 'Attendance', icon: FileBarChart, href: '/admin/team', permission: 'attendance.view' },
  { label: 'Storage', icon: HardDrive, href: '/admin/storage', permission: 'storage.view' },
  { label: 'Messages', icon: MessageSquare, href: '/admin/messages' },
  { label: 'Calendar', icon: Calendar, href: '/admin/calendar' },
  { label: 'Settings', icon: Settings, href: '/admin/settings' },
];

export function StaffSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { totalUnread } = useUnreadMessages();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { branding, isCustomBrandingActive } = useBranding();
  const { can } = usePermissions();

  const visible = items.filter((i) => !i.permission || can(i.permission));
  // Dedupe href for attendance/team overlap
  const seen = new Set<string>();
  const navItems = visible.filter((i) => {
    const k = i.href + i.label;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const showCustomLogo = isCustomBrandingActive && branding?.logo_url;

  return (
    <aside
      className={cn(
        'bg-surface-dark border-r border-border flex flex-col transition-all duration-300 ease-in-out flex-shrink-0 sticky top-0 h-screen overflow-y-auto',
        isCollapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className={cn('flex items-center border-b border-border', isCollapsed ? 'p-3 justify-center' : 'p-4 justify-between')}>
        <Link to="/staff/dashboard" className="flex items-center gap-2">
          {showCustomLogo ? (
            <img src={branding.logo_url!} alt={branding.agency_name || 'Agency'} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
              <Command className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
          {!isCollapsed && (
            <span className="text-xl font-bold text-foreground whitespace-nowrap">
              {isCustomBrandingActive && branding?.agency_name ? branding.agency_name : <>Veylo<span className="text-gradient">desk</span></>}
            </span>
          )}
        </Link>
        {!isCollapsed && <ThemeToggle />}
      </div>

      <div className={cn('px-3 py-2', isCollapsed ? 'flex justify-center' : 'flex justify-end')}>
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-8 w-8 text-muted-foreground hover:text-foreground">
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className={cn('flex-1 space-y-1', isCollapsed ? 'px-2' : 'px-3')}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const isMessages = item.label === 'Messages';
          const link = (
            <Link
              key={item.href + item.label}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg transition-colors relative',
                isCollapsed ? 'justify-center p-3' : 'px-4 py-3',
                isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {isMessages && totalUnread > 0 && (
                    <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 min-w-[20px] text-center">
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </Badge>
                  )}
                </>
              )}
            </Link>
          );
          if (isCollapsed) {
            return (
              <Tooltip key={item.href + item.label} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
              </Tooltip>
            );
          }
          return link;
        })}
      </nav>

      <div className={cn('border-t border-border', isCollapsed ? 'p-2' : 'p-3')}>
        {isCollapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="w-full h-10 text-muted-foreground hover:text-foreground" onClick={signOut}>
                <LogOut className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">Sign out</TooltipContent>
          </Tooltip>
        ) : (
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={signOut}>
            <LogOut className="w-5 h-5 mr-3" />
            Sign out
          </Button>
        )}
      </div>
    </aside>
  );
}
