import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar';
import { StaffSidebar } from '@/components/StaffSidebar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { SubscriptionGuard } from '@/components/SubscriptionGuard';
import { DashboardHeader } from '@/components/notifications/DashboardHeader';
import { RestrictionBanner } from '@/components/RestrictionBanner';
import { PaymentStatusBanner } from '@/components/PaymentStatusBanner';
import { usePushNotificationListener } from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  role: 'admin' | 'client' | 'editor' | 'staff';
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
        {role === 'staff' ? <StaffSidebar /> : <CollapsibleSidebar role={role} />}
      </div>

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 overflow-auto",
          // Padding adjustments for mobile vs desktop
          "px-4 md:px-8",
          "pt-[max(1rem,env(safe-area-inset-top))] md:pt-8",
          // Ensure content doesn't get cut off by bottom nav on mobile
          "pb-20 md:pb-8",
          className
        )}
      >


        {/* Dashboard Header with Greeting, Notification Bell, and Profile */}
        {!hideHeader && <DashboardHeader />}
        
        <RestrictionBanner />
        <PaymentStatusBanner />

        <SubscriptionGuard bypass={shouldBypassGuard}>
          {children}
        </SubscriptionGuard>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav role={role} />
    </div>
  );
}
