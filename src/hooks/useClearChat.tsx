import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface ClearedChat {
  channel_id: string;
  cleared_at: string;
}

export function useClearChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clearedChats, setClearedChats] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  // Fetch all cleared chats for user
  const fetchClearedChats = useCallback(async () => {
    if (!user) {
      setClearedChats(new Map());
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('cleared_chats')
        .select('channel_id, cleared_at')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching cleared chats:', error);
        setLoading(false);
        return;
      }

      const chatMap = new Map<string, string>();
      data?.forEach(c => {
        chatMap.set(c.channel_id, c.cleared_at);
      });

      setClearedChats(chatMap);
    } catch (err) {
      console.error('Error in fetchClearedChats:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchClearedChats();
  }, [fetchClearedChats]);

  // Clear chat for current user
  const clearChat = useCallback(async (channelId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('cleared_chats')
        .upsert(
          {
            channel_id: channelId,
            user_id: user.id,
            cleared_at: new Date().toISOString(),
          },
          { onConflict: 'channel_id,user_id' }
        );

      if (error) throw error;

      // Update local state
      setClearedChats(prev => {
        const newMap = new Map(prev);
        newMap.set(channelId, new Date().toISOString());
        return newMap;
      });

      toast({
        title: 'Chat cleared',
        description: 'Chat history has been hidden for you.',
      });

      return true;
    } catch (err: any) {
      console.error('Error clearing chat:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to clear chat',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, toast]);

  // Get cleared_at timestamp for a channel
  const getClearedAt = useCallback((channelId: string): string | null => {
    return clearedChats.get(channelId) || null;
  }, [clearedChats]);

  return {
    clearedChats,
    loading,
    clearChat,
    getClearedAt,
    refetch: fetchClearedChats,
  };
}
