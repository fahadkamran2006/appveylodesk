import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { playNotificationSound } from '@/lib/sounds';

export type NotificationType = 
  | 'task_assignment'
  | 'new_message'
  | 'invoice_sent'
  | 'invoice_paid'
  | 'proposal_created'
  | 'proposal_approved'
  | 'project_status_change'
  | 'editor_assigned'
  | 'deliverable_uploaded'
  | 'comment_added';

export interface Notification {
  id: string;
  user_id: string;
  agency_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  read_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  agency_id: string;
  notification_type: NotificationType;
  in_app_enabled: boolean;
  email_enabled: boolean;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Cast the data to our Notification type
      const typedNotifications = (data || []).map(n => ({
        ...n,
        type: n.type as NotificationType,
        metadata: (n.metadata || {}) as Record<string, unknown>
      }));

      setNotifications(typedNotifications);
      setUnreadCount(typedNotifications.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [user]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [user]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const notification = notifications.find(n => n.id === notificationId);
      
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (notification && !notification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [user, notifications]);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }, [user]);

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = {
            ...payload.new,
            type: payload.new.type as NotificationType,
            metadata: (payload.new.metadata || {}) as Record<string, unknown>
          } as Notification;
          
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refetch: fetchNotifications,
  };
}

export function useNotificationPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);

  // Get agency ID
  useEffect(() => {
    const getAgencyId = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('user_roles')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data?.agency_id) {
        setAgencyId(data.agency_id);
      }
    };

    getAgencyId();
  }, [user]);

  // Fetch preferences
  const fetchPreferences = useCallback(async () => {
    if (!user || !agencyId) return;

    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .eq('agency_id', agencyId);

      if (error) throw error;

      const typedPreferences = (data || []).map(p => ({
        ...p,
        notification_type: p.notification_type as NotificationType
      }));

      setPreferences(typedPreferences);
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
    } finally {
      setLoading(false);
    }
  }, [user, agencyId]);

  useEffect(() => {
    if (agencyId) {
      fetchPreferences();
    }
  }, [agencyId, fetchPreferences]);

  // Update preference
  const updatePreference = useCallback(async (
    notificationType: NotificationType,
    inAppEnabled: boolean,
    emailEnabled: boolean
  ) => {
    if (!user || !agencyId) return;

    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          agency_id: agencyId,
          notification_type: notificationType,
          in_app_enabled: inAppEnabled,
          email_enabled: emailEnabled,
        }, {
          onConflict: 'user_id,agency_id,notification_type'
        });

      if (error) throw error;

      // Update local state
      setPreferences(prev => {
        const existing = prev.find(p => p.notification_type === notificationType);
        if (existing) {
          return prev.map(p => 
            p.notification_type === notificationType 
              ? { ...p, in_app_enabled: inAppEnabled, email_enabled: emailEnabled }
              : p
          );
        } else {
          return [...prev, {
            id: crypto.randomUUID(),
            user_id: user.id,
            agency_id: agencyId,
            notification_type: notificationType,
            in_app_enabled: inAppEnabled,
            email_enabled: emailEnabled,
          }];
        }
      });
    } catch (error) {
      console.error('Error updating notification preference:', error);
      throw error;
    }
  }, [user, agencyId]);

  // Get preference for a specific type (defaults to enabled)
  const getPreference = useCallback((type: NotificationType) => {
    const pref = preferences.find(p => p.notification_type === type);
    return {
      in_app_enabled: pref?.in_app_enabled ?? true,
      email_enabled: pref?.email_enabled ?? false,
    };
  }, [preferences]);

  return {
    preferences,
    loading,
    agencyId,
    updatePreference,
    getPreference,
    refetch: fetchPreferences,
  };
}
