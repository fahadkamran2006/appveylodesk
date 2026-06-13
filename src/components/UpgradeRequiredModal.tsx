import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Check, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { openPaddleCheckout } from '@/hooks/useSubscription';
import { useAgencyLimits } from '@/hooks/useAgencyLimits';

export type UpgradeLimitType = 'client' | 'project' | 'storage' | 'branding';

interface UpgradeRequiredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limitType: UpgradeLimitType;
}

const NEXT_PLAN = {
  name: 'Starter',
  key: 'starter' as const,
  monthlyPrice: 29,
  yearlyPrice: 290,
};

const COPY: Record<UpgradeLimitType, { title: string; line: string; usage?: (limits: any) => string }> = {
  client: {
    title: "You've reached your client limit",
    line: 'Free includes 1 active client. Upgrade to Starter to add up to 5 clients.',
    usage: (l) => `${l.currentClients} of ${l.maxClients} clients used`,
  },
  project: {
    title: "You've reached your active project limit",
    line: 'Free allows 1 active project at a time. Upgrade to Starter for unlimited active projects.',
  },
  storage: {
    title: "You've reached your storage limit",
    line: 'Free includes 2 GB of storage. Upgrade to Starter for 200 GB.',
    usage: (l) => `${l.formatBytes(l.storageUsedBytes)} of ${l.formatBytes(l.storageLimitBytes)} used`,
  },
  branding: {
    title: 'Custom branding is a paid feature',
    line: 'Free shows "Powered by Veylodesk". Upgrade to Growth to remove it and use your own logo, name & colors.',
  },
};

export function UpgradeRequiredModal({ open, onOpenChange, limitType }: UpgradeRequiredModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const limits = useAgencyLimits();
  const copy = COPY[limitType];

  const handleUpgrade = () => {
    if (!limits.agencyId) {
      navigate('/admin/settings/subscription');
      onOpenChange(false);
      return;
    }
    openPaddleCheckout(NEXT_PLAN.key, 'yearly', limits.agencyId, user?.email);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Crown className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle className="text-foreground">{copy.title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">{copy.line}</DialogDescription>
        </DialogHeader>

        {copy.usage && !limits.loading && (
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-foreground">
            {copy.usage(limits)}
          </div>
        )}

        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-baseline justify-between mb-3">
            <span className="font-semibold text-foreground">Starter</span>
            <div className="text-right">
              <div className="text-2xl font-bold text-foreground">${Math.round(NEXT_PLAN.yearlyPrice / 12)}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
              <div className="text-xs text-muted-foreground">Billed yearly · ${NEXT_PLAN.yearlyPrice}</div>
            </div>
          </div>
          <ul className="space-y-1.5 text-sm">
            {[
              'Up to 5 active clients',
              'Unlimited active projects',
              '200 GB storage',
              'Unlimited team members',
              'Remove "Powered by Veylodesk"',
            ].map((f) => (
              <li key={f} className="flex items-start gap-2 text-foreground">
                <Check className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button variant="outline" className="sm:flex-1" onClick={() => { navigate('/admin/settings/subscription'); onOpenChange(false); }}>
            See all plans
          </Button>
          <Button variant="hero" className="sm:flex-1" onClick={handleUpgrade}>
            Upgrade to Starter <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
