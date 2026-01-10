import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { useMessaging, useChannelMessages } from '@/hooks/useMessaging';
import { AppSidebar } from '@/components/AppSidebar';
import { ClientSidebar } from '@/components/client/ClientSidebar';
import { EditorSidebar } from '@/components/editor/EditorSidebar';
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
  } = useMessaging();

  const {
    messages,
    channel: selectedChannel,
    loading: messagesLoading,
    sendMessage,
  } = useChannelMessages(selectedChannelId);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth/login');
    }
  }, [user, authLoading, navigate]);

  // Handle channel query parameter from URL
  useEffect(() => {
    const channelParam = searchParams.get('channel');
    if (channelParam && !channelsLoading) {
      setSelectedChannelId(channelParam);
      // Clear the query param after setting
      setSearchParams({});
    }
  }, [searchParams, channelsLoading, setSearchParams]);

  // Handle new DM selection
  const handleNewDMSelect = async (userId: string) => {
    const channelId = await getOrCreateDM(userId);
    if (channelId) {
      setSelectedChannelId(channelId);
    }
  };

  // Render correct sidebar based on role
  const renderSidebar = () => {
    switch (userRole) {
      case 'client':
        return <ClientSidebar />;
      case 'editor':
        return <EditorSidebar />;
      default:
        return <AppSidebar role="admin" />;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Messages | Veylodesk</title>
        <meta name="description" content="Communicate with your team and clients." />
      </Helmet>

      <div className="min-h-screen bg-background flex">
        {renderSidebar()}

        <main className="flex-1 flex">
          {/* Chat List Sidebar */}
          <div className="w-80 border-r border-border/50 bg-surface-dark flex flex-col">
            <div className="p-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h1 className="text-lg font-semibold text-foreground">Messages</h1>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatList
                dmChannels={dmChannels as any}
                projectChannels={projectChannels as any}
                selectedChannelId={selectedChannelId}
                onSelectChannel={setSelectedChannelId}
                onNewDM={() => setShowNewDM(true)}
                loading={channelsLoading}
              />
            </div>
          </div>

          {/* Chat Window */}
          <div className="flex-1">
            <ChatWindow
              channel={selectedChannel as any}
              messages={messages as any}
              loading={messagesLoading}
              onSendMessage={sendMessage}
            />
          </div>
        </main>
      </div>

      {/* New DM Modal */}
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
