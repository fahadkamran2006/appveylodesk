import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

interface ReactionSummary {
  emoji: string;
  count: number;
  userIds: string[];
  hasReacted: boolean;
}

export function useMessageReactions(channelId: string | null) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<Map<string, Reaction[]>>(new Map());

  // Fetch all reactions for the channel's messages
  const fetchReactions = useCallback(async () => {
    if (!channelId || !user) return;

    const { data: messages } = await supabase
      .from('messages')
      .select('id')
      .eq('channel_id', channelId);

    if (!messages?.length) return;

    const { data, error } = await supabase
      .from('message_reactions')
      .select('*')
      .in('message_id', messages.map(m => m.id));

    if (error) {
      console.error('Error fetching reactions:', error);
      return;
    }

    const map = new Map<string, Reaction[]>();
    data?.forEach(r => {
      const existing = map.get(r.message_id) || [];
      map.set(r.message_id, [...existing, r]);
    });
    setReactions(map);
  }, [channelId, user]);

  useEffect(() => {
    fetchReactions();
  }, [fetchReactions]);

  // Realtime subscription
  useEffect(() => {
    if (!channelId) return;

    const sub = supabase
      .channel(`reactions-${channelId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_reactions',
      }, () => {
        fetchReactions();
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [channelId, fetchReactions]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;

    const messageReactions = reactions.get(messageId) || [];
    const existing = messageReactions.find(r => r.user_id === user.id && r.emoji === emoji);

    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('message_reactions').insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      });
    }
  }, [user, reactions]);

  const getReactionSummary = useCallback((messageId: string): ReactionSummary[] => {
    const messageReactions = reactions.get(messageId) || [];
    const emojiMap = new Map<string, { count: number; userIds: string[] }>();

    messageReactions.forEach(r => {
      const existing = emojiMap.get(r.emoji) || { count: 0, userIds: [] };
      emojiMap.set(r.emoji, {
        count: existing.count + 1,
        userIds: [...existing.userIds, r.user_id],
      });
    });

    return Array.from(emojiMap.entries()).map(([emoji, data]) => ({
      emoji,
      count: data.count,
      userIds: data.userIds,
      hasReacted: user ? data.userIds.includes(user.id) : false,
    }));
  }, [reactions, user]);

  return { toggleReaction, getReactionSummary };
}
