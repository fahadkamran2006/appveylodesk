import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderKanban,
  MessageSquare,
  Settings,
  Menu,
  X,
  Users,
  UsersRound,
  Receipt,
  HardDrive,
  Calendar,
  DollarSign,
  FileText,
  Briefcase,
  LogOut,
} from 'lucide-react';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
}

const adminNavItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/admin/dashboard' },
  { label: 'Projects', icon: FolderKanban, href: '/admin/projects' },
  { label: 'Messages', icon: MessageSquare, href: '/admin/messages' },
  { label: 'Settings', icon: Settings, href: '/admin/settings' },
];

const adminAllNavItems: NavItem[] = [
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
  { label: 'Messages', icon: MessageSquare, href: '/client/messages' },
  { label: 'Settings', icon: Settings, href: '/client/settings' },
];

const clientAllNavItems: NavItem[] = [
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
  { label: 'Projects', icon: FolderKanban, href: '/editor/projects' },
  { label: 'Messages', icon: MessageSquare, href: '/editor/messages' },
  { label: 'Settings', icon: Settings, href: '/editor/settings' },
];

const editorAllNavItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/editor/dashboard' },
  { label: 'My Projects', icon: FolderKanban, href: '/editor/projects' },
  { label: 'Earnings', icon: DollarSign, href: '/editor/earnings' },
  { label: 'Work Logs', icon: FileText, href: '/editor/work-logs' },
  { label: 'Storage', icon: HardDrive, href: '/editor/storage' },
  { label: 'Messages', icon: MessageSquare, href: '/editor/messages' },
  { label: 'Calendar', icon: Calendar, href: '/editor/calendar' },
  { label: 'Settings', icon: Settings, href: '/editor/settings' },
];

interface MobileBottomNavProps {
  role?: 'admin' | 'client' | 'editor';
}

export function MobileBottomNav({ role = 'admin' }: MobileBottomNavProps) {
  const location = useLocation();
  const { signOut } = useAuth();
  const { totalUnread } = useUnreadMessages();
  const [menuOpen, setMenuOpen] = useState(false);

  const bottomNavItems = role === 'admin' 
    ? adminNavItems 
    : role === 'client' 
      ? clientNavItems 
      : editorNavItems;

  const allNavItems = role === 'admin' 
    ? adminAllNavItems 
    : role === 'client' 
      ? clientAllNavItems 
      : editorAllNavItems;

  return (
    <>
      {/* Bottom Navigation Bar - Fixed at bottom */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-dark/95 backdrop-blur-lg border-t border-border/50 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {bottomNavItems.slice(0, 3).map((item) => {
            const isActive = location.pathname === item.href;
            const isMessages = item.label === 'Messages';
            
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-0.5 relative transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground"
                )}
              >
                <div className="relative">
                  <item.icon className="w-5 h-5" />
                  {isMessages && totalUnread > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center font-medium">
                      {totalUnread > 9 ? '9+' : totalUnread}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                )}
              </Link>
            );
          })}
          
          {/* More Menu */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors",
                  menuOpen ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Menu className="w-5 h-5" />
                <span className="text-[10px] font-medium">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-3xl pb-safe">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-foreground">Menu</h3>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-3 mb-6">
                {allNavItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  const isMessages = item.label === 'Messages';
                  
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 rounded-xl transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      <div className="relative">
                        <item.icon className="w-5 h-5" />
                        {isMessages && totalUnread > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                            {totalUnread > 9 ? '9+' : totalUnread}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-medium text-center">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setMenuOpen(false);
                  signOut();
                }}
              >
                <LogOut className="w-5 h-5 mr-3" />
                Sign out
              </Button>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
      
      {/* Spacer to prevent content from being hidden behind bottom nav */}
      <div className="md:hidden h-16 safe-area-bottom" />
    </>
  );
}
