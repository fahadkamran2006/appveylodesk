import { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PADDLE_PORTAL_FALLBACK = 'https://customer-portal.paddle.com/cpl_01k5h492fx58w07rt521gam0rg';

/**
 * Banner shown to admins when their subscription is past-due or about to expire.
 * Detects failures from `subscription_ends_at` since Paddle webhook updates this on renewal.
 * - past_due: subscription_ends_at is in the past (renewal failed)
 * - expiring_soon: ends within next 3 days (likely card issue if no renewal queued)
 */
export function PaymentStatusBanner() {
  const { userRole } = useAuth();
  const { isActive, subscriptionEndsAt, planTier, loading } = useSubscription();
  const [portalLoading, setPortalLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Only admins manage billing
  if (userRole !== 'admin' || loading || dismissed) return null;

  // No subscription history → nothing to warn about (Subscribe page handles this)
  if (!subscriptionEndsAt || !planTier || planTier === 'starter') return null;

  const endsAt = new Date(subscriptionEndsAt);
  const now = new Date();
  const diffMs = endsAt.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Determine status
  let status: 'past_due' | 'expiring_soon' | null = null;
  if (!isActive && diffDays < 0 && diffDays > -30) {
    // Subscription ended within last 30 days → likely failed payment
    status = 'past_due';
  } else if (isActive && diffDays >= 0 && diffDays <= 3) {
    // Renews in <= 3 days → warn so they can fix card if needed
    status = 'expiring_soon';
  }

  if (!status) return null;

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        window.open(PADDLE_PORTAL_FALLBACK, '_blank');
        return;
      }

      const { data, error } = await supabase.functions.invoke('get-portal-url', {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });

      if (error || !data?.url) {
        window.open(PADDLE_PORTAL_FALLBACK, '_blank');
      } else {
        window.open(data.url, '_blank');
      }
    } catch {
      window.open(PADDLE_PORTAL_FALLBACK, '_blank');
    } finally {
      setPortalLoading(false);
    }
  };

  const config = status === 'past_due'
    ? {
        bg: 'bg-destructive/10 border-destructive/30',
        iconColor: 'text-destructive',
        title: 'Payment failed — action required',
        message: `Your last payment for the ${planTier} plan didn't go through. Update your card to keep your account active and avoid interruption.`,
        cta: 'Update payment method',
      }
    : {
        bg: 'bg-amber-500/10 border-amber-500/30',
        iconColor: 'text-amber-600 dark:text-amber-400',
        title: 'Subscription renews soon',
        message: `Your ${planTier} plan renews on ${endsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}. Make sure your payment method is up to date.`,
        cta: 'Manage billing',
      };

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border mb-4',
        config.bg
      )}
    >
      <AlertTriangle className={cn('h-5 w-5 shrink-0', config.iconColor)} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold', config.iconColor)}>{config.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{config.message}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          size="sm"
          variant={status === 'past_due' ? 'destructive' : 'default'}
          onClick={openPortal}
          disabled={portalLoading}
        >
          {portalLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <CreditCard className="w-4 h-4 mr-2" />
          )}
          {config.cta}
        </Button>
        {status === 'expiring_soon' && (
          <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
}
