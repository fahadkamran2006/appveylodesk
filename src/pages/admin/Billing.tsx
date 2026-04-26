import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription, openPaddleCheckout } from '@/hooks/useSubscription';
import { useAgencyLimits } from '@/hooks/useAgencyLimits';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Crown,
  Zap,
  Rocket,
  ExternalLink,
  Calendar,
  Users,
  HardDrive,
  Loader2,
  RefreshCw,
  CreditCard,
  CheckCircle2,
  ArrowUpRight,
  Receipt,
  ShieldCheck,
  FileText,
  Download,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type PlanKey = 'starter' | 'growth' | 'scale';

const PLANS: Record<PlanKey, {
  name: string;
  icon: typeof Zap;
  color: string;
  bgColor: string;
  borderColor: string;
  clients: number | 'Unlimited';
  storage: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
}> = {
  starter: {
    name: 'Starter',
    icon: Zap,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    clients: 5,
    storage: '200 GB',
    monthlyPrice: 29,
    yearlyPrice: 290,
    features: ['Up to 5 clients', '200 GB storage', 'Unlimited projects', 'Client portal', 'Email support'],
  },
  growth: {
    name: 'Growth',
    icon: Crown,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    clients: 25,
    storage: '1 TB',
    monthlyPrice: 79,
    yearlyPrice: 790,
    features: ['Up to 25 clients', '1 TB storage', 'White-label branding', 'Priority support', 'Advanced analytics'],
  },
  scale: {
    name: 'Scale',
    icon: Rocket,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    clients: 'Unlimited',
    storage: '3 TB',
    monthlyPrice: 149,
    yearlyPrice: 1490,
    features: ['Unlimited clients', '3 TB storage', 'Dedicated success manager', 'Custom integrations', 'SLA guarantee'],
  },
};

const PLAN_ORDER: PlanKey[] = ['starter', 'growth', 'scale'];

const BillingPage = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const { isActive, planTier, subscriptionEndsAt, loading: subLoading, agencyId } = useSubscription();
  const { currentClients, storageUsedBytes, storageLimitBytes, formatBytes, getStoragePercentage, refetch: refetchLimits } = useAgencyLimits();
  const navigate = useNavigate();

  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [portalLoading, setPortalLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<PlanKey | null>(null);

  // Redirect non-admins
  if (!authLoading && userRole && userRole !== 'admin') {
    navigate('/');
    return null;
  }

  const loading = authLoading || subLoading;

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
        return;
      }

      const { data, error } = await supabase.functions.invoke('get-portal-url', {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });

      if (error || !data?.url) {
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
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });

      if (error) {
        toast.error('Failed to sync subscription');
        return;
      }

      if (data?.error) {
        toast.error(data.message || data.error);
        return;
      }

      if (data?.success) {
        toast.success(data.message || 'Subscription synced successfully');
        refetchLimits();
        setTimeout(() => window.location.reload(), 800);
      }
    } catch {
      toast.error('Failed to sync subscription');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSelectPlan = async (plan: PlanKey) => {
    if (!agencyId) {
      toast.error('Agency not found. Please refresh and try again.');
      return;
    }

    // If user already has an active sub, route them to portal for plan changes
    if (isActive) {
      toast.info('Opening customer portal to manage your plan…');
      await openCustomerPortal();
      return;
    }

    setCheckoutLoadingPlan(plan);
    try {
      openPaddleCheckout(plan, billingInterval, agencyId, user?.email);
    } finally {
      setTimeout(() => setCheckoutLoadingPlan(null), 1500);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const currentPlan = planTier && PLANS[planTier as PlanKey];
  const CurrentIcon = currentPlan?.icon || Zap;

  return (
    <>
      <Helmet>
        <title>Billing & Subscription | Veylodesk</title>
        <meta name="description" content="Manage your Veylodesk subscription, change plans, and access your billing portal." />
      </Helmet>

      <DashboardLayout role="admin">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground">Billing & Subscription</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Manage your plan, payment method, and invoices in one place
              </p>
            </div>
          </div>

          {/* Current Plan Overview */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', currentPlan?.bgColor || 'bg-muted')}>
                    <CurrentIcon className={cn('w-6 h-6', currentPlan?.color || 'text-muted-foreground')} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg md:text-xl">
                        {currentPlan?.name || 'No Active Plan'}
                      </CardTitle>
                      <Badge variant={isActive ? 'default' : 'destructive'}>
                        {isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <CardDescription>
                      {isActive
                        ? `Renews on ${formatDate(subscriptionEndsAt)}`
                        : 'Choose a plan below to activate your subscription'}
                    </CardDescription>
                  </div>
                </div>

                {isActive && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={openCustomerPortal}
                      disabled={portalLoading}
                    >
                      {portalLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ExternalLink className="w-4 h-4 mr-2" />
                      )}
                      Customer Portal
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
                )}
              </div>
            </CardHeader>

            {currentPlan && (
              <CardContent>
                <Separator className="mb-4" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-elevated border border-border/50">
                    <Users className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {currentClients} / {typeof currentPlan.clients === 'number' ? currentPlan.clients : '∞'} Clients
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Used / Available</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-elevated border border-border/50">
                    <HardDrive className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {formatBytes(storageUsedBytes)} / {currentPlan.storage}
                      </p>
                      <Progress value={getStoragePercentage()} className="h-1 mt-2" />
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-elevated border border-border/50">
                    <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {formatDate(subscriptionEndsAt)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isActive ? 'Next renewal' : 'Expired on'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Plan Selection */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>{isActive ? 'Change your plan' : 'Choose a plan'}</CardTitle>
                  <CardDescription>
                    {isActive
                      ? 'Plan changes are managed securely via the Paddle customer portal'
                      : 'Pick the plan that fits your agency. Cancel or change anytime.'}
                  </CardDescription>
                </div>
                <Tabs value={billingInterval} onValueChange={(v) => setBillingInterval(v as 'monthly' | 'yearly')}>
                  <TabsList>
                    <TabsTrigger value="monthly">Monthly</TabsTrigger>
                    <TabsTrigger value="yearly">
                      Yearly
                      <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                        Save 17%
                      </Badge>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLAN_ORDER.map((key) => {
                  const plan = PLANS[key];
                  const Icon = plan.icon;
                  const isCurrent = isActive && planTier === key;
                  const price = billingInterval === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
                  const isLoadingThis = checkoutLoadingPlan === key;

                  return (
                    <div
                      key={key}
                      className={cn(
                        'relative rounded-xl border p-5 flex flex-col transition-all',
                        isCurrent
                          ? cn('border-2', plan.borderColor, 'bg-surface-elevated shadow-lg')
                          : 'border-border/50 bg-surface-elevated hover:border-border'
                      )}
                    >
                      {isCurrent && (
                        <Badge className="absolute -top-2 left-4" variant="default">
                          Current Plan
                        </Badge>
                      )}

                      <div className="flex items-center gap-3 mb-4">
                        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', plan.bgColor)}>
                          <Icon className={cn('w-5 h-5', plan.color)} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{plan.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {typeof plan.clients === 'number' ? `${plan.clients} clients` : 'Unlimited clients'}
                          </p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-foreground">${price}</span>
                          <span className="text-sm text-muted-foreground">
                            /{billingInterval === 'monthly' ? 'mo' : 'yr'}
                          </span>
                        </div>
                        {billingInterval === 'yearly' && (
                          <p className="text-xs text-muted-foreground mt-1">
                            ${(plan.yearlyPrice / 12).toFixed(0)}/mo billed yearly
                          </p>
                        )}
                      </div>

                      <ul className="space-y-2 mb-5 flex-1">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        variant={isCurrent ? 'outline' : key === 'growth' ? 'hero' : 'default'}
                        className="w-full"
                        disabled={isCurrent || isLoadingThis}
                        onClick={() => handleSelectPlan(key)}
                      >
                        {isLoadingThis ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : isCurrent ? (
                          'Current Plan'
                        ) : isActive ? (
                          <>
                            Change to {plan.name}
                            <ArrowUpRight className="w-4 h-4 ml-2" />
                          </>
                        ) : (
                          `Choose ${plan.name}`
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Customer Portal Card */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Payment method & invoices
              </CardTitle>
              <CardDescription>
                Update your card, download invoices, and manage billing details in the secure Paddle portal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={openCustomerPortal}
                disabled={portalLoading}
              >
                {portalLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                Open Customer Portal
              </Button>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-border/50">
                <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Secure billing via Paddle</p>
                  <p>
                    Paddle is our merchant of record and handles all payments, taxes, and refunds.
                    Your payment information is never stored on Veylodesk servers.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </>
  );
};

export default BillingPage;
