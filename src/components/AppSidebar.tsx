import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Command,
  LayoutDashboard,
  Users,
  FolderKanban,
  Receipt,
  Settings,
  LogOut,
  MessageSquare,
  Briefcase,
  FileText,
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
  { label: 'Invoices', icon: Receipt, href: '/admin/invoices' },
  { label: 'Messages', icon: MessageSquare, href: '/admin/messages' },
  { label: 'Settings', icon: Settings, href: '/admin/settings' },
];

const clientNavItems: NavItem[] = [
  { label: 'Portal', icon: Briefcase, href: '/client/portal' },
  { label: 'Projects', icon: FolderKanban, href: '/client/projects' },
  { label: 'Invoices', icon: FileText, href: '/client/invoices' },
  { label: 'Messages', icon: MessageSquare, href: '/client/messages' },
  { label: 'Settings', icon: Settings, href: '/client/settings' },
];

const editorNavItems: NavItem[] = [
  { label: 'Workspace', icon: LayoutDashboard, href: '/editor/workspace' },
  { label: 'My Tasks', icon: FolderKanban, href: '/editor/tasks' },
  { label: 'Messages', icon: MessageSquare, href: '/editor/messages' },
  { label: 'Earnings', icon: Receipt, href: '/editor/earnings' },
  { label: 'Settings', icon: Settings, href: '/editor/settings' },
];

interface AppSidebarProps {
  role?: 'admin' | 'client' | 'editor';
}

export function AppSidebar({ role = 'admin' }: AppSidebarProps) {
  const location = useLocation();
  const { signOut } = useAuth();

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
              {item.label}
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
