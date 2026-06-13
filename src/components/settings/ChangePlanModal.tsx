import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Zap, Crown, Rocket, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type PlanKey = 'starter' | 'growth' | 'scale';
type Interval = 'monthly' | 'yearly';

const PLANS: Record<PlanKey, { name: string; icon: any; color: string; bg: string; monthly: number; yearly: number; clients: string; storage: string; tagline: string; }> = {
  starter: { name: 'Starter', icon: Zap, color: 'text-blue-500', bg: 'bg-blue-500/10', monthly: 29, yearly: 290, clients: '5 clients', storage: '200 GB', tagline: 'For solo creators' },
  growth: { name: 'Growth', icon: Crown, color: 'text-purple-500', bg: 'bg-purple-500/10', monthly: 79, yearly: 790, clients: '25 clients', storage: '1 TB', tagline: 'For growing teams' },
  scale: { name: 'Scale', icon: Rocket, color: 'text-amber-500', bg: 'bg-amber-500/10', monthly: 149, yearly: 1490, clients: 'Unlimited clients', storage: '3 TB', tagline: 'For agencies at scale' },
};

interface ChangePlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: PlanKey | null;
  currentInterval?: Interval;
  onChanged?: () => void;
}

export const ChangePlanModal = ({ open, onOpenChange, currentPlan, currentInterval = 'monthly', onChanged }: ChangePlanModalProps) => {
  const [interval, setInterval] = useState<Interval>(currentInterval);
  const [selected, setSelected] = useState<PlanKey | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = async (plan: PlanKey) => {
    setSelected(plan);
    setSubmitting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error('Please log in first');
        return;
      }
      const { data, error } = await supabase.functions.invoke('paddle-change-plan', {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
        body: { plan, interval, proration_mode: 'prorated_immediately' },
      });
      if (error) {
        toast.error('Failed to change plan. Please try again.');
        return;
      }
      if (data?.error) {
        toast.error(data.message || data.error);
        return;
      }
      if (data?.success) {
        toast.success(data.message || 'Plan changed successfully');
        onChanged?.();
        onOpenChange(false);
        // Reload to refresh subscription state
        setTimeout(() => window.location.reload(), 800);
      }
    } catch (err) {
      console.error('Change plan error:', err);
      toast.error('Failed to change plan');
    } finally {
      setSubmitting(false);
      setSelected(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Change your plan</DialogTitle>
          <DialogDescription>
            Upgrades are billed prorated immediately. Downgrades take effect on your next renewal.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={interval} onValueChange={(v) => setInterval(v as Interval)} className="w-full">
          <TabsList className="grid w-full max-w-xs mx-auto grid-cols-2">
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">Yearly · Save 17%</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid md:grid-cols-3 gap-4 mt-4">
          {(Object.keys(PLANS) as PlanKey[]).map((key) => {
            const p = PLANS[key];
            const Icon = p.icon;
            const isCurrent = currentPlan === key && currentInterval === interval;
            const price = interval === 'monthly' ? p.monthly : p.yearly;
            return (
              <div
                key={key}
                className={cn(
                  'rounded-lg border p-5 flex flex-col gap-3 transition',
                  isCurrent ? 'border-primary bg-primary/5' : 'border-border/50 bg-surface-elevated',
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', p.bg)}>
                    <Icon className={cn('w-5 h-5', p.color)} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{p.name}</h3>
                    <p className="text-xs text-muted-foreground">{p.tagline}</p>
                  </div>
                </div>
                <div>
                  <span className="text-2xl font-bold text-foreground">${price}</span>
                  <span className="text-sm text-muted-foreground">/{interval === 'monthly' ? 'mo' : 'yr'}</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" />{p.clients}</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" />{p.storage} storage</li>
                </ul>
                <Button
                  className="mt-auto"
                  variant={isCurrent ? 'outline' : 'default'}
                  disabled={isCurrent || submitting}
                  onClick={() => handleChange(key)}
                >
                  {submitting && selected === key ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating…</>
                  ) : isCurrent ? (
                    <>Current Plan</>
                  ) : (
                    <>Switch to {p.name}</>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
