import { useState } from 'react';
import { Bell, Mail, Smartphone, Loader2 } from 'lucide-react';
import { useNotificationPreferences, NotificationType } from '@/hooks/useNotifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { PushNotificationToggle } from '@/components/notifications/PushNotificationToggle';
import { EmailPreviewModal } from '@/components/settings/EmailPreviewModal';

interface NotificationSettingsProps {
  className?: string;
}

interface NotificationCategory {
  id: NotificationType;
  label: string;
  description: string;
  category: 'projects' | 'messaging' | 'billing' | 'team';
}

const notificationTypes: NotificationCategory[] = [
  // Projects
  {
    id: 'editor_assigned',
    label: 'Editor Assignment',
    description: 'When you are assigned to a new project',
    category: 'projects',
  },
  {
    id: 'project_status_change',
    label: 'Project Status Updates',
    description: 'When a project status changes (e.g., In Progress → Review)',
    category: 'projects',
  },
  {
    id: 'proposal_created',
    label: 'New Proposals',
    description: 'When a client submits a new project proposal',
    category: 'projects',
  },
  {
    id: 'proposal_approved',
    label: 'Proposal Approved',
    description: 'When your proposal is approved',
    category: 'projects',
  },
  {
    id: 'deliverable_uploaded',
    label: 'Deliverable Uploads',
    description: 'When a new file is uploaded to your project',
    category: 'projects',
  },
  // Messaging
  {
    id: 'new_message',
    label: 'New Messages',
    description: 'When you receive a new message in a chat',
    category: 'messaging',
  },
  {
    id: 'comment_added',
    label: 'Video Comments',
    description: 'When someone comments on a video deliverable',
    category: 'messaging',
  },
  // Billing
  {
    id: 'invoice_sent',
    label: 'Invoice Received',
    description: 'When you receive a new invoice',
    category: 'billing',
  },
  {
    id: 'invoice_paid',
    label: 'Payment Received',
    description: 'When an invoice is marked as paid',
    category: 'billing',
  },
  // Team
  {
    id: 'task_assignment',
    label: 'Task Assignment',
    description: 'When you are assigned a new task',
    category: 'team',
  },
];

const categoryLabels = {
  projects: { label: 'Projects', icon: '📁' },
  messaging: { label: 'Messaging', icon: '💬' },
  billing: { label: 'Billing', icon: '💰' },
  team: { label: 'Team', icon: '👥' },
};

export function NotificationSettings({ className }: NotificationSettingsProps) {
  const { preferences, loading, getPreference, updatePreference } = useNotificationPreferences();
  const { toast } = useToast();
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  const handleToggle = async (
    type: NotificationType,
    channel: 'in_app' | 'email',
    currentValue: boolean
  ) => {
    const updateKey = `${type}-${channel}`;
    setUpdatingIds(prev => new Set(prev).add(updateKey));

    try {
      const current = getPreference(type);
      await updatePreference(
        type,
        channel === 'in_app' ? !currentValue : current.in_app_enabled,
        channel === 'email' ? !currentValue : current.email_enabled
      );
      
      toast({
        title: 'Preference updated',
        description: `${channel === 'in_app' ? 'In-app' : 'Email'} notifications ${!currentValue ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update preference. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(updateKey);
        return next;
      });
    }
  };

  const groupedNotifications = notificationTypes.reduce((acc, type) => {
    if (!acc[type.category]) {
      acc[type.category] = [];
    }
    acc[type.category].push(type);
    return acc;
  }, {} as Record<string, NotificationCategory[]>);

  if (loading) {
    return (
      <Card className={cn("glass-card border-border/50", className)}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("glass-card border-border/50", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Choose how you want to be notified about important events
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Push Notification Permission */}
        <PushNotificationToggle />

        {/* Channel Legend */}
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Smartphone className="h-4 w-4" />
            <span>In-App</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span>Email</span>
          </div>
        </div>

        {/* Notification Categories */}
        {Object.entries(groupedNotifications).map(([category, types], categoryIndex) => (
          <div key={category}>
            {categoryIndex > 0 && <Separator className="my-6" />}
            
            <div className="mb-4">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <span>{categoryLabels[category as keyof typeof categoryLabels].icon}</span>
                {categoryLabels[category as keyof typeof categoryLabels].label}
              </h4>
            </div>

            <div className="space-y-4">
              {types.map((type) => {
                const pref = getPreference(type.id);
                const inAppUpdating = updatingIds.has(`${type.id}-in_app`);
                const emailUpdating = updatingIds.has(`${type.id}-email`);

                return (
                  <div
                    key={type.id}
                    className="flex items-start justify-between gap-4 p-3 rounded-lg border border-border/50 bg-surface-elevated/50"
                  >
                    <div className="flex-1 min-w-0">
                      <Label className="text-sm font-medium text-foreground">
                        {type.label}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {type.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      {/* In-App Toggle */}
                      <div className="flex flex-col items-center gap-1">
                        <div className="relative">
                          {inAppUpdating && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          )}
                          <Switch
                            checked={pref.in_app_enabled}
                            onCheckedChange={() => handleToggle(type.id, 'in_app', pref.in_app_enabled)}
                            disabled={inAppUpdating}
                            className={cn(inAppUpdating && "opacity-30")}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">In-App</span>
                      </div>

                      {/* Email Toggle */}
                      <div className="flex flex-col items-center gap-1">
                        <div className="relative">
                          {emailUpdating && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          )}
                          <Switch
                            checked={pref.email_enabled}
                            onCheckedChange={() => handleToggle(type.id, 'email', pref.email_enabled)}
                            disabled={emailUpdating}
                            className={cn(emailUpdating && "opacity-30")}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">Email</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
