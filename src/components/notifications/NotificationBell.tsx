import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications, NotificationType } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const notificationIcons: Record<NotificationType, string> = {
  task_assignment: '📋',
  new_message: '💬',
  invoice_sent: '📄',
  invoice_paid: '✅',
  proposal_created: '📝',
  proposal_approved: '🎉',
  project_status_change: '🔄',
  editor_assigned: '👤',
  deliverable_uploaded: '📁',
  comment_added: '💭',
};

const notificationColors: Record<NotificationType, string> = {
  task_assignment: 'bg-blue-500/10',
  new_message: 'bg-primary/10',
  invoice_sent: 'bg-amber-500/10',
  invoice_paid: 'bg-emerald-500/10',
  proposal_created: 'bg-purple-500/10',
  proposal_approved: 'bg-emerald-500/10',
  project_status_change: 'bg-cyan-500/10',
  editor_assigned: 'bg-indigo-500/10',
  deliverable_uploaded: 'bg-orange-500/10',
  comment_added: 'bg-pink-500/10',
};

export function NotificationBell() {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    markAsRead(notification.id);
    if (notification.link) {
      setOpen(false);
      navigate(notification.link);
    }
  };

  const getRoleBasedSettingsLink = () => {
    switch (userRole) {
      case 'admin': return '/admin/settings';
      case 'client': return '/client/settings';
      case 'editor': return '/editor/settings';
      default: return '/admin/settings';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 h-4.5 min-w-4.5 px-1 text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full flex items-center justify-center border-2 border-background"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0 rounded-2xl overflow-hidden"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] text-muted-foreground hover:text-foreground px-2"
              onClick={() => markAllAsRead()}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <ScrollArea className="h-[380px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <Bell className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                We'll let you know when something needs your attention
              </p>
            </div>
          ) : (
            <div className="py-1">
              <AnimatePresence initial={false}>
                {notifications.map((notification, index) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10, height: 0 }}
                    transition={{ duration: 0.15, delay: index * 0.02 }}
                    className={cn(
                      "group relative flex gap-3 px-4 py-3 hover:bg-muted/40 transition-all cursor-pointer mx-1 rounded-xl",
                      !notification.is_read && "bg-primary/[0.04]"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Icon */}
                    <div className={cn(
                      "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-base",
                      notificationColors[notification.type]
                    )}>
                      {notificationIcons[notification.type]}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          "text-[13px] leading-tight line-clamp-1",
                          !notification.is_read ? "font-semibold text-foreground" : "font-medium text-foreground/80"
                        )}>
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                        )}
                      </div>
                      <p className="text-[12px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>

                    {/* Delete */}
                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="px-3 py-2 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-[11px] text-muted-foreground hover:text-foreground h-7 px-2"
                onClick={() => { setOpen(false); navigate(getRoleBasedSettingsLink()); }}
              >
                Settings
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-[11px] text-muted-foreground hover:text-destructive h-7 px-2"
                onClick={() => clearAll()}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
