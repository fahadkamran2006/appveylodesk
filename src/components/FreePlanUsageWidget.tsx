import { useState } from 'react';
import { useAgencyLimits } from '@/hooks/useAgencyLimits';
import { Progress } from '@/components/ui/progress';
import { Crown, Users, FolderKanban, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UpgradeRequiredModal, UpgradeLimitType } from '@/components/UpgradeRequiredModal';

interface Props {
  variant?: 'card' | 'sidebar';
  className?: string;
}

export function FreePlanUsageWidget({ variant = 'card', className }: Props) {
  const limits = useAgencyLimits();
  const [modalOpen, setModalOpen] = useState(false);
  const [limitType, setLimitType] = useState<UpgradeLimitType>('client');

  if (limits.loading || !limits.isFree) return null;

  const open = (t: UpgradeLimitType) => {
    setLimitType(t);
    setModalOpen(true);
  };

  const rows = [
    {
      type: 'client' as const,
      icon: Users,
      label: 'Clients',
      value: `${limits.currentClients} / ${limits.maxClients}`,
      pct: Math.min(100, (limits.currentClients / Math.max(1, limits.maxClients)) * 100),
    },
    {
      type: 'project' as const,
      icon: FolderKanban,
      label: 'Active projects',
      value: `${limits.activeProjectCount} / 1`,
      pct: Math.min(100, (limits.activeProjectCount / 1) * 100),
    },
    {
      type: 'storage' as const,
      icon: HardDrive,
      label: 'Storage',
      value: `${limits.formatBytes(limits.storageUsedBytes)} / ${limits.formatBytes(limits.storageLimitBytes)}`,
      pct: limits.getStoragePercentage(),
    },
  ];

  return (
    <>
      <div
        className={cn(
          'rounded-xl border border-border/50 bg-muted/30',
          variant === 'card' ? 'p-4 md:p-5' : 'p-3',
          className
        )}
      >
        <div className="flex items-center gap-2 mb-3">
          <Crown className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Free plan</span>
          <button
            onClick={() => open('client')}
            className="ml-auto text-xs text-primary hover:underline"
          >
            Upgrade
          </button>
        </div>
        <div className="space-y-2.5">
          {rows.map((r) => {
            const atCap = r.pct >= 100;
            return (
              <button
                key={r.type}
                onClick={() => open(r.type)}
                className="w-full text-left group"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground">
                    <r.icon className="w-3.5 h-3.5" />
                    {r.label}
                  </span>
                  <span className={cn('font-medium', atCap ? 'text-amber-500' : 'text-foreground')}>
                    {r.value}
                  </span>
                </div>
                <Progress
                  value={r.pct}
                  className={cn('h-1.5', atCap && '[&>div]:bg-amber-500')}
                />
              </button>
            );
          })}
        </div>
      </div>

      <UpgradeRequiredModal open={modalOpen} onOpenChange={setModalOpen} limitType={limitType} />
    </>
  );
}
