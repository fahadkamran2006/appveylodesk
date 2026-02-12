import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { useMessaging, useChannelMessages } from '@/hooks/useMessaging';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { usePresence } from '@/hooks/usePresence';
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar';
import { ChatList } from '@/components/messaging/ChatList';
import { ChatWindow } from '@/components/messaging/ChatWindow';
import { NewDMModal } from '@/components/messaging/NewDMModal';
import { MessageSquare } from 'lucide-react';

const MessagesPage = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [showNewDM, setShowNewDM] = useState(false);

  const { 
    dmChannels, 
    projectChannels, 
    loading: channelsLoading, 
    agencyId,
    getOrCreateDM,
    deleteChannel,
    refetch: refetchChannels,
  } = useMessaging();

  const {
    messages,
    channel: selectedChannel,
    loading: messagesLoading,
    sendMessage,
  } = useChannelMessages(selectedChannelId);

  const { unreadCounts, markChannelAsRead } = useUnreadMessages();
  const { isOnline } = usePresence(agencyId);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const channelParam = searchParams.get('channel');
    if (channelParam && !channelsLoading) {
      setSelectedChannelId(channelParam);
      setSearchParams({});
    }
  }, [searchParams, channelsLoading, setSearchParams]);

  const handleSelectChannel = useCallback((channelId: string) => {
    setSelectedChannelId(channelId);
    markChannelAsRead(channelId);
  }, [markChannelAsRead]);

  const handleNewDMSelect = async (userId: string) => {
    const channelId = await getOrCreateDM(userId);
    if (channelId) {
      handleSelectChannel(channelId);
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    const success = await deleteChannel(channelId);
    if (success) {
      if (selectedChannelId === channelId) {
        setSelectedChannelId(null);
      }
      refetchChannels();
    }
    return success;
  };

  const getSidebarRole = (): 'admin' | 'client' | 'editor' => {
    switch (userRole) {
      case 'client': return 'client';
      case 'editor': return 'editor';
      default: return 'admin';
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const showChatListOnMobile = !selectedChannelId;

  return (
    <>
      <Helmet>
        <title>Messages | Veylodesk</title>
        <meta name="description" content="Communicate with your team and clients." />
      </Helmet>

      <div className="h-screen bg-background flex overflow-hidden">
        <div className="hidden md:block">
          <CollapsibleSidebar role={getSidebarRole()} />
        </div>

        <main className="flex-1 flex h-full overflow-hidden">
          {/* Slack-style sidebar */}
          <div className={`
            ${showChatListOnMobile ? 'flex' : 'hidden'} md:flex
            w-full md:w-72 lg:w-80 h-full border-r border-border/30 bg-background flex-col
          `}>
            <div className="shrink-0 px-4 py-3 border-b border-border/30">
              <h1 className="text-base font-bold text-foreground tracking-tight">Messages</h1>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ChatList
                dmChannels={dmChannels as any}
                projectChannels={projectChannels as any}
                selectedChannelId={selectedChannelId}
                onSelectChannel={handleSelectChannel}
                onNewDM={() => setShowNewDM(true)}
                onDeleteChannel={handleDeleteChannel}
                onChannelDeleted={() => { setSelectedChannelId(null); refetchChannels(); }}
                loading={channelsLoading}
                unreadCounts={unreadCounts}
                isUserOnline={isOnline}
              />
            </div>
          </div>

          {/* Chat Window */}
          <div className={`
            ${!showChatListOnMobile ? 'flex' : 'hidden'} md:flex
            flex-1 h-full overflow-hidden flex-col
          `}>
            <ChatWindow
              channel={selectedChannel as any}
              messages={messages as any}
              loading={messagesLoading}
              onSendMessage={sendMessage}
              onBack={() => setSelectedChannelId(null)}
              showBackButton={!!selectedChannelId}
            />
          </div>
        </main>
      </div>

      <NewDMModal
        open={showNewDM}
        onOpenChange={setShowNewDM}
        agencyId={agencyId}
        onSelectUser={handleNewDMSelect}
      />
    </>
  );
};

export default MessagesPage;
