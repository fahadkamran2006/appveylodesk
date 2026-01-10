import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Channel = Database['public']['Tables']['channels']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];
type ChannelType = Database['public']['Enums']['channel_type'];

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

export function useMessaging() {
  const { user, userRole } = useAuth();
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
        .select(`
          *,
          project:projects(id, title, status)
        `)
        .in('id', channelIds)
        .order('updated_at', { ascending: false });

      if (channelsError) throw channelsError;

      // Get participants for each channel
      const { data: allParticipants, error: participantsError } = await supabase
        .from('channel_participants')
        .select('channel_id, user_id')
        .in('channel_id', channelIds);

      if (participantsError) throw participantsError;

      // Get unique user IDs
      const userIds = [...new Set(allParticipants?.map(p => p.user_id) || [])];

      // Get profiles for all participants
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Get last message for each channel
      const { data: lastMessages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .in('channel_id', channelIds)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      // Build channel details
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

        // Find last message for this channel
        const channelMessages = lastMessages?.filter(m => m.channel_id === channel.id) || [];
        const lastMessage = channelMessages[0] || null;

        return {
          ...channel,
          participants: channelParticipants,
          project: channel.project as ChannelWithDetails['project'],
          last_message: lastMessage,
        };
      });

      setChannels(channelsWithDetails);
    } catch (error: any) {
      console.error('Error fetching channels:', error);
      toast({
        title: 'Messaging unavailable',
        description: error.message || 'Failed to load conversations. Please try again.',
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels',
        },
        () => {
          fetchChannels();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelSubscription);
    };
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

  // Filter channels by type
  const dmChannels = channels.filter(c => c.type === 'dm');
  const projectChannels = channels.filter(c => c.type === 'project');

  return {
    channels,
    dmChannels,
    projectChannels,
    loading,
    agencyId,
    getOrCreateDM,
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

      const { data, error } = await supabase
        .from('channels')
        .select(`
          *,
          project:projects(id, title, status)
        `)
        .eq('id', channelId)
        .maybeSingle();

      if (!error && data) {
        // Get participants
        const { data: participants } = await supabase
          .from('channel_participants')
          .select('user_id')
          .eq('channel_id', channelId);

        const userIds = participants?.map(p => p.user_id) || [];

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', userIds);

        setChannel({
          ...data,
          participants: participants?.map(p => ({
            user_id: p.user_id,
            profile: profiles?.find(pr => pr.id === p.user_id) || {
              id: p.user_id,
              full_name: null,
              email: '',
              avatar_url: null,
            },
          })) || [],
          project: data.project as ChannelWithDetails['project'],
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

    try {
      setLoading(true);

      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get sender profiles
      const senderIds = [...new Set(messagesData?.map(m => m.sender_id) || [])];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', senderIds);

      const messagesWithSenders: MessageWithSender[] = (messagesData || []).map(msg => ({
        ...msg,
        sender: profiles?.find(p => p.id === msg.sender_id) || {
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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          // Fetch sender profile for new message
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .eq('id', payload.new.sender_id)
            .maybeSingle();

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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageSubscription);
    };
  }, [channelId]);

  // Send message
  const sendMessage = async (content: string): Promise<boolean> => {
    if (!user || !channelId || !content.trim()) return false;

    try {
      const { error } = await supabase.from('messages').insert({
        channel_id: channelId,
        sender_id: user.id,
        content: content.trim(),
      });

      if (error) throw error;

      // Update channel's updated_at
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
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [mutedUsers, setMutedUsers] = useState<string[]>([]);

  // Fetch muted users
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

  // Mute a user
  const muteUser = async (userId: string): Promise<boolean> => {
    if (!channelId || !user) return false;

    try {
      const { error } = await supabase.from('channel_mutes').insert({
        channel_id: channelId,
        muted_by: user.id,
        muted_user_id: userId,
      });

      if (error) throw error;

      setMutedUsers(prev => [...prev, userId]);
      
      toast({
        title: 'User muted',
        description: 'You will no longer receive notifications from this user.',
      });

      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to mute user',
        variant: 'destructive',
      });
      return false;
    }
  };

  // Unmute a user
  const unmuteUser = async (userId: string): Promise<boolean> => {
    if (!channelId || !user) return false;

    try {
      const { error } = await supabase
        .from('channel_mutes')
        .delete()
        .eq('channel_id', channelId)
        .eq('muted_by', user.id)
        .eq('muted_user_id', userId);

      if (error) throw error;

      setMutedUsers(prev => prev.filter(id => id !== userId));
      
      toast({
        title: 'User unmuted',
        description: 'You will now receive notifications from this user.',
      });

      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to unmute user',
        variant: 'destructive',
      });
      return false;
    }
  };

  const isUserMuted = (userId: string) => mutedUsers.includes(userId);

  return {
    mutedUsers,
    muteUser,
    unmuteUser,
    isUserMuted,
  };
}
