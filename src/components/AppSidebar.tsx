import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  { label: 'Payroll', icon: Receipt, href: '/admin/payroll' },
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
  { label: 'My Tasks', icon: FolderKanban, href: '/editor/projects' },
  { label: 'Storage', icon: HardDrive, href: '/editor/storage' },
  { label: 'Messages', icon: MessageSquare, href: '/editor/messages' },
  { label: 'Earnings', icon: Receipt, href: '/editor/earnings' },
  { label: 'Calendar', icon: Calendar, href: '/editor/calendar' },
  { label: 'Settings', icon: Settings, href: '/editor/settings' },
];

interface AppSidebarProps {
  role?: 'admin' | 'client' | 'editor';
}

export function AppSidebar({ role = 'admin' }: AppSidebarProps) {
  const location = useLocation();
  const { signOut } = useAuth();
  const { totalUnread } = useUnreadMessages();

  const navItems = role === 'admin' 
    ? adminNavItems 
    : role === 'client' 
      ? clientNavItems 
      : editorNavItems;

  return (
    <aside className="w-64 bg-surface-dark border-r border-border/50 flex flex-col">
      <div className="p-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Command className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">
            Veylo<span className="text-gradient">desk</span>
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
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground"
          onClick={signOut}
        >
          <LogOut className="w-5 h-5 mr-3" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
