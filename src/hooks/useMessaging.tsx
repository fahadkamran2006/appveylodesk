import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Channel = Database['public']['Tables']['channels']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];

interface ChannelWithDetails extends Channel {
  participants: {
    user_id: string;
    profile: {
      id: string;
      full_name: string | null;
      email: string;
      avatar_url: string | null;
    };
  }[];
  container?: {
    id: string;
    title: string;
  } | null;
  project?: {
    id: string;
    title: string;
    status: string;
  } | null;
  last_message?: Message | null;
  unread_count?: number;
}

interface MessageWithSender extends Message {
  sender: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

// Shared helper to fetch profiles with retry logic for RLS timing issues
async function fetchProfilesWithRetry(
  userIds: string[],
  retries = 3,
  delayMs = 500
): Promise<{ id: string; full_name: string | null; email: string; avatar_url: string | null; }[]> {
  if (userIds.length === 0) return [];

  for (let attempt = 0; attempt < retries; attempt++) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', userIds);

    if (profilesError) {
      console.error(`Error fetching profiles (attempt ${attempt + 1}):`, profilesError);
    } else if (profilesData && profilesData.length > 0) {
      const resolvedProfiles = profilesData.filter(p => p.full_name !== null);
      if (resolvedProfiles.length === profilesData.length || attempt === retries - 1) {
        return profilesData;
      }
    }

    if (attempt < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return [];
}

export function useMessaging() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [channels, setChannels] = useState<ChannelWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);

  // Fetch agency ID
  useEffect(() => {
    const fetchAgencyId = async () => {
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

    fetchAgencyId();
  }, [user?.id]);

  // Fetch all channels for the user
  const fetchChannels = useCallback(async () => {
    if (!user) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      setLoading(true);

      // Get channels user participates in
      const { data: participations, error: partError } = await supabase
        .from('channel_participants')
        .select('channel_id')
        .eq('user_id', user.id);

      if (partError) throw partError;
      if (!participations?.length) {
        setChannels([]);
        return;
      }

      const channelIds = participations.map(p => p.channel_id);

      // Get channel details
      const { data: channelsData, error: channelsError } = await supabase
        .from('channels')
        .select('*')
        .in('id', channelIds)
        .order('updated_at', { ascending: false });

      if (channelsError) throw channelsError;

      // Get container info for project channels
      const containerIds = [...new Set((channelsData || []).map(c => (c as any).container_id).filter(Boolean))];
      let containersMap: Record<string, { id: string; title: string }> = {};
      if (containerIds.length > 0) {
        const { data: containersData } = await supabase
          .from('project_containers')
          .select('id, title')
          .in('id', containerIds);
        (containersData || []).forEach(c => { containersMap[c.id] = c; });
      }

      // Get participants for each channel
      const { data: allParticipants, error: participantsError } = await supabase
        .from('channel_participants')
        .select('channel_id, user_id')
        .in('channel_id', channelIds);

      if (participantsError) throw participantsError;

      const userIds = [...new Set(allParticipants?.map(p => p.user_id) || [])];
      const profiles = await fetchProfilesWithRetry(userIds);

      // Get last message for each channel
      const { data: lastMessages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .in('channel_id', channelIds)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      const channelsWithDetails: ChannelWithDetails[] = (channelsData || []).map(channel => {
        const channelParticipants = allParticipants
          ?.filter(p => p.channel_id === channel.id)
          .map(p => ({
            user_id: p.user_id,
            profile: profiles?.find(pr => pr.id === p.user_id) || {
              id: p.user_id,
              full_name: null,
              email: '',
              avatar_url: null,
            },
          })) || [];

        const channelMessages = lastMessages?.filter(m => m.channel_id === channel.id) || [];
        const lastMessage = channelMessages[0] || null;
        const containerId = (channel as any).container_id;

        return {
          ...channel,
          participants: channelParticipants,
          container: containerId ? containersMap[containerId] || null : null,
          project: null,
          last_message: lastMessage,
        };
      });

      setChannels(channelsWithDetails);
    } catch (error: any) {
      console.error('Error fetching channels:', error);
      toast({
        title: 'Messaging unavailable',
        description: error.message || 'Failed to load conversations.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Real-time subscription for channel updates
  useEffect(() => {
    if (!user) return;

    const channelSubscription = supabase
      .channel('channels-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channels' }, () => {
        fetchChannels();
      })
      .subscribe();

    return () => { supabase.removeChannel(channelSubscription); };
  }, [user?.id, fetchChannels]);

  // Get or create DM channel
  const getOrCreateDM = async (otherUserId: string): Promise<string | null> => {
    if (!user || !agencyId) return null;

    try {
      const { data, error } = await supabase.rpc('get_or_create_dm_channel', {
        _other_user_id: otherUserId,
        _agency_id: agencyId,
      });

      if (error) throw error;
      await fetchChannels();
      return data;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create conversation',
        variant: 'destructive',
      });
      return null;
    }
  };

  // Delete a channel and all its messages
  const deleteChannel = async (channelId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // Delete all messages in the channel first
      const { error: msgError } = await supabase
        .from('messages')
        .delete()
        .eq('channel_id', channelId);
      if (msgError) throw msgError;

      // Delete read receipts
      await supabase.from('channel_read_receipts').delete().eq('channel_id', channelId);
      await supabase.from('cleared_chats').delete().eq('channel_id', channelId);
      await supabase.from('channel_mutes').delete().eq('channel_id', channelId);
      await supabase.from('message_reactions').delete().in('message_id', 
        (await supabase.from('messages').select('id').eq('channel_id', channelId)).data?.map(m => m.id) || []
      );

      // Delete participants
      const { error: partError } = await supabase
        .from('channel_participants')
        .delete()
        .eq('channel_id', channelId);
      if (partError) throw partError;

      // Delete the channel itself
      const { error: chanError } = await supabase
        .from('channels')
        .delete()
        .eq('id', channelId);
      if (chanError) throw chanError;

      return true;
    } catch (error: any) {
      console.error('Error deleting channel:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete chat',
        variant: 'destructive',
      });
      return false;
    }
  };

  const dmChannels = channels.filter(c => c.type === 'dm');
  const projectChannels = channels.filter(c => c.type === 'project');

  return {
    channels,
    dmChannels,
    projectChannels,
    loading,
    agencyId,
    getOrCreateDM,
    deleteChannel,
    refetch: fetchChannels,
  };
}

// Hook for individual channel messages
export function useChannelMessages(channelId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<ChannelWithDetails | null>(null);

  // Fetch channel details
  useEffect(() => {
    const fetchChannel = async () => {
      if (!channelId) {
        setChannel(null);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('id', channelId)
        .maybeSingle();

      if (!error && data) {
        // Get container info
        const containerId = (data as any).container_id;
        let container = null;
        if (containerId) {
          const { data: containerData } = await supabase
            .from('project_containers')
            .select('id, title')
            .eq('id', containerId)
            .maybeSingle();
          container = containerData;
        }

        // Get participants
        const { data: participants } = await supabase
          .from('channel_participants')
          .select('user_id')
          .eq('channel_id', channelId);

        const userIds = participants?.map(p => p.user_id) || [];
        const profiles = await fetchProfilesWithRetry(userIds);

        setChannel({
          ...data,
          participants: participants?.map(p => ({
            user_id: p.user_id,
            profile: profiles.find(pr => pr.id === p.user_id) || {
              id: p.user_id,
              full_name: null,
              email: '',
              avatar_url: null,
            },
          })) || [],
          container: container,
          project: null,
        });
      }
    };

    fetchChannel();
  }, [channelId]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!channelId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const senderIds = [...new Set(messagesData?.map(m => m.sender_id) || [])];
      const profiles = await fetchProfilesWithRetry(senderIds);

      const messagesWithSenders: MessageWithSender[] = (messagesData || []).map(msg => ({
        ...msg,
        sender: profiles.find(p => p.id === msg.sender_id) || {
          id: msg.sender_id,
          full_name: null,
          email: '',
          avatar_url: null,
        },
      }));

      setMessages(messagesWithSenders);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!channelId) return;

    const messageSubscription = supabase
      .channel(`messages-${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${channelId}`,
      }, async (payload) => {
        const profiles = await fetchProfilesWithRetry([payload.new.sender_id], 2, 300);
        const profile = profiles.find(p => p.id === payload.new.sender_id);

        const newMessage: MessageWithSender = {
          ...(payload.new as Message),
          sender: profile || {
            id: payload.new.sender_id,
            full_name: null,
            email: '',
            avatar_url: null,
          },
        };

        setMessages(prev => [...prev, newMessage]);
      })
      .subscribe();

    return () => { supabase.removeChannel(messageSubscription); };
  }, [channelId]);

  // Send message
  const sendMessage = async (
    content: string,
    attachmentUrl?: string,
    attachmentType?: string,
    parentId?: string | null
  ): Promise<boolean> => {
    if (!user || !channelId || (!content.trim() && !attachmentUrl)) return false;

    try {
      const insertData: any = {
        channel_id: channelId,
        sender_id: user.id,
        content: content.trim(),
        attachment_url: attachmentUrl || null,
        attachment_type: attachmentType || null,
      };
      if (parentId) insertData.parent_id = parentId;

      const { error } = await supabase.from('messages').insert(insertData);
      if (error) throw error;

      await supabase
        .from('channels')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', channelId);

      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    messages,
    channel,
    loading,
    sendMessage,
    refetch: fetchMessages,
  };
}

// Hook for muting users in project channels
export function useChannelMutes(channelId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mutedUsers, setMutedUsers] = useState<string[]>([]);

  useEffect(() => {
    const fetchMutes = async () => {
      if (!channelId || !user) return;

      const { data } = await supabase
        .from('channel_mutes')
        .select('muted_user_id')
        .eq('channel_id', channelId)
        .eq('muted_by', user.id);

      setMutedUsers(data?.map(m => m.muted_user_id) || []);
    };

    fetchMutes();
  }, [channelId, user?.id]);

  const muteUser = async (userId: string): Promise<boolean> => {
    if (!channelId || !user) return false;
    try {
      const { error } = await supabase.from('channel_mutes').insert({
        channel_id: channelId, muted_by: user.id, muted_user_id: userId,
      });
      if (error) throw error;
      setMutedUsers(prev => [...prev, userId]);
      toast({ title: 'User muted', description: 'Notifications silenced for this user.' });
      return true;
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const unmuteUser = async (userId: string): Promise<boolean> => {
    if (!channelId || !user) return false;
    try {
      const { error } = await supabase.from('channel_mutes').delete()
        .eq('channel_id', channelId).eq('muted_by', user.id).eq('muted_user_id', userId);
      if (error) throw error;
      setMutedUsers(prev => prev.filter(id => id !== userId));
      toast({ title: 'User unmuted' });
      return true;
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const isUserMuted = (userId: string) => mutedUsers.includes(userId);

  return { mutedUsers, muteUser, unmuteUser, isUserMuted };
}
