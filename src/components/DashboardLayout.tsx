import { ReactNode } from 'react';
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  role: 'admin' | 'client' | 'editor';
  children: ReactNode;
  className?: string;
}

export function DashboardLayout({ role, children, className }: DashboardLayoutProps) {
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
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav role={role} />
    </div>
  );
}
