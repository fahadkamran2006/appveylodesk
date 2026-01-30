import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Lock, CreditCard, Loader2 } from 'lucide-react';

interface SubscriptionGuardProps {
  children: ReactNode;
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { isActive, loading } = useSubscription();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="relative">
        {/* Blurred/Disabled Content Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="blur-sm opacity-30 grayscale">
            {children}
          </div>
        </div>

        {/* Lock Overlay */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-[60vh] px-4">
          <div className="glass-card max-w-md w-full rounded-2xl p-8 text-center border border-border/50 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Subscription Required
            </h2>
            
            <p className="text-muted-foreground mb-6">
              Choose a plan to unlock full access to your dashboard and start managing your video editing projects.
            </p>

            <Button
              variant="hero"
              size="lg"
              className="w-full"
              asChild
            >
              <Link to="/pricing">
                <CreditCard className="w-4 h-4 mr-2" />
                Choose a Plan
              </Link>
            </Button>

            <p className="text-sm text-muted-foreground mt-4">
              All plans include a 14-day money-back guarantee
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
