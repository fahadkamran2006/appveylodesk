import { Link, useLocation } from 'react-router-dom';
import { Command, LayoutDashboard, FolderKanban, MessageSquare, DollarSign, LogOut, HardDrive, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/editor/dashboard' },
  { label: 'My Projects', icon: FolderKanban, href: '/editor/projects' },
  { label: 'Earnings', icon: DollarSign, href: '/editor/earnings' },
  { label: 'Storage', icon: HardDrive, href: '/editor/storage' },
  { label: 'Messages', icon: MessageSquare, href: '/editor/messages' },
  { label: 'Settings', icon: Settings, href: '/editor/settings' },
];

export const EditorSidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth();

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
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
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
