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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  ArrowDownRight,
  Receipt,
  ShieldCheck,
  FileText,
  Download,
  History,
  Sparkles,
  Clock,
  Info,
  Bell,
  AlertTriangle,
  RotateCw,
  FileCheck,
  Activity,
  Sparkle,
  XCircle,
  RefreshCcw,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  const [pendingChange, setPendingChange] = useState<PlanKey | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  // Proration preview state
  interface ProrationPreview {
    currency: string;
    immediate: {
      grand_total_minor: string | null;
      subtotal_minor: string | null;
      tax_minor: string | null;
    } | null;
    next_billing: {
      grand_total_minor: string | null;
      billed_at: string | null;
      currency: string;
    } | null;
  }
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProrationPreview | null>(null);

  // Billing history state
  interface BillingTransaction {
    id: string;
    status: string;
    invoice_number: string | null;
    billed_at: string;
    currency: string;
    grand_total: string;
    description: string;
    invoice_url: string | null;
  }
  const [history, setHistory] = useState<BillingTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        setHistoryError('Please log in to view billing history');
        return;
      }
      const { data, error } = await supabase.functions.invoke('paddle-billing-history', {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });
      if (error) {
        setHistoryError('Could not load billing history');
        return;
      }
      setHistory(data?.transactions ?? []);
    } catch {
      setHistoryError('Could not load billing history');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    // AdminOnlyGuard ensures only admins reach this component
    if (!authLoading) {
      fetchHistory();
    }
  }, [authLoading, fetchHistory]);

  // Billing notification preferences (persisted per agency in localStorage)
  interface BillingNotifPrefs {
    masterEnabled: boolean;
    paymentFailures: boolean;
    renewals: boolean;
    invoiceReady: boolean;
  }
  const DEFAULT_PREFS: BillingNotifPrefs = {
    masterEnabled: true,
    paymentFailures: true,
    renewals: true,
    invoiceReady: true,
  };
  const [notifPrefs, setNotifPrefs] = useState<BillingNotifPrefs>(DEFAULT_PREFS);

  const prefsKey = agencyId ? `billing-notif-prefs:${agencyId}` : null;

  useEffect(() => {
    if (!prefsKey) return;
    try {
      const raw = localStorage.getItem(prefsKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<BillingNotifPrefs>;
        setNotifPrefs({ ...DEFAULT_PREFS, ...parsed });
      }
    } catch {
      // ignore corrupt prefs
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsKey]);

  const updateNotifPref = (key: keyof BillingNotifPrefs, value: boolean) => {
    setNotifPrefs((prev) => {
      const next = { ...prev, [key]: value };
      if (prefsKey) {
        try {
          localStorage.setItem(prefsKey, JSON.stringify(next));
        } catch {
          // ignore quota errors
        }
      }
      if (key === 'masterEnabled') {
        toast.success(value ? 'Billing alerts turned on' : 'Billing alerts turned off');
      } else {
        toast.success('Notification preference saved');
      }
      return next;
    });
  };

  // Track when the user last manually synced subscription data with Paddle
  const lastSyncKey = agencyId ? `billing-last-sync:${agencyId}` : null;
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  useEffect(() => {
    if (!lastSyncKey) return;
    try {
      const raw = localStorage.getItem(lastSyncKey);
      if (raw) setLastSyncAt(raw);
    } catch {
      // ignore
    }
  }, [lastSyncKey]);

  const formatMoney = (amountMinor: string, currency: string) => {
    const num = Number(amountMinor) / 100;
    if (Number.isNaN(num)) return `${amountMinor} ${currency}`;
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
      }).format(num);
    } catch {
      return `$${num.toFixed(2)}`;
    }
  };

  const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (s === 'completed' || s === 'paid' || s === 'billed') return 'default';
    if (s === 'past_due' || s === 'canceled') return 'destructive';
    return 'secondary';
  };

  // Access control is handled by AdminOnlyGuard wrapping this route in App.tsx,
  // so non-admins never reach this component. No in-render redirect needed.

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
        const stamp = new Date().toISOString();
        setLastSyncAt(stamp);
        if (lastSyncKey) {
          try {
            localStorage.setItem(lastSyncKey, stamp);
          } catch {
            // ignore
          }
        }
        setTimeout(() => window.location.reload(), 800);
      }
    } catch {
      toast.error('Failed to sync subscription');
    } finally {
      setSyncLoading(false);
    }
  };

  // Compare plans by tier order to determine upgrade vs downgrade
  const getChangeKind = (target: PlanKey): 'upgrade' | 'downgrade' | 'same' | 'new' => {
    if (!isActive || !planTier) return 'new';
    const currentIdx = PLAN_ORDER.indexOf(planTier as PlanKey);
    const targetIdx = PLAN_ORDER.indexOf(target);
    if (currentIdx === -1) return 'new';
    if (currentIdx === targetIdx) return 'same';
    return targetIdx > currentIdx ? 'upgrade' : 'downgrade';
  };

  const handleSelectPlan = async (plan: PlanKey) => {
    if (!agencyId) {
      toast.error('Agency not found. Please refresh and try again.');
      return;
    }

    // Active subscriber → confirm change first, then route to portal
    if (isActive) {
      setPendingChange(plan);
      return;
    }

    // No active sub → direct checkout
    setCheckoutLoadingPlan(plan);
    try {
      openPaddleCheckout(plan, billingInterval, agencyId, user?.email);
    } finally {
      setTimeout(() => setCheckoutLoadingPlan(null), 1500);
    }
  };

  // Fetch a Paddle proration preview whenever the user opens the change dialog
  const fetchPreview = useCallback(async (plan: PlanKey) => {
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        setPreviewError('Please log in to preview this change.');
        return;
      }
      const { data, error } = await supabase.functions.invoke('paddle-preview-change', {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
        body: { plan, interval: billingInterval, proration_mode: 'prorated_immediately' },
      });
      if (error) {
        setPreviewError("We couldn't load a proration preview. You can still continue to the customer portal.");
        return;
      }
      if (data?.error) {
        if (data.error === 'no_subscription') {
          setPreviewError('No active subscription was found to preview against.');
        } else {
          setPreviewError(data.message || "We couldn't load a proration preview.");
        }
        return;
      }
      setPreview(data as ProrationPreview);
    } catch {
      setPreviewError("We couldn't load a proration preview. You can still continue to the customer portal.");
    } finally {
      setPreviewLoading(false);
    }
  }, [billingInterval]);

  useEffect(() => {
    if (pendingChange) {
      fetchPreview(pendingChange);
    } else {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
    }
  }, [pendingChange, fetchPreview]);

  const confirmPlanChange = async () => {
    setPendingChange(null);
    toast.info('Opening customer portal to complete your plan change…');
    await openCustomerPortal();
  };

  const confirmCancelSubscription = async () => {
    setCancelOpen(false);
    toast.info('Opening customer portal to finish cancelling your subscription…');
    await openCustomerPortal();
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
                  <div className="flex flex-wrap gap-2">
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
                      variant="outline"
                      onClick={() => setCancelOpen(true)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancel subscription
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

                      {(() => {
                        const kind = getChangeKind(key);
                        return (
                          <Button
                            variant={
                              isCurrent
                                ? 'outline'
                                : kind === 'downgrade'
                                ? 'outline'
                                : key === 'growth'
                                ? 'hero'
                                : 'default'
                            }
                            className="w-full"
                            disabled={isCurrent || isLoadingThis}
                            onClick={() => handleSelectPlan(key)}
                          >
                            {isLoadingThis ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : isCurrent ? (
                              'Current Plan'
                            ) : kind === 'upgrade' ? (
                              <>
                                <ArrowUpRight className="w-4 h-4 mr-2" />
                                Upgrade to {plan.name}
                              </>
                            ) : kind === 'downgrade' ? (
                              <>
                                <ArrowDownRight className="w-4 h-4 mr-2" />
                                Downgrade to {plan.name}
                              </>
                            ) : (
                              `Choose ${plan.name}`
                            )}
                          </Button>
                        );
                      })()}
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

          {/* Billing notification preferences */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Billing notifications
                  </CardTitle>
                  <CardDescription>
                    Choose which billing emails you'd like to receive. Critical security and legal notices are always sent.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40 border border-border/50">
                  <div className="text-right">
                    <Label htmlFor="billing-notif-master" className="text-sm font-medium cursor-pointer">
                      All billing alerts
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      {notifPrefs.masterEnabled ? 'Currently on' : 'Currently off'}
                    </p>
                  </div>
                  <Switch
                    id="billing-notif-master"
                    checked={notifPrefs.masterEnabled}
                    onCheckedChange={(v) => updateNotifPref('masterEnabled', v)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  'space-y-2 transition-opacity',
                  !notifPrefs.masterEnabled && 'opacity-50 pointer-events-none'
                )}
                aria-disabled={!notifPrefs.masterEnabled}
              >
                <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border/50 hover:border-border transition-colors">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <Label htmlFor="notif-payment-failures" className="text-sm font-medium cursor-pointer">
                        Payment failures
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Get notified immediately if your card is declined or a renewal charge fails.
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="notif-payment-failures"
                    checked={notifPrefs.paymentFailures}
                    onCheckedChange={(v) => updateNotifPref('paymentFailures', v)}
                    disabled={!notifPrefs.masterEnabled}
                  />
                </div>

                <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border/50 hover:border-border transition-colors">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <RotateCw className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <Label htmlFor="notif-renewals" className="text-sm font-medium cursor-pointer">
                        Renewal reminders
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        A heads-up email a few days before your subscription renews.
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="notif-renewals"
                    checked={notifPrefs.renewals}
                    onCheckedChange={(v) => updateNotifPref('renewals', v)}
                    disabled={!notifPrefs.masterEnabled}
                  />
                </div>

                <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border/50 hover:border-border transition-colors">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <FileCheck className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <Label htmlFor="notif-invoice-ready" className="text-sm font-medium cursor-pointer">
                        Invoice ready
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Receive a copy of every new invoice as soon as it's generated.
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="notif-invoice-ready"
                    checked={notifPrefs.invoiceReady}
                    onCheckedChange={(v) => updateNotifPref('invoiceReady', v)}
                    disabled={!notifPrefs.masterEnabled}
                  />
                </div>
              </div>

              <div className="flex items-start gap-3 mt-4 p-3 rounded-lg bg-muted/30 border border-border/50">
                <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Preferences are saved instantly. Critical notices (refunds, plan cancellations, security alerts) are always delivered regardless of these settings.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Subscription events timeline */}
          {(() => {
            type TimelineEvent = {
              id: string;
              kind: 'start' | 'renewal' | 'failed' | 'refund' | 'scheduled_cancel' | 'sync';
              title: string;
              description?: string;
              at: string;
              amount?: string;
            };

            const events: TimelineEvent[] = [];

            // 1. Subscription start — earliest completed/billed transaction
            const sortedAsc = [...history].sort(
              (a, b) => new Date(a.billed_at).getTime() - new Date(b.billed_at).getTime()
            );
            const first = sortedAsc[0];
            if (first) {
              events.push({
                id: `start-${first.id}`,
                kind: 'start',
                title: 'Subscription started',
                description: first.description,
                at: first.billed_at,
                amount: formatMoney(first.grand_total, first.currency),
              });
            }

            // 2. Renewals & failed payments — every subsequent transaction
            sortedAsc.slice(1).forEach((tx) => {
              const isFailed = tx.status === 'past_due' || tx.status === 'canceled';
              const isRefund = tx.status === 'refunded';
              events.push({
                id: tx.id,
                kind: isFailed ? 'failed' : isRefund ? 'refund' : 'renewal',
                title: isFailed
                  ? 'Payment failed'
                  : isRefund
                    ? 'Refund issued'
                    : 'Subscription renewed',
                description: tx.description,
                at: tx.billed_at,
                amount: formatMoney(tx.grand_total, tx.currency),
              });
            });

            // 3. Scheduled cancellation — set when subscription_ends_at is in the future
            if (isActive && subscriptionEndsAt && new Date(subscriptionEndsAt) > new Date()) {
              events.push({
                id: 'scheduled-cancel',
                kind: 'scheduled_cancel',
                title: 'Cancellation scheduled',
                description: `Your plan will end on ${formatDate(subscriptionEndsAt)}. You'll keep access until then.`,
                at: subscriptionEndsAt,
              });
            }

            // 4. Last manual sync
            if (lastSyncAt) {
              events.push({
                id: 'last-sync',
                kind: 'sync',
                title: 'Subscription synced with Paddle',
                description: 'You manually refreshed billing data from the payment provider.',
                at: lastSyncAt,
              });
            }

            // Sort newest → oldest
            events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

            const eventStyle = (kind: TimelineEvent['kind']) => {
              switch (kind) {
                case 'start':
                  return { Icon: Sparkle, dot: 'bg-primary text-primary-foreground', ring: 'ring-primary/30' };
                case 'renewal':
                  return { Icon: RefreshCcw, dot: 'bg-emerald-500 text-white', ring: 'ring-emerald-500/30' };
                case 'failed':
                  return { Icon: AlertTriangle, dot: 'bg-destructive text-destructive-foreground', ring: 'ring-destructive/30' };
                case 'refund':
                  return { Icon: ArrowDownRight, dot: 'bg-amber-500 text-white', ring: 'ring-amber-500/30' };
                case 'scheduled_cancel':
                  return { Icon: XCircle, dot: 'bg-amber-500 text-white', ring: 'ring-amber-500/30' };
                case 'sync':
                  return { Icon: RotateCw, dot: 'bg-muted text-muted-foreground', ring: 'ring-border' };
              }
            };

            const formatDateTime = (s: string) => {
              const d = new Date(s);
              if (Number.isNaN(d.getTime())) return s;
              return d.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              });
            };

            return (
              <Card className="glass-card border-border/50">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        Subscription events
                      </CardTitle>
                      <CardDescription>
                        A chronological view of plan changes, renewals, cancellations, and the last time we synced with Paddle.
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={syncSubscription}
                      disabled={syncLoading}
                    >
                      {syncLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RotateCw className="w-4 h-4 mr-2" />
                      )}
                      Sync now
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {historyLoading && events.length === 0 ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : events.length === 0 ? (
                    <div className="text-center py-10 px-4 rounded-lg bg-muted/30 border border-dashed border-border/60">
                      <Activity className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
                      <p className="text-sm font-medium text-foreground">No subscription events yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Once you subscribe, every renewal, plan change, and sync will appear here.
                      </p>
                    </div>
                  ) : (
                    <ol className="relative space-y-5 pl-2">
                      {/* Vertical line */}
                      <div
                        className="absolute left-[18px] top-2 bottom-2 w-px bg-border"
                        aria-hidden="true"
                      />
                      {events.map((ev) => {
                        const { Icon, dot, ring } = eventStyle(ev.kind);
                        return (
                          <li key={ev.id} className="relative flex gap-4">
                            <div
                              className={cn(
                                'relative z-10 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ring-4 ring-background',
                                dot,
                                ring
                              )}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0 pt-1 pb-1">
                              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                                <p className="text-sm font-semibold text-foreground">{ev.title}</p>
                                {ev.amount && (
                                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                                    {ev.amount}
                                  </span>
                                )}
                              </div>
                              {ev.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {ev.description}
                                </p>
                              )}
                              <p className="text-[11px] text-muted-foreground/80 mt-1 flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                {formatDateTime(ev.at)}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* Billing History */}
          <Card className="glass-card border-border/50">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Billing history
                  </CardTitle>
                  <CardDescription>
                    Past invoices and payment receipts from Paddle. Click any row to view or download the hosted document.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchHistory}
                  disabled={historyLoading}
                >
                  {historyLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading && history.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : historyError ? (
                <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20 text-sm text-destructive">
                  {historyError}
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-10 px-4 rounded-lg bg-muted/30 border border-dashed border-border/60">
                  <FileText className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">No billing history yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Once you subscribe, your invoices and receipts will appear here.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-surface-elevated hover:bg-surface-elevated">
                        <TableHead className="w-[140px]">Invoice</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[140px]">Date</TableHead>
                        <TableHead className="w-[110px]">Status</TableHead>
                        <TableHead className="w-[120px] text-right">Amount</TableHead>
                        <TableHead className="w-[120px] text-right">Document</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="font-medium text-foreground">
                            <span className="tabular-nums text-sm">
                              {tx.invoice_number || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[280px] truncate">
                            {tx.description}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(tx.billed_at)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(tx.status)} className="capitalize text-[10px]">
                              {tx.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-foreground tabular-nums text-sm">
                            {formatMoney(tx.grand_total, tx.currency)}
                          </TableCell>
                          <TableCell className="text-right">
                            {tx.invoice_url ? (
                              <Button variant="outline" size="sm" asChild>
                                <a
                                  href={tx.invoice_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Download invoice ${tx.invoice_number || ''}`}
                                >
                                  <Download className="w-3.5 h-3.5 mr-1.5" />
                                  PDF
                                </a>
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Plan change confirmation dialog — explains what changes immediately vs next cycle */}
        <AlertDialog open={pendingChange !== null} onOpenChange={(open) => !open && setPendingChange(null)}>
          <AlertDialogContent className="max-w-lg">
            {pendingChange && (() => {
              const target = PLANS[pendingChange];
              const current = currentPlan;
              const kind = getChangeKind(pendingChange);
              const isUpgrade = kind === 'upgrade';
              const TargetIcon = target.icon;
              return (
                <>
                  <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', target.bgColor)}>
                        <TargetIcon className={cn('w-5 h-5', target.color)} />
                      </div>
                      <div>
                        <AlertDialogTitle className="text-left">
                          {isUpgrade ? 'Upgrade' : 'Downgrade'} to {target.name}?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-left text-xs mt-0.5">
                          {current?.name} → {target.name}
                        </AlertDialogDescription>
                      </div>
                    </div>
                  </AlertDialogHeader>

                  <div className="space-y-3">
                    {/* Immediate changes */}
                    <div className={cn(
                      'p-3 rounded-lg border',
                      isUpgrade ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border/50'
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className={cn('w-4 h-4', isUpgrade ? 'text-primary' : 'text-muted-foreground')} />
                        <p className="text-sm font-semibold text-foreground">Effective immediately</p>
                      </div>
                      {isUpgrade ? (
                        <ul className="text-xs text-muted-foreground space-y-1.5 ml-6 list-disc">
                          <li>
                            Client limit increases to{' '}
                            <span className="font-medium text-foreground">
                              {typeof target.clients === 'number' ? target.clients : 'Unlimited'}
                            </span>
                          </li>
                          <li>
                            Storage increases to{' '}
                            <span className="font-medium text-foreground">{target.storage}</span>
                          </li>
                          <li>All {target.name} features unlocked</li>
                          <li>You'll be charged a prorated amount for the rest of this cycle</li>
                        </ul>
                      ) : (
                        <ul className="text-xs text-muted-foreground space-y-1.5 ml-6 list-disc">
                          <li>You keep full {current?.name} access until your current cycle ends</li>
                          <li>No refund is issued for the unused portion</li>
                        </ul>
                      )}
                    </div>

                    {/* Next cycle */}
                    <div className="p-3 rounded-lg border border-border/50 bg-surface-elevated">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm font-semibold text-foreground">
                          Next billing cycle ({formatDate(subscriptionEndsAt)})
                        </p>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-1.5 ml-6 list-disc">
                        <li>
                          You'll be billed{' '}
                          <span className="font-medium text-foreground">
                            ${billingInterval === 'monthly' ? target.monthlyPrice : target.yearlyPrice}/
                            {billingInterval === 'monthly' ? 'mo' : 'yr'}
                          </span>{' '}
                          on the {target.name} plan
                        </li>
                        {!isUpgrade && (
                          <>
                            <li>
                              Client limit drops to{' '}
                              <span className="font-medium text-foreground">
                                {typeof target.clients === 'number' ? target.clients : 'Unlimited'}
                              </span>
                            </li>
                            <li>
                              Storage drops to{' '}
                              <span className="font-medium text-foreground">{target.storage}</span>
                              {currentPlan && storageUsedBytes > 0 && (
                                <span className="text-amber-600 dark:text-amber-400">
                                  {' '}— make sure you're under this limit
                                </span>
                              )}
                            </li>
                          </>
                        )}
                      </ul>
                    </div>

                    {/* Proration preview from Paddle */}
                    <div className="p-3 rounded-lg border border-border/50 bg-surface-elevated">
                      <div className="flex items-center gap-2 mb-2">
                        <Receipt className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm font-semibold text-foreground">
                          Proration preview
                        </p>
                        {previewLoading && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-auto" />
                        )}
                      </div>

                      {previewLoading ? (
                        <p className="text-xs text-muted-foreground ml-6">
                          Calculating exact charge or credit from Paddle…
                        </p>
                      ) : previewError ? (
                        <p className="text-xs text-muted-foreground ml-6">
                          {previewError}
                        </p>
                      ) : preview ? (
                        (() => {
                          const totalMinor = preview.immediate?.grand_total_minor;
                          const taxMinor = preview.immediate?.tax_minor;
                          const subtotalMinor = preview.immediate?.subtotal_minor;
                          const currency = preview.currency || 'USD';
                          const num = totalMinor != null ? Number(totalMinor) / 100 : null;
                          const isCredit = num !== null && num < 0;
                          const isFree = num !== null && num === 0;
                          const fmt = (minor: string | null | undefined) => {
                            if (minor == null) return '—';
                            const n = Number(minor) / 100;
                            if (Number.isNaN(n)) return '—';
                            try {
                              return new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency,
                                signDisplay: 'auto',
                              }).format(Math.abs(n));
                            } catch {
                              return `$${Math.abs(n).toFixed(2)}`;
                            }
                          };

                          if (num === null) {
                            return (
                              <p className="text-xs text-muted-foreground ml-6">
                                No immediate charge — change applies at next cycle.
                              </p>
                            );
                          }

                          return (
                            <div className="ml-6 space-y-2">
                              <div className="flex items-baseline justify-between gap-3">
                                <span className="text-xs text-muted-foreground">
                                  {isCredit
                                    ? "Credit applied today"
                                    : isFree
                                      ? "Charge today"
                                      : "Charge today (prorated)"}
                                </span>
                                <span
                                  className={cn(
                                    'text-lg font-bold tabular-nums',
                                    isCredit
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-foreground'
                                  )}
                                >
                                  {isCredit ? '−' : ''}
                                  {fmt(totalMinor)}
                                </span>
                              </div>
                              {(subtotalMinor || taxMinor) && (
                                <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t border-border/40">
                                  {subtotalMinor != null && (
                                    <div className="flex justify-between">
                                      <span>Subtotal</span>
                                      <span className="tabular-nums">{fmt(subtotalMinor)}</span>
                                    </div>
                                  )}
                                  {taxMinor != null && Number(taxMinor) !== 0 && (
                                    <div className="flex justify-between">
                                      <span>Tax</span>
                                      <span className="tabular-nums">{fmt(taxMinor)}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              {preview.next_billing?.grand_total_minor != null && (
                                <div className="flex justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-border/40">
                                  <span>Next renewal</span>
                                  <span className="tabular-nums">
                                    {(() => {
                                      const n = Number(preview.next_billing!.grand_total_minor) / 100;
                                      try {
                                        return new Intl.NumberFormat('en-US', {
                                          style: 'currency',
                                          currency: preview.next_billing!.currency || currency,
                                        }).format(n);
                                      } catch {
                                        return `$${n.toFixed(2)}`;
                                      }
                                    })()}
                                    {preview.next_billing.billed_at && (
                                      <span className="text-muted-foreground/80">
                                        {' '}on {formatDate(preview.next_billing.billed_at)}
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}
                              <p className="text-[11px] text-muted-foreground/80 pt-1">
                                Live preview from Paddle. Final amount may vary slightly with taxes at checkout.
                              </p>
                            </div>
                          );
                        })()
                      ) : (
                        <p className="text-xs text-muted-foreground ml-6">
                          Preview unavailable.
                        </p>
                      )}
                    </div>

                    {/* Portal note */}
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/20 border border-border/40">
                      <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        We'll open the secure Paddle portal to confirm and process your plan change.
                        Changes take effect once Paddle confirms — refresh this page after to see the update.
                      </p>
                    </div>
                  </div>

                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={confirmPlanChange}
                      className={cn(
                        isUpgrade
                          ? 'bg-primary hover:bg-primary/90'
                          : 'bg-foreground/80 hover:bg-foreground'
                      )}
                    >
                      Continue to Paddle
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </>
              );
            })()}
          </AlertDialogContent>
        </AlertDialog>
      </DashboardLayout>
    </>
  );
};

export default BillingPage;
