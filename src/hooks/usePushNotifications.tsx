import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';

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

  // Check if push notifications are supported
  useEffect(() => {
    const isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    
    setState(prev => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : 'default',
    }));
  }, []);

  // Request permission for push notifications
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      console.warn('Push notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [state.isSupported]);

  // Show a push notification
  const showNotification = useCallback(async (
    title: string,
    options?: NotificationOptions
  ): Promise<boolean> => {
    if (!state.isSupported || state.permission !== 'granted') {
      console.warn('Cannot show notification: permission not granted');
      return false;
    }

    try {
      // Try using service worker for persistent notifications
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
        // Fallback to regular Notification API
        new Notification(title, {
          icon: '/pwa-192x192.png',
          ...options,
        });
        return true;
      }
    } catch (error) {
      console.error('Error showing notification:', error);
      return false;
    }
  }, [state.isSupported, state.permission]);

  // Send notification for different event types
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
    
    return showNotification(title, {
      body,
      tag: 'invoice',
      data: { type: 'invoice', invoiceId },
    });
  }, [showNotification]);

  const notifyProject = useCallback((projectTitle: string, event: 'approved' | 'status_change', newStatus?: string) => {
    const title = event === 'approved' ? 'Proposal Approved! 🎉' : 'Project Status Updated';
    const body = event === 'approved' 
      ? `Your proposal "${projectTitle}" has been approved`
      : `"${projectTitle}" is now ${newStatus}`;
    
    return showNotification(title, {
      body,
      tag: 'project',
      data: { type: 'project', event },
    });
  }, [showNotification]);

  return {
    ...state,
    requestPermission,
    showNotification,
    notifyNewMessage,
    notifyInvoice,
    notifyProject,
  };
}

// Hook to listen for realtime notifications and show push alerts
export function usePushNotificationListener() {
  const { user } = useAuth();
  const { 
    isSupported, 
    permission, 
    showNotification 
  } = usePushNotifications();

  useEffect(() => {
    if (!user || !isSupported || permission !== 'granted') return;

    // The service worker will handle showing notifications when the app is in background
    // For foreground, we can optionally show notifications through the hook
    
    // Listen for service worker messages
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
        // Handle notification click - navigate to relevant page
        const { url } = event.data;
        if (url) {
          window.focus();
          window.location.href = url;
        }
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [user, isSupported, permission, showNotification]);
}
