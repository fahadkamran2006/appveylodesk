import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { SubscriptionGuard } from '@/components/SubscriptionGuard';
import { DashboardHeader } from '@/components/notifications/DashboardHeader';
import { usePushNotificationListener } from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  role: 'admin' | 'client' | 'editor';
  children: ReactNode;
  className?: string;
  hideHeader?: boolean;
}

// Routes that remain accessible without subscription (admin only)
const UNLOCKED_ADMIN_ROUTES = [
  '/admin/team',
  '/admin/clients',
  '/admin/settings',
];

export function DashboardLayout({ role, children, className, hideHeader = false }: DashboardLayoutProps) {
  const location = useLocation();
  
  // Activate push notification listener for all dashboard users
  usePushNotificationListener();
  
  // Determine if this route should bypass the subscription guard
  const shouldBypassGuard = role === 'admin' && UNLOCKED_ADMIN_ROUTES.some(
    route => location.pathname.startsWith(route)
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Desktop Sidebar - Hidden on mobile */}
      <div className="hidden md:block">
        <CollapsibleSidebar role={role} />
      </div>

      {/* Main Content */}
      <main className={cn(
        "flex-1 overflow-auto",
        // Padding adjustments for mobile vs desktop
        "p-4 md:p-8",
        // Ensure content doesn't get cut off by bottom nav on mobile
        "pb-20 md:pb-8",
        className
      )}>
        {/* Dashboard Header with Greeting, Notification Bell, and Profile */}
        {!hideHeader && <DashboardHeader />}

        <SubscriptionGuard bypass={shouldBypassGuard}>
          {children}
        </SubscriptionGuard>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav role={role} />
    </div>
  );
}
