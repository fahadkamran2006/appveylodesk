import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface ReadReceipt {
  message_id: string;
  user_id: string;
  read_at: string;
}

export function useReadReceipts(channelId: string | null) {
  const { user } = useAuth();
  const [readReceipts, setReadReceipts] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);

  // Fetch read receipts for all messages in channel
  const fetchReadReceipts = useCallback(async () => {
    if (!channelId || !user) {
      setReadReceipts(new Map());
      setLoading(false);
      return;
    }

    try {
      // Get all messages in channel
      const { data: messages } = await supabase
        .from('messages')
        .select('id')
        .eq('channel_id', channelId);

      if (!messages || messages.length === 0) {
        setReadReceipts(new Map());
        setLoading(false);
        return;
      }

      const messageIds = messages.map(m => m.id);

      // Get read receipts for these messages
      const { data: receipts, error } = await supabase
        .from('message_read_receipts')
        .select('message_id, user_id, read_at')
        .in('message_id', messageIds);

      if (error) {
        console.error('Error fetching read receipts:', error);
        setLoading(false);
        return;
      }

      // Build map of message_id -> user_ids who have read it
      const receiptMap = new Map<string, string[]>();
      receipts?.forEach(r => {
        const existing = receiptMap.get(r.message_id) || [];
        receiptMap.set(r.message_id, [...existing, r.user_id]);
      });

      setReadReceipts(receiptMap);
    } catch (err) {
      console.error('Error in fetchReadReceipts:', err);
    } finally {
      setLoading(false);
    }
  }, [channelId, user]);

  useEffect(() => {
    fetchReadReceipts();
  }, [fetchReadReceipts]);

  // Subscribe to new read receipts
  useEffect(() => {
    if (!channelId || !user) return;

    const subscription = supabase
      .channel(`read-receipts-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_read_receipts',
        },
        (payload) => {
          const receipt = payload.new as ReadReceipt;
          setReadReceipts(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(receipt.message_id) || [];
            if (!existing.includes(receipt.user_id)) {
              newMap.set(receipt.message_id, [...existing, receipt.user_id]);
            }
            return newMap;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [channelId, user]);

  // Mark messages as read
  const markMessagesAsRead = useCallback(async (messageIds: string[]) => {
    if (!user || messageIds.length === 0) return;

    try {
      // Filter out messages already read by this user
      const unreadMessageIds = messageIds.filter(id => {
        const readers = readReceipts.get(id) || [];
        return !readers.includes(user.id);
      });

      if (unreadMessageIds.length === 0) return;

      // Insert read receipts for unread messages
      const receiptsToInsert = unreadMessageIds.map(messageId => ({
        message_id: messageId,
        user_id: user.id,
      }));

      const { error } = await supabase
        .from('message_read_receipts')
        .upsert(receiptsToInsert, { onConflict: 'message_id,user_id', ignoreDuplicates: true });

      if (error) {
        console.error('Error marking messages as read:', error);
      }
    } catch (err) {
      console.error('Error in markMessagesAsRead:', err);
    }
  }, [user, readReceipts]);

  // Check if a message has been read by the other person (for DM)
  const isMessageRead = useCallback((messageId: string, otherUserId: string): boolean => {
    const readers = readReceipts.get(messageId) || [];
    return readers.includes(otherUserId);
  }, [readReceipts]);

  // Check if message is delivered (exists in DB = delivered)
  const isMessageDelivered = useCallback((messageId: string): boolean => {
    return !!messageId; // If we have the message, it's delivered
  }, []);

  return {
    readReceipts,
    loading,
    markMessagesAsRead,
    isMessageRead,
    isMessageDelivered,
    refetch: fetchReadReceipts,
  };
}
