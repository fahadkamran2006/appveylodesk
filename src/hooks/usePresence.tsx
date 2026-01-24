import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RealtimeChannel } from '@supabase/supabase-js';

interface PresencePayload {
  user_id: string;
  online_at: string;
}

export function usePresence(agencyId: string | null) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user?.id || !agencyId) return;

    // Create a presence channel scoped to the agency
    const channel = supabase.channel(`presence:${agencyId}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresencePayload>();
        const userIds = new Set<string>();
        
        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            const payload = presence as unknown as PresencePayload;
            if (payload.user_id) {
              userIds.add(payload.user_id);
            }
          });
        });
        
        setOnlineUsers(userIds);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        setOnlineUsers(prev => {
          const next = new Set(prev);
          newPresences.forEach((presence) => {
            const payload = presence as unknown as PresencePayload;
            if (payload.user_id) {
              next.add(payload.user_id);
            }
          });
          return next;
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        setOnlineUsers(prev => {
          const next = new Set(prev);
          leftPresences.forEach((presence) => {
            const payload = presence as unknown as PresencePayload;
            if (payload.user_id) {
              next.delete(payload.user_id);
            }
          });
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [user?.id, agencyId]);

  const isOnline = useCallback((userId: string) => {
    return onlineUsers.has(userId);
  }, [onlineUsers]);

  return {
    onlineUsers,
    isOnline,
  };
}
