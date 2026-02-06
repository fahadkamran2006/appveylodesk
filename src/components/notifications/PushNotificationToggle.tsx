import { useState } from 'react';
import { Bell, BellOff, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';

interface PushNotificationToggleProps {
  className?: string;
}

export function PushNotificationToggle({ className }: PushNotificationToggleProps) {
  const { isSupported, permission, requestPermission } = usePushNotifications();
  const [isRequesting, setIsRequesting] = useState(false);

  if (!isSupported) {
    return (
      <div className={cn("flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border", className)}>
        <BellOff className="w-5 h-5 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Push Notifications</p>
          <p className="text-xs text-muted-foreground">
            Not supported in this browser
          </p>
        </div>
      </div>
    );
  }

  const handleRequest = async () => {
    setIsRequesting(true);
    await requestPermission();
    setIsRequesting(false);
  };

  return (
    <div className={cn("flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border", className)}>
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center",
        permission === 'granted' ? 'bg-success/10' : 'bg-primary/10'
      )}>
        {permission === 'granted' ? (
          <Check className="w-5 h-5 text-success" />
        ) : (
          <Bell className="w-5 h-5 text-primary" />
        )}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">Push Notifications</p>
        <p className="text-xs text-muted-foreground">
          {permission === 'granted' 
            ? 'You will receive push notifications'
            : permission === 'denied'
            ? 'Notifications blocked. Enable in browser settings.'
            : 'Get notified about messages, invoices & projects'}
        </p>
      </div>
      {permission === 'default' && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRequest}
          disabled={isRequesting}
        >
          {isRequesting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Enable'
          )}
        </Button>
      )}
      {permission === 'granted' && (
        <span className="text-xs font-medium text-success bg-success/10 px-2 py-1 rounded">
          Enabled
        </span>
      )}
      {permission === 'denied' && (
        <span className="text-xs font-medium text-destructive bg-destructive/10 px-2 py-1 rounded">
          Blocked
        </span>
      )}
    </div>
  );
}
