import { useState } from 'react';
import { useSubscription, getCheckoutUrl } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Crown, Zap, Rocket, ExternalLink, Calendar, Users, HardDrive, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAgencyLimits } from '@/hooks/useAgencyLimits';

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
  const { isActive, planTier, subscriptionEndsAt, loading, agencyId } = useSubscription();
  const { currentClients, maxClients, storageUsedBytes, storageLimitBytes, formatBytes, refetch: refetchLimits } = useAgencyLimits();
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('yearly');
  const [portalLoading, setPortalLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  if (loading) {
    return (
      <Card className={cn('glass-card border-border/50', className)}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const currentPlan = planTier && PLAN_DETAILS[planTier as keyof typeof PLAN_DETAILS];
  const CurrentIcon = currentPlan?.icon || Zap;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleUpgrade = (plan: 'starter' | 'growth' | 'scale') => {
    if (!agencyId) return;
    const url = getCheckoutUrl(plan, billingInterval, agencyId);
    window.open(url, '_blank');
  };

  const openCustomerPortal = async () => {
    setPortalLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error('Please log in to manage your subscription');
        return;
      }

      const { data, error } = await supabase.functions.invoke('get-portal-url', {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (error) {
        console.error('Portal URL error:', error);
        toast.error('Failed to open billing portal');
        return;
      }

      if (data?.fallback && data?.message) {
        toast.info(data.message);
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        toast.error('Could not retrieve billing portal URL');
      }
    } catch (err) {
      console.error('Portal error:', err);
      toast.error('Failed to open billing portal');
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

        {/* Customer Portal - Always show for active subscribers */}
        {isActive && (
          <div className="space-y-3">
            <div className="flex gap-2">
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
                Manage Billing & Invoices
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
              Upgrade, downgrade, update payment method, or cancel your subscription
            </p>
          </div>
        )}

        <Separator />

        {/* Show Subscribe Options ONLY for inactive subscriptions */}
        {!isActive && (
          <div>
            <h4 className="font-medium text-foreground mb-3">Choose a Plan</h4>
            
            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <button
                onClick={() => setBillingInterval('monthly')}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  billingInterval === 'monthly'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval('yearly')}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  billingInterval === 'yearly'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Yearly
                <span className="ml-1 text-xs opacity-75">Save 17%</span>
              </button>
            </div>

            <div className="grid gap-3">
              {Object.entries(PLAN_DETAILS).map(([key, plan]) => {
                const PlanIcon = plan.icon;
                const price = billingInterval === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
                
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-border transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', plan.bgColor)}>
                        <PlanIcon className={cn('w-4 h-4', plan.color)} />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{plan.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {plan.clients} clients • {plan.storage}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold text-foreground">
                          ${price}
                          <span className="text-xs text-muted-foreground font-normal">
                            /{billingInterval === 'yearly' ? 'yr' : 'mo'}
                          </span>
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-w-[80px]"
                        onClick={() => handleUpgrade(key as 'starter' | 'growth' | 'scale')}
                      >
                        Subscribe
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Info message for active subscribers */}
        {isActive && (
          <div className="text-center py-4 px-6 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-sm text-muted-foreground">
              To upgrade, downgrade, or cancel your plan, use the{' '}
              <button 
                onClick={openCustomerPortal} 
                className="text-primary hover:underline font-medium"
                disabled={portalLoading}
              >
                Customer Portal
              </button>{' '}
              above.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
