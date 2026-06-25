import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { showFriendlyError } from '@/lib/friendlyError';

/**
 * Catches uncaught promise rejections and window errors, converting raw
 * Supabase / network failures into consistent friendly toasts.
 *
 * Mount once near the root of the tree.
 */
export function GlobalErrorHandler() {
  const { toast } = useToast();

  useEffect(() => {
    const recentlyShown = new Map<string, number>();
    const shouldThrottle = (key: string) => {
      const now = Date.now();
      const last = recentlyShown.get(key) ?? 0;
      if (now - last < 4000) return true;
      recentlyShown.set(key, now);
      // Trim old entries
      if (recentlyShown.size > 50) {
        for (const [k, t] of recentlyShown) {
          if (now - t > 10000) recentlyShown.delete(k);
        }
      }
      return false;
    };

    // Heuristic: skip noise we don't want to toast (e.g. async query errors
    // that already show their own UI states, ResizeObserver loop warnings).
    const isIgnorable = (err: unknown) => {
      const msg = (err as { message?: string } | null)?.message?.toLowerCase() ?? '';
      if (!msg) return true;
      if (msg.includes('resizeobserver')) return true;
      if (msg.includes('aborterror') || msg.includes('the operation was aborted')) return true;
      if (msg.includes('non-error promise rejection')) return true;
      if (msg.includes('cancelled') || msg.includes('canceled')) return true;
      return false;
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (isIgnorable(reason)) return;
      const key = (reason as { message?: string } | null)?.message ?? String(reason);
      if (shouldThrottle(key)) return;
      showFriendlyError(toast, reason);
    };

    const onError = (event: ErrorEvent) => {
      if (isIgnorable(event.error ?? event.message)) return;
      const key = event.message ?? 'window-error';
      if (shouldThrottle(key)) return;
      // Window errors are often dev-time noise; only surface when message looks like an API problem.
      const msg = (event.message || '').toLowerCase();
      if (
        msg.includes('failed to fetch') ||
        msg.includes('network') ||
        msg.includes('could not find the table')
      ) {
        showFriendlyError(toast, event.error ?? event.message);
      }
    };

    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError);
    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError);
    };
  }, [toast]);

  return null;
}
