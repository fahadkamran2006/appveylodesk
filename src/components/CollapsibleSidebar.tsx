import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useSidebar } from '@/hooks/useSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Command,
  LayoutDashboard,
  Users,
  UsersRound,
  FolderKanban,
  Receipt,
  Settings,
  LogOut,
  MessageSquare,
  Briefcase,
  FileText,
  HardDrive,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
}

const adminNavItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/admin/dashboard' },
  { label: 'Projects', icon: FolderKanban, href: '/admin/projects' },
  { label: 'Clients', icon: Users, href: '/admin/clients' },
  { label: 'Team', icon: UsersRound, href: '/admin/team' },
  { label: 'Invoices', icon: Receipt, href: '/admin/invoices' },
  { label: 'Storage', icon: HardDrive, href: '/admin/storage' },
  { label: 'Messages', icon: MessageSquare, href: '/admin/messages' },
  { label: 'Calendar', icon: Calendar, href: '/admin/calendar' },
  { label: 'Settings', icon: Settings, href: '/admin/settings' },
];

const clientNavItems: NavItem[] = [
  { label: 'Dashboard', icon: Briefcase, href: '/client/dashboard' },
  { label: 'Projects', icon: FolderKanban, href: '/client/projects' },
  { label: 'Invoices', icon: FileText, href: '/client/invoices' },
  { label: 'Storage', icon: HardDrive, href: '/client/storage' },
  { label: 'Messages', icon: MessageSquare, href: '/client/messages' },
  { label: 'Calendar', icon: Calendar, href: '/client/calendar' },
  { label: 'Settings', icon: Settings, href: '/client/settings' },
];

const editorNavItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/editor/dashboard' },
  { label: 'My Projects', icon: FolderKanban, href: '/editor/projects' },
  { label: 'Earnings', icon: DollarSign, href: '/editor/earnings' },
  { label: 'Storage', icon: HardDrive, href: '/editor/storage' },
  { label: 'Messages', icon: MessageSquare, href: '/editor/messages' },
  { label: 'Calendar', icon: Calendar, href: '/editor/calendar' },
  { label: 'Settings', icon: Settings, href: '/editor/settings' },
];

interface CollapsibleSidebarProps {
  role?: 'admin' | 'client' | 'editor';
}

export function CollapsibleSidebar({ role = 'admin' }: CollapsibleSidebarProps) {
  const location = useLocation();
  const { signOut } = useAuth();
  const { totalUnread } = useUnreadMessages();
  const { isCollapsed, toggleSidebar } = useSidebar();

  const navItems = role === 'admin' 
    ? adminNavItems 
    : role === 'client' 
      ? clientNavItems 
      : editorNavItems;

  return (
    <aside 
      className={cn(
        "bg-surface-dark border-r border-border/50 flex flex-col transition-all duration-300 ease-in-out flex-shrink-0 sticky top-0 h-screen overflow-y-auto",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center border-b border-border/50",
        isCollapsed ? "p-3 justify-center" : "p-4 justify-between"
      )}>
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
            <Command className="w-5 h-5 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <span className="text-xl font-bold text-foreground whitespace-nowrap">
              Veylo<span className="text-gradient">desk</span>
            </span>
          )}
        </Link>
        {!isCollapsed && <ThemeToggle />}
      </div>

      {/* Toggle Button */}
      <div className={cn(
        "px-3 py-2",
        isCollapsed ? "flex justify-center" : "flex justify-end"
      )}>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className={cn(
        "flex-1 space-y-1",
        isCollapsed ? "px-2" : "px-3"
      )}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const isMessages = item.label === 'Messages';
          
          const linkContent = (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg transition-colors relative",
                isCollapsed ? "justify-center p-3" : "px-4 py-3",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
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
              {isCollapsed && isMessages && totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </Link>
          );

          if (isCollapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>
                  {linkContent}
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      {/* Footer */}
      <div className={cn(
        "border-t border-border/50",
        isCollapsed ? "p-2" : "p-3"
      )}>
        {isCollapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-full h-10 text-muted-foreground hover:text-foreground"
                onClick={signOut}
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              Sign out
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={signOut}
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign out
          </Button>
        )}
        
        {isCollapsed && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="mt-2 flex justify-center">
                <ThemeToggle />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              Toggle theme
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </aside>
  );
}
