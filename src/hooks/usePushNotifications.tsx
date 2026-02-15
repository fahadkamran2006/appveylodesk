/// <reference lib="webworker" />
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

// VAPID public key will be fetched from the server
let vapidPublicKeyCache: string | null = null;

async function getVapidPublicKey(): Promise<string> {
  if (vapidPublicKeyCache) return vapidPublicKeyCache;

  try {
    const { data, error } = await supabase.functions.invoke('get-vapid-key');
    if (error) throw error;
    vapidPublicKeyCache = data.publicKey || '';
    return vapidPublicKeyCache;
  } catch (e) {
    console.error('Failed to fetch VAPID key:', e);
    return '';
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission | 'default';
  isSubscribed: boolean;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: 'default',
    isSubscribed: false,
  });

  // Check if push notifications are supported and if already subscribed
  useEffect(() => {
    const isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

    setState(prev => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : 'default',
    }));

    // Check existing subscription
    if (isSupported && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(async (registration) => {
        const subscription = await registration.pushManager.getSubscription();
        setState(prev => ({ ...prev, isSubscribed: !!subscription }));
      });
    }
  }, []);

  // Subscribe to Web Push and store in database
  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (!user || !state.isSupported) {
      console.warn('Cannot subscribe: missing user or support');
      return false;
    }

    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) {
      console.warn('Cannot subscribe: missing VAPID key');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      });

      const json = subscription.toJSON();
      const endpoint = json.endpoint!;
      const p256dh = json.keys!.p256dh!;
      const auth = json.keys!.auth!;

      // Store subscription in database
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: user.id,
            endpoint,
            p256dh,
            auth,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,endpoint' }
        );

      if (error) {
        console.error('Error storing push subscription:', error);
        return false;
      }

      setState(prev => ({ ...prev, isSubscribed: true }));
      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      return false;
    }
  }, [user, state.isSupported]);

  // Unsubscribe from Web Push
  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', endpoint);
      }

      setState(prev => ({ ...prev, isSubscribed: false }));
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      return false;
    }
  }, [user]);

  // Request permission and subscribe
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      console.warn('Push notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));

      if (permission === 'granted') {
        // Automatically subscribe after permission granted
        return await subscribeToPush();
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [state.isSupported, subscribeToPush]);

  // Auto-subscribe when permission is already granted and user logs in
  useEffect(() => {
    if (user && state.isSupported && state.permission === 'granted' && !state.isSubscribed) {
      subscribeToPush();
    }
  }, [user, state.isSupported, state.permission, state.isSubscribed, subscribeToPush]);

  // Show a local notification (for foreground)
  const showNotification = useCallback(async (
    title: string,
    options?: NotificationOptions
  ): Promise<boolean> => {
    if (!state.isSupported || state.permission !== 'granted') {
      return false;
    }

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          requireInteraction: false,
          ...options,
        } as NotificationOptions);
        return true;
      } else {
        new Notification(title, { icon: '/pwa-192x192.png', ...options });
        return true;
      }
    } catch (error) {
      console.error('Error showing notification:', error);
      return false;
    }
  }, [state.isSupported, state.permission]);

  // Convenience notification helpers
  const notifyNewMessage = useCallback((senderName: string, preview: string) => {
    return showNotification(`New message from ${senderName}`, {
      body: preview.length > 100 ? preview.substring(0, 100) + '...' : preview,
      tag: 'new-message',
      data: { type: 'message' },
    });
  }, [showNotification]);

  const notifyInvoice = useCallback((invoiceId: string, status: 'sent' | 'paid') => {
    const title = status === 'sent' ? 'New Invoice Received' : 'Invoice Paid';
    const body = status === 'sent'
      ? `Invoice #${invoiceId.slice(0, 8)} has been sent to you`
      : `Invoice #${invoiceId.slice(0, 8)} has been marked as paid`;
    return showNotification(title, { body, tag: 'invoice', data: { type: 'invoice', invoiceId } });
  }, [showNotification]);

  const notifyProject = useCallback((projectTitle: string, event: 'approved' | 'status_change', newStatus?: string) => {
    const title = event === 'approved' ? 'Proposal Approved! 🎉' : 'Project Status Updated';
    const body = event === 'approved'
      ? `Your proposal "${projectTitle}" has been approved`
      : `"${projectTitle}" is now ${newStatus}`;
    return showNotification(title, { body, tag: 'project', data: { type: 'project', event } });
  }, [showNotification]);

  return {
    ...state,
    requestPermission,
    subscribeToPush,
    unsubscribeFromPush,
    showNotification,
    notifyNewMessage,
    notifyInvoice,
    notifyProject,
  };
}

// Hook to listen for realtime notifications and show push alerts (foreground only)
export function usePushNotificationListener() {
  const { user } = useAuth();
  const {
    isSupported,
    permission,
    showNotification,
  } = usePushNotifications();

  useEffect(() => {
    if (!user || !isSupported || permission !== 'granted') return;

    const channel = supabase
      .channel(`push-notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as {
            title: string;
            message: string;
            link?: string;
            type: string;
          };

          // Show foreground notification
          showNotification(notification.title, {
            body: notification.message,
            tag: notification.type,
            data: {
              type: notification.type,
              url: notification.link,
            },
          });
        }
      )
      .subscribe();

    // Listen for service worker messages (notification clicks)
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
        const { url } = event.data;
        if (url) {
          window.focus();
          window.location.href = url;
        }
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      supabase.removeChannel(channel);
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [user, isSupported, permission, showNotification]);
}
