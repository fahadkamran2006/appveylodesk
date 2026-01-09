import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  HardDrive, 
  Zap, 
  Crown, 
  ChevronRight,
  Check
} from 'lucide-react';
import { useStorage } from '@/hooks/useStorage';
import { useToast } from '@/hooks/use-toast';

interface StorageManagementProps {
  className?: string;
}

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    storage: '200 GB',
    features: ['Up to 5 projects', 'Email support', 'Basic analytics'],
    icon: Zap,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 99,
    storage: '1 TB',
    features: ['Unlimited projects', 'Priority support', 'Advanced analytics', 'Custom branding'],
    icon: Crown,
    popular: true,
  },
];

export function StorageManagement({ className }: StorageManagementProps) {
  const { storageInfo, fetchStorageInfo, formatBytes, PLAN_LIMITS } = useStorage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStorageInfo().then(() => setLoading(false));
  }, [fetchStorageInfo]);

  const handleUpgrade = () => {
    toast({
      title: 'Upgrade requested',
      description: 'Our team will contact you shortly to process your upgrade.',
    });
  };

  const handlePurchaseStorage = () => {
    toast({
      title: 'Additional storage requested',
      description: 'Our team will contact you to add more storage to your plan.',
    });
  };

  if (loading) {
    return (
      <div className={cn('animate-pulse', className)}>
        <div className="h-48 bg-muted rounded-lg" />
      </div>
    );
  }

  if (!storageInfo) return null;

  const currentPlan = PLANS.find(p => p.id === storageInfo.subscriptionPlan) || PLANS[0];
  const otherPlan = PLANS.find(p => p.id !== storageInfo.subscriptionPlan);

  const isNearLimit = storageInfo.storageUsedPercentage >= 80;
  const isAtLimit = storageInfo.storageUsedPercentage >= 95;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Current Storage Usage */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Storage Usage
          </CardTitle>
          <CardDescription>
            Your current storage consumption
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Usage bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {formatBytes(storageInfo.storageUsedBytes)} of {formatBytes(storageInfo.storageLimitBytes)} used
              </span>
              <span className={cn(
                'font-medium',
                isAtLimit ? 'text-destructive' : isNearLimit ? 'text-warning' : 'text-foreground'
              )}>
                {storageInfo.storageUsedPercentage.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={storageInfo.storageUsedPercentage} 
              className={cn(
                'h-3',
                isAtLimit && '[&>div]:bg-destructive',
                isNearLimit && !isAtLimit && '[&>div]:bg-warning'
              )}
            />
          </div>

          {/* Warning messages */}
          {isAtLimit && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              ⚠️ You've almost reached your storage limit. Upgrade your plan or delete some files to continue uploading.
            </div>
          )}
          {isNearLimit && !isAtLimit && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-warning text-sm">
              ⚠️ You're approaching your storage limit ({storageInfo.storageUsedPercentage.toFixed(0)}% used).
            </div>
          )}

          {/* Quick actions */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handlePurchaseStorage}
            >
              Purchase Additional Storage
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Plan */}
      <Card className={cn(
        'glass-card border-2',
        currentPlan.id === 'pro' ? 'border-primary' : 'border-border/50'
      )}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <currentPlan.icon className="w-5 h-5 text-primary" />
              <CardTitle>Current Plan: {currentPlan.name}</CardTitle>
            </div>
            <Badge variant={currentPlan.id === 'pro' ? 'default' : 'secondary'}>
              Active
            </Badge>
          </div>
          <CardDescription>
            ${currentPlan.price}/month • {currentPlan.storage} storage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {currentPlan.features.map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-accent" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Upgrade option */}
      {otherPlan && storageInfo.subscriptionPlan !== 'pro' && (
        <>
          <Separator />
          
          <Card className="glass-card border-primary/30 bg-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <otherPlan.icon className="w-5 h-5 text-primary" />
                  <CardTitle>Upgrade to {otherPlan.name}</CardTitle>
                </div>
                {otherPlan.popular && (
                  <Badge variant="default">Most Popular</Badge>
                )}
              </div>
              <CardDescription>
                ${otherPlan.price}/month • {otherPlan.storage} storage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {otherPlan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-accent" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                className="w-full"
                onClick={handleUpgrade}
              >
                Upgrade to {otherPlan.name}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
