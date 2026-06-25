import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { useMessaging, useChannelMessages } from '@/hooks/useMessaging';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { usePresence } from '@/hooks/usePresence';
import { supabase } from '@/integrations/supabase/client';
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar';
import { ChatList } from '@/components/messaging/ChatList';
import { ChatWindow } from '@/components/messaging/ChatWindow';
import { NewDMModal } from '@/components/messaging/NewDMModal';
import { NewChannelModal } from '@/components/messaging/NewChannelModal';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MessagesPage = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [showNewDM, setShowNewDM] = useState(false);

  // Channel creation
  const [newChannelGroupId, setNewChannelGroupId] = useState<string | null>(null);
  const [showNewChannel, setShowNewChannel] = useState(false);

  // Inline rename / create-group dialog
  const [editor, setEditor] = useState<
    | { kind: 'createGroup' }
    | { kind: 'renameGroup'; id: string; currentName: string }
    | { kind: 'renameChannel'; id: string; currentName: string }
    | null
  >(null);
  const [editorValue, setEditorValue] = useState('');
  const [editorBusy, setEditorBusy] = useState(false);

  // Delete-group confirm
  const [groupToDelete, setGroupToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);

  // User roles map (for DM bucketing)
  const [userRolesMap, setUserRolesMap] = useState<Record<string, 'admin' | 'client' | 'editor' | 'staff'>>({});

  const {
    dmChannels,
    projectChannels,
    channelGroups,
    loading: channelsLoading,
    agencyId,
    getOrCreateDM,
    createCustomChannel,
    renameChannel,
    createChannelGroup,
    renameChannelGroup,
    deleteChannelGroup,
    deleteChannel,
    refetch: refetchChannels,
  } = useMessaging();

  const {
    messages,
    channel: selectedChannel,
    loading: messagesLoading,
    sendMessage,
    editMessage,
    deleteMessage,
  } = useChannelMessages(selectedChannelId);

  const { unreadCounts, markChannelAsRead } = useUnreadMessages();
  const { isOnline } = usePresence(agencyId);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth/login');
  }, [user, authLoading, navigate]);

  // Load roles for everyone in the agency (for DM bucket grouping)
  useEffect(() => {
    if (!agencyId) return;
    (async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('agency_id', agencyId);
      if (data) {
        const m: Record<string, any> = {};
        data.forEach((r: any) => { m[r.user_id] = r.role; });
        setUserRolesMap(m);
      }
    })();
  }, [agencyId]);

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
    if (channelId) handleSelectChannel(channelId);
  };

  const handleDeleteChannel = async (channelId: string) => {
    const success = await deleteChannel(channelId);
    if (success) {
      if (selectedChannelId === channelId) setSelectedChannelId(null);
      refetchChannels();
    }
    return success;
  };

  const handleEditorSave = async () => {
    if (!editor) return;
    const v = editorValue.trim();
    if (!v) return;
    setEditorBusy(true);
    try {
      if (editor.kind === 'createGroup') await createChannelGroup(v);
      else if (editor.kind === 'renameGroup') await renameChannelGroup(editor.id, v);
      else if (editor.kind === 'renameChannel') await renameChannel(editor.id, v);
      setEditor(null);
    } finally { setEditorBusy(false); }
  };

  const openNewChannel = (groupId: string | null) => {
    setNewChannelGroupId(groupId);
    setShowNewChannel(true);
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    setDeletingGroup(true);
    try {
      await deleteChannelGroup(groupToDelete.id);
      setGroupToDelete(null);
    } finally { setDeletingGroup(false); }
  };

  const getSidebarRole = (): 'admin' | 'client' | 'editor' | 'staff' => {
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
  const isChatOpenOnMobile = !!selectedChannelId;
  const isAdmin = userRole === 'admin';

  const groupNameById = newChannelGroupId
    ? channelGroups.find(g => g.id === newChannelGroupId)?.name || null
    : null;

  const editorTitle =
    editor?.kind === 'createGroup' ? 'New channel group' :
    editor?.kind === 'renameGroup' ? 'Rename group' :
    editor?.kind === 'renameChannel' ? 'Rename channel' : '';

  const editorPlaceholder =
    editor?.kind === 'createGroup' ? 'e.g. Marketing' :
    editor?.kind === 'renameGroup' ? 'Group name' :
    'Channel name';

  return (
    <>
      <Helmet>
        <title>Messages | Veylodesk</title>
        <meta name="description" content="Communicate with your team and clients." />
      </Helmet>

      <div className="h-[100dvh] bg-background flex overflow-hidden">
        <div className="hidden md:block">
          <CollapsibleSidebar role={getSidebarRole()} />
        </div>

        <main className={cn(
          "flex-1 flex h-full overflow-hidden",
          showChatListOnMobile ? "pb-16 md:pb-0" : "pb-0"
        )}>
          <div className={`
            ${showChatListOnMobile ? 'flex' : 'hidden'} md:flex
            w-full md:w-72 lg:w-80 h-full border-r border-border bg-card flex-col
          `}>
            <div className="shrink-0 px-4 py-3 border-b border-border">
              <h1 className="text-base font-bold text-foreground tracking-tight">Messages</h1>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ChatList
                dmChannels={dmChannels as any}
                projectChannels={projectChannels as any}
                channelGroups={channelGroups}
                userRolesMap={userRolesMap}
                selectedChannelId={selectedChannelId}
                onSelectChannel={handleSelectChannel}
                onNewDM={() => setShowNewDM(true)}
                onNewChannelInGroup={isAdmin ? openNewChannel : undefined}
                onCreateGroup={isAdmin ? () => { setEditorValue(''); setEditor({ kind: 'createGroup' }); } : undefined}
                onRenameGroup={isAdmin ? (id, name) => { setEditorValue(name); setEditor({ kind: 'renameGroup', id, currentName: name }); } : undefined}
                onDeleteGroup={isAdmin ? (id, name) => setGroupToDelete({ id, name }) : undefined}
                onRenameChannel={isAdmin ? (id, name) => { setEditorValue(name); setEditor({ kind: 'renameChannel', id, currentName: name }); } : undefined}
                onDeleteChannel={handleDeleteChannel}
                onChannelDeleted={() => { setSelectedChannelId(null); refetchChannels(); }}
                loading={channelsLoading}
                unreadCounts={unreadCounts}
                isUserOnline={isOnline}
                isAdmin={isAdmin}
              />
            </div>
          </div>

          <div className={`
            ${!showChatListOnMobile ? 'flex' : 'hidden'} md:flex
            flex-1 h-full overflow-hidden flex-col
          `}>
            <ChatWindow
              channel={selectedChannel as any}
              messages={messages as any}
              loading={messagesLoading || (!!selectedChannelId && !selectedChannel)}
              onSendMessage={sendMessage}
              onEditMessage={editMessage}
              onDeleteMessage={deleteMessage}
              onBack={() => setSelectedChannelId(null)}
              showBackButton={!!selectedChannelId}
            />
          </div>
        </main>
      </div>

      {!isChatOpenOnMobile && <MobileBottomNav role={getSidebarRole()} />}

      <NewDMModal
        open={showNewDM}
        onOpenChange={setShowNewDM}
        agencyId={agencyId}
        onSelectUser={handleNewDMSelect}
      />

      <NewChannelModal
        open={showNewChannel}
        onOpenChange={setShowNewChannel}
        agencyId={agencyId}
        groupId={newChannelGroupId}
        groupName={groupNameById}
        onCreate={async (name, ids, gid) => {
          const channelId = await createCustomChannel(name, ids, gid);
          if (channelId) handleSelectChannel(channelId);
          return channelId;
        }}
      />

      {/* Inline editor for group/channel naming */}
      <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editorTitle}</DialogTitle>
            <DialogDescription>
              {editor?.kind === 'createGroup'
                ? 'Create a folder to organize related channels.'
                : 'Choose a clear, descriptive name.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="editor-name">Name</Label>
            <Input
              id="editor-name"
              autoFocus
              value={editorValue}
              onChange={(e) => setEditorValue(e.target.value)}
              placeholder={editorPlaceholder}
              maxLength={80}
              onKeyDown={(e) => { if (e.key === 'Enter') handleEditorSave(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditor(null)} disabled={editorBusy}>Cancel</Button>
            <Button onClick={handleEditorSave} disabled={!editorValue.trim() || editorBusy}>
              {editorBusy ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete group confirmation */}
      <AlertDialog open={!!groupToDelete} onOpenChange={(o) => !o && setGroupToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete group "{groupToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The group will be removed. Channels inside it will move to "Other channels" — they won't be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingGroup}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              disabled={deletingGroup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingGroup ? 'Deleting…' : 'Delete group'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MessagesPage;
