import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface UnreadCounts {
  [channelId: string]: number;
}

export function useUnreadMessages() {
  const { user } = useAuth();
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchUnreadCounts = useCallback(async () => {
    if (!user) {
      setUnreadCounts({});
      setTotalUnread(0);
      setLoading(false);
      return;
    }

    try {
      // Get all channels the user is a participant of
      const { data: participations, error: partError } = await supabase
        .from('channel_participants')
        .select('channel_id')
        .eq('user_id', user.id);

      if (partError) {
        console.error('Error fetching participations for unread:', partError);
        setLoading(false);
        return;
      }

      if (!participations || participations.length === 0) {
        setUnreadCounts({});
        setTotalUnread(0);
        setLoading(false);
        return;
      }

      const channelIds = participations.map(p => p.channel_id);

      // Get read receipts for these channels
      const { data: receipts, error: receiptsError } = await supabase
        .from('channel_read_receipts')
        .select('channel_id, last_seen_at')
        .eq('user_id', user.id)
        .in('channel_id', channelIds);

      if (receiptsError) {
        console.error('Error fetching read receipts:', receiptsError);
      }

      const receiptMap: { [key: string]: string } = {};
      receipts?.forEach(r => {
        receiptMap[r.channel_id] = r.last_seen_at;
      });

      // Get message counts per channel since last seen
      const counts: UnreadCounts = {};
      let total = 0;

      for (const channelId of channelIds) {
        const lastSeen = receiptMap[channelId] || '1970-01-01T00:00:00Z';
        
        const { count, error: countError } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('channel_id', channelId)
          .neq('sender_id', user.id)
          .gt('created_at', lastSeen);

        if (countError) {
          console.error('Error fetching message count:', countError);
          continue;
        }

        const unreadCount = count || 0;
        if (unreadCount > 0) {
          counts[channelId] = unreadCount;
          total += unreadCount;
        }
      }

      setUnreadCounts(counts);
      setTotalUnread(total);
    } catch (err) {
      console.error('Error in fetchUnreadCounts:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Mark a channel as read
  const markChannelAsRead = useCallback(async (channelId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('channel_read_receipts')
        .upsert(
          {
            channel_id: channelId,
            user_id: user.id,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: 'channel_id,user_id' }
        );

      if (error) {
        console.error('Error marking channel as read:', error);
        return;
      }

      // Update local state
      setUnreadCounts(prev => {
        const newCounts = { ...prev };
        const removed = newCounts[channelId] || 0;
        delete newCounts[channelId];
        setTotalUnread(t => Math.max(0, t - removed));
        return newCounts;
      });
    } catch (err) {
      console.error('Error in markChannelAsRead:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  // Subscribe to new messages to update counts in real-time
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`unread-messages:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMessage = payload.new as { channel_id: string; sender_id: string };
          // Only increment if message is from someone else
          if (newMessage.sender_id !== user.id) {
            setUnreadCounts(prev => ({
              ...prev,
              [newMessage.channel_id]: (prev[newMessage.channel_id] || 0) + 1,
            }));
            setTotalUnread(t => t + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    unreadCounts,
    totalUnread,
    loading,
    markChannelAsRead,
    refetch: fetchUnreadCounts,
  };
}
