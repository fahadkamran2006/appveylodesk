import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';
import { RealtimeChannel } from '@supabase/supabase-js';

interface TypingUser {
  id: string;
  name: string;
}

interface PresencePayload {
  id: string;
  name: string;
  typing: boolean;
}

export function useTypingIndicator(channelId: string | null) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Subscribe to typing presence for the channel
  useEffect(() => {
    if (!channelId || !user) {
      setTypingUsers([]);
      return;
    }

    const presenceChannel = supabase.channel(`typing:${channelId}`, {
      config: { presence: { key: user.id } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const users: TypingUser[] = [];
        
        Object.entries(state).forEach(([key, presences]) => {
          if (key !== user.id && Array.isArray(presences) && presences.length > 0) {
            const presence = presences[0] as unknown as PresencePayload;
            if (presence.typing) {
              users.push({ id: presence.id, name: presence.name });
            }
          }
        });
        
        setTypingUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (key !== user.id && newPresences.length > 0) {
          const presence = newPresences[0] as unknown as PresencePayload;
          if (presence?.typing) {
            setTypingUsers(prev => {
              if (prev.find(u => u.id === presence.id)) return prev;
              return [...prev, { id: presence.id, name: presence.name }];
            });
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key !== user.id) {
          setTypingUsers(prev => prev.filter(u => u.id !== key));
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track initial presence as not typing
          await presenceChannel.track({
            id: user.id,
            name: profile?.full_name || user.email || 'Someone',
            typing: false,
          });
        }
      });

    channelRef.current = presenceChannel;

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      supabase.removeChannel(presenceChannel);
      channelRef.current = null;
      isTypingRef.current = false;
    };
  }, [channelId, user, profile]);

  // Send typing indicator
  const startTyping = useCallback(async () => {
    if (!channelRef.current || !user || isTypingRef.current) return;

    isTypingRef.current = true;
    
    await channelRef.current.track({
      id: user.id,
      name: profile?.full_name || user.email || 'Someone',
      typing: true,
    });

    // Auto-stop typing after 3 seconds of no input
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [user, profile]);

  // Stop typing indicator
  const stopTyping = useCallback(async () => {
    if (!channelRef.current || !user) return;

    isTypingRef.current = false;
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    await channelRef.current.track({
      id: user.id,
      name: profile?.full_name || user.email || 'Someone',
      typing: false,
    });
  }, [user, profile]);

  // Call this on each keystroke
  const onTyping = useCallback(() => {
    startTyping();
  }, [startTyping]);

  return {
    typingUsers,
    onTyping,
    stopTyping,
  };
}
