import { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Crown, Zap, Rocket, ExternalLink, Calendar, Users, HardDrive, Loader2, RefreshCw, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAgencyLimits } from '@/hooks/useAgencyLimits';
import { ChangePlanModal } from './ChangePlanModal';

interface SubscriptionSettingsProps {
  className?: string;
}

const PLAN_DETAILS = {
  starter: {
    name: 'Starter',
    icon: Zap,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    clients: 5,
    storage: '200 GB',
    monthlyPrice: 29,
    yearlyPrice: 290,
  },
  growth: {
    name: 'Growth',
    icon: Crown,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    clients: 25,
    storage: '1 TB',
    monthlyPrice: 79,
    yearlyPrice: 790,
  },
  scale: {
    name: 'Scale',
    icon: Rocket,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    clients: 'Unlimited',
    storage: '3 TB',
    monthlyPrice: 149,
    yearlyPrice: 1490,
  },
};

export const SubscriptionSettings = ({ className }: SubscriptionSettingsProps) => {
  const { isActive, isFree, planTier, subscriptionEndsAt, loading, agencyId } = useSubscription();
  const { currentClients, maxClients, storageUsedBytes, storageLimitBytes, formatBytes, refetch: refetchLimits } = useAgencyLimits();
  const [syncLoading, setSyncLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);

  if (loading) {
    return (
      <Card className={cn('glass-card border-border/50', className)}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const FREE_PLAN_DETAILS = {
    name: 'Free',
    icon: Zap,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    clients: 1,
    storage: '2 GB',
  } as const;

  const currentPlan = isFree
    ? FREE_PLAN_DETAILS
    : (planTier && PLAN_DETAILS[planTier as keyof typeof PLAN_DETAILS]);
  const CurrentIcon = currentPlan?.icon || Zap;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };


  const openCustomerPortal = async () => {
    setPortalLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error('Please log in first');
        setPortalLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('get-portal-url', {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });

      if (error || !data?.url) {
        // Fallback to static portal link
        window.open('https://customer-portal.paddle.com/cpl_01k5h492fx58w07rt521gam0rg', '_blank');
      } else {
        window.open(data.url, '_blank');
      }
    } catch {
      window.open('https://customer-portal.paddle.com/cpl_01k5h492fx58w07rt521gam0rg', '_blank');
    } finally {
      setPortalLoading(false);
    }
  };

  const syncSubscription = async () => {
    setSyncLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error('Please log in to sync your subscription');
        return;
      }

      const { data, error } = await supabase.functions.invoke('sync-subscription', {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (error) {
        console.error('Sync error:', error);
        toast.error('Failed to sync subscription');
        return;
      }

      if (data?.error) {
        toast.error(data.message || data.error);
        return;
      }

      if (data?.success) {
        toast.success(data.message || 'Subscription synced successfully');
        // Refetch limits to update the UI
        refetchLimits();
        // Force a page reload to update all subscription state
        window.location.reload();
      }
    } catch (err) {
      console.error('Sync error:', err);
      toast.error('Failed to sync subscription');
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <Card className={cn('glass-card border-border/50', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="w-5 h-5" />
          Subscription
        </CardTitle>
        <CardDescription>
          Manage your subscription plan and billing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Plan */}
        <div className="rounded-lg border border-border/50 bg-surface-elevated p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', currentPlan?.bgColor || 'bg-muted')}>
                <CurrentIcon className={cn('w-5 h-5', currentPlan?.color || 'text-muted-foreground')} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">
                    {currentPlan?.name || 'No Plan'}
                  </h3>
                  <Badge variant={isActive ? 'default' : 'destructive'}>
                    {isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Current subscription plan
                </p>
              </div>
            </div>
          </div>

          {currentPlan && (
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {currentClients}/{typeof currentPlan.clients === 'number' ? currentPlan.clients : '∞'} Clients
                  </p>
                  <p className="text-xs text-muted-foreground">Used / Max</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {formatBytes(storageUsedBytes)} / {currentPlan.storage}
                  </p>
                  <p className="text-xs text-muted-foreground">Storage Used</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {formatDate(subscriptionEndsAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isActive ? 'Renews' : 'Expired'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Free plan: show upgrade CTA, not Paddle portal */}
        {isFree && (
          <>
            <Separator />
            <div className="text-center py-6 px-6 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
              <h4 className="font-semibold text-foreground">You're on the Free plan</h4>
              <p className="text-sm text-muted-foreground">
                Upgrade to unlock more clients, projects, storage, and remove the "Powered by Veylodesk" branding.
              </p>
              <Button variant="hero" asChild>
                <a href="/subscribe">Upgrade Plan</a>
              </Button>
            </div>
          </>
        )}

        {/* Paid active subscribers: in-app plan change + billing portal */}
        {isActive && !isFree && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="hero"
                className="flex-1"
                onClick={() => setChangePlanOpen(true)}
              >
                <ArrowUpDown className="w-4 h-4 mr-2" />
                Change Plan
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={openCustomerPortal}
                disabled={portalLoading}
              >
                {portalLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                Billing & Invoices
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={syncSubscription}
                disabled={syncLoading}
                title="Sync subscription status"
              >
                {syncLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Change Plan upgrades/downgrades instantly. Use Billing & Invoices to update payment method or cancel.
            </p>
          </div>
        )}


        {/* Show subscribe link for inactive (no plan at all) */}
        {!isActive && !isFree && (
          <>
            <Separator />
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">
                You don't have an active subscription.
              </p>
              <Button variant="hero" asChild>
                <a href="/subscribe">Choose a Plan</a>
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <ChangePlanModal
        open={changePlanOpen}
        onOpenChange={setChangePlanOpen}
        currentPlan={(planTier as 'starter' | 'growth' | 'scale' | null) ?? null}
      />
    </Card>
  );
};
