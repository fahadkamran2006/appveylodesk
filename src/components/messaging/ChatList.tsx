import { useState, useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Hash, Plus, Trash2, Search, ChevronDown, MoreVertical, Pencil,
  Folder, FolderPlus, Briefcase, Users as UsersIcon, UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface Participant {
  user_id: string;
  profile: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

interface Channel {
  id: string;
  type: 'dm' | 'project' | 'custom';
  name: string | null;
  is_archived: boolean;
  updated_at: string;
  participants: Participant[];
  container?: { id: string; title: string } | null;
  project?: { id: string; title: string; status: string } | null;
  last_message?: { content: string; created_at: string } | null;
  group_id?: string | null;
}

interface ChannelGroup {
  id: string;
  name: string;
}

interface ChatListProps {
  dmChannels: Channel[];
  projectChannels: Channel[]; // includes project + custom
  channelGroups?: ChannelGroup[];
  userRolesMap?: Record<string, 'admin' | 'client' | 'editor' | 'staff'>;
  selectedChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  onNewDM?: () => void;
  onNewChannelInGroup?: (groupId: string | null) => void;
  onCreateGroup?: () => void;
  onRenameGroup?: (groupId: string, currentName: string) => void;
  onDeleteGroup?: (groupId: string, name: string) => void;
  onRenameChannel?: (channelId: string, currentName: string) => void;
  onDeleteChannel?: (channelId: string) => Promise<boolean>;
  onChannelDeleted?: () => void;
  loading?: boolean;
  unreadCounts?: { [channelId: string]: number };
  isUserOnline?: (userId: string) => boolean;
  isAdmin?: boolean;
}

const sortByRecency = (a: Channel, b: Channel) => {
  const aTime = a.last_message?.created_at || a.updated_at;
  const bTime = b.last_message?.created_at || b.updated_at;
  return new Date(bTime).getTime() - new Date(aTime).getTime();
};

export function ChatList({
  dmChannels,
  projectChannels,
  channelGroups = [],
  userRolesMap = {},
  selectedChannelId,
  onSelectChannel,
  onNewDM,
  onNewChannelInGroup,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onRenameChannel,
  onDeleteChannel,
  onChannelDeleted,
  loading,
  unreadCounts = {},
  isUserOnline,
  isAdmin,
}: ChatListProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteChannelTarget, setDeleteChannelTarget] = useState<Channel | null>(null);
  const [isDeletingChannel, setIsDeletingChannel] = useState(false);

  // Top-level section expansion
  const [dmExpanded, setDmExpanded] = useState(true);
  const [chExpanded, setChExpanded] = useState(true);
  // Subgroup expansion (controlled per id)
  const [openSub, setOpenSub] = useState<Record<string, boolean>>({});
  const isSubOpen = (k: string) => openSub[k] ?? true;
  const toggleSub = (k: string) => setOpenSub(s => ({ ...s, [k]: !isSubOpen(k) }));

  const getOther = (c: Channel) => c.participants.find(p => p.user_id !== user?.id)?.profile;
  const getInitials = (n: string | null | undefined) => {
    const d = n || 'U';
    return d.split(' ').map(x => x[0]).join('').toUpperCase().slice(0, 2);
  };
  const getChannelLabel = (c: Channel) => {
    if (c.type === 'dm') return getOther(c)?.full_name || getOther(c)?.email || 'User';
    return c.container?.title || c.name || (c.type === 'project' ? 'Project' : 'Channel');
  };
  const matchSearch = (c: Channel) =>
    !searchQuery.trim() || getChannelLabel(c).toLowerCase().includes(searchQuery.toLowerCase());

  // ---- Bucket DMs by other-participant role ----
  const dmBuckets = useMemo(() => {
    const buckets: Record<string, Channel[]> = { client: [], editor: [], team: [] };
    [...dmChannels].filter(matchSearch).sort(sortByRecency).forEach(c => {
      const other = getOther(c);
      const role = other ? userRolesMap[other.id] : undefined;
      if (role === 'client') buckets.client.push(c);
      else if (role === 'editor') buckets.editor.push(c);
      else buckets.team.push(c);
    });
    return buckets;
  }, [dmChannels, userRolesMap, searchQuery, user?.id]);

  // ---- Bucket channels: Projects (auto) + each custom group + Ungrouped ----
  const channelBuckets = useMemo(() => {
    const projects: Channel[] = [];
    const byGroup: Record<string, Channel[]> = {};
    const ungrouped: Channel[] = [];
    [...projectChannels].filter(matchSearch).sort(sortByRecency).forEach(c => {
      if (c.type === 'project') projects.push(c);
      else if (c.group_id) {
        (byGroup[c.group_id] ||= []).push(c);
      } else ungrouped.push(c);
    });
    return { projects, byGroup, ungrouped };
  }, [projectChannels, searchQuery]);

  const totalUnread = (list: Channel[]) =>
    list.reduce((s, c) => s + (unreadCounts[c.id] || 0), 0);

  const handleDeleteChannel = async () => {
    if (!deleteChannelTarget || !onDeleteChannel) return;
    setIsDeletingChannel(true);
    try {
      const ok = await onDeleteChannel(deleteChannelTarget.id);
      if (ok) { setDeleteChannelTarget(null); onChannelDeleted?.(); }
    } finally { setIsDeletingChannel(false); }
  };

  if (loading) {
    return (
      <div className="px-3 py-4 space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 px-2">
            <div className="w-7 h-7 rounded-full bg-muted animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-muted animate-pulse rounded w-24" />
              <div className="h-2 bg-muted/60 animate-pulse rounded w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ---------- Reusable renderers ----------
  const renderDM = (c: Channel) => {
    const other = getOther(c);
    const unread = unreadCounts[c.id] || 0;
    const online = other && isUserOnline ? isUserOnline(other.id) : false;
    const isSelected = c.id === selectedChannelId;
    return (
      <div key={c.id} className="group relative">
        <button
          onClick={() => onSelectChannel(c.id)}
          className={cn(
            'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left text-sm transition-colors',
            isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/60 text-foreground/80'
          )}
        >
          <div className="relative flex-shrink-0">
            <Avatar className="w-7 h-7">
              <AvatarImage src={other?.avatar_url || undefined} />
              <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                {getInitials(other?.full_name || other?.email)}
              </AvatarFallback>
            </Avatar>
            <span className={cn(
              "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background",
              online ? "bg-green-500" : "bg-muted-foreground/40"
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="truncate block">{other?.full_name || other?.email || 'User'}</span>
          </div>
          {unread > 0 && (
            <Badge className="bg-primary text-primary-foreground text-[10px] px-1 py-0 min-w-[16px] h-4 flex-shrink-0">
              {unread > 99 ? '99+' : unread}
            </Badge>
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setDeleteChannelTarget(c); }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
          title="Delete chat"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    );
  };

  const renderChannel = (c: Channel) => {
    const unread = unreadCounts[c.id] || 0;
    const isSelected = c.id === selectedChannelId;
    const display = getChannelLabel(c);
    const slug = display.toLowerCase().replace(/\s+/g, '-');
    return (
      <div key={c.id} className="group relative">
        <button
          onClick={() => onSelectChannel(c.id)}
          className={cn(
            'w-full flex items-center gap-2 pl-2 pr-8 py-1.5 rounded-md text-left text-sm transition-colors',
            isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/60 text-foreground/80'
          )}
        >
          <Hash className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="truncate flex-1">{slug}</span>
          {unread > 0 && (
            <Badge className="bg-primary text-primary-foreground text-[10px] px-1 py-0 min-w-[16px] h-4 flex-shrink-0">
              {unread > 99 ? '99+' : unread}
            </Badge>
          )}
        </button>
        {isAdmin && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button onClick={(e) => e.stopPropagation()} className="p-1 rounded hover:bg-muted text-muted-foreground">
                  <MoreVertical className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {onRenameChannel && (
                  <DropdownMenuItem onClick={() => onRenameChannel(c.id, c.name || display)}>
                    <Pencil className="w-3.5 h-3.5 mr-2" /> Rename
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteChannelTarget(c)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    );
  };

  const SubHeader = ({
    icon: Icon, label, count, unread, openKey, rightAction,
  }: {
    icon: any; label: string; count: number; unread: number;
    openKey: string; rightAction?: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between pl-3 pr-1 py-1 text-[11px] font-medium text-muted-foreground/80 hover:text-foreground group/sub">
      <button onClick={() => toggleSub(openKey)} className="flex items-center gap-1.5 flex-1 min-w-0">
        <ChevronDown className={cn("w-3 h-3 transition-transform", !isSubOpen(openKey) && "-rotate-90")} />
        <Icon className="w-3 h-3" />
        <span className="truncate">{label}</span>
        <span className="text-muted-foreground/50">{count}</span>
        {unread > 0 && (
          <Badge className="bg-primary text-primary-foreground text-[9px] px-1 py-0 min-w-[14px] h-3.5 ml-1">
            {unread}
          </Badge>
        )}
      </button>
      {rightAction}
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="pl-8 h-8 text-sm bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-2 pb-4">
          {/* ========= DIRECT MESSAGES ========= */}
          <div className="mb-2">
            <div className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <button onClick={() => setDmExpanded(!dmExpanded)} className="flex items-center gap-1.5 hover:text-foreground">
                <ChevronDown className={cn("w-3 h-3 transition-transform", !dmExpanded && "-rotate-90")} />
                Direct Messages
                {totalUnread(dmChannels) > 0 && (
                  <Badge className="bg-primary text-primary-foreground text-[10px] px-1 py-0 min-w-[16px] h-4">
                    {totalUnread(dmChannels)}
                  </Badge>
                )}
              </button>
              {onNewDM && (
                <button onClick={onNewDM} className="p-0.5 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground" title="New direct message">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {dmExpanded && (
              <div className="space-y-0.5">
                {/* Clients */}
                <SubHeader icon={UsersIcon} label="Clients" count={dmBuckets.client.length}
                  unread={totalUnread(dmBuckets.client)} openKey="dm:client" />
                {isSubOpen('dm:client') && (
                  <div className="pl-2 space-y-0.5">
                    {dmBuckets.client.length === 0
                      ? <p className="pl-3 py-1 text-[11px] text-muted-foreground/70">No client chats</p>
                      : dmBuckets.client.map(renderDM)}
                  </div>
                )}

                {/* Editors */}
                <SubHeader icon={UserCog} label="Editors" count={dmBuckets.editor.length}
                  unread={totalUnread(dmBuckets.editor)} openKey="dm:editor" />
                {isSubOpen('dm:editor') && (
                  <div className="pl-2 space-y-0.5">
                    {dmBuckets.editor.length === 0
                      ? <p className="pl-3 py-1 text-[11px] text-muted-foreground/70">No editor chats</p>
                      : dmBuckets.editor.map(renderDM)}
                  </div>
                )}

                {/* Team / others */}
                {dmBuckets.team.length > 0 && (
                  <>
                    <SubHeader icon={UsersIcon} label="Team" count={dmBuckets.team.length}
                      unread={totalUnread(dmBuckets.team)} openKey="dm:team" />
                    {isSubOpen('dm:team') && (
                      <div className="pl-2 space-y-0.5">
                        {dmBuckets.team.map(renderDM)}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ========= CHANNELS ========= */}
          <div>
            <div className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <button onClick={() => setChExpanded(!chExpanded)} className="flex items-center gap-1.5 hover:text-foreground">
                <ChevronDown className={cn("w-3 h-3 transition-transform", !chExpanded && "-rotate-90")} />
                Channels
                {totalUnread(projectChannels) > 0 && (
                  <Badge className="bg-primary text-primary-foreground text-[10px] px-1 py-0 min-w-[16px] h-4">
                    {totalUnread(projectChannels)}
                  </Badge>
                )}
              </button>
              {isAdmin && onCreateGroup && (
                <button onClick={onCreateGroup} className="p-0.5 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground" title="New group">
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {chExpanded && (
              <div className="space-y-0.5">
                {/* Projects (auto) */}
                <SubHeader icon={Briefcase} label="Projects" count={channelBuckets.projects.length}
                  unread={totalUnread(channelBuckets.projects)} openKey="ch:projects" />
                {isSubOpen('ch:projects') && (
                  <div className="pl-2 space-y-0.5">
                    {channelBuckets.projects.length === 0
                      ? <p className="pl-3 py-1 text-[11px] text-muted-foreground/70">No project channels</p>
                      : channelBuckets.projects.map(renderChannel)}
                  </div>
                )}

                {/* Custom groups */}
                {channelGroups.map(g => {
                  const list = channelBuckets.byGroup[g.id] || [];
                  return (
                    <div key={g.id}>
                      <SubHeader
                        icon={Folder}
                        label={g.name}
                        count={list.length}
                        unread={totalUnread(list)}
                        openKey={`ch:g:${g.id}`}
                        rightAction={isAdmin ? (
                          <div className="flex items-center gap-0.5">
                            {onNewChannelInGroup && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onNewChannelInGroup(g.id); }}
                                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                title="New channel in group"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button onClick={(e) => e.stopPropagation()} className="p-0.5 rounded hover:bg-muted text-muted-foreground">
                                  <MoreVertical className="w-3 h-3" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                {onRenameGroup && (
                                  <DropdownMenuItem onClick={() => onRenameGroup(g.id, g.name)}>
                                    <Pencil className="w-3.5 h-3.5 mr-2" /> Rename group
                                  </DropdownMenuItem>
                                )}
                                {onDeleteGroup && (
                                  <DropdownMenuItem
                                    onClick={() => onDeleteGroup(g.id, g.name)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete group
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ) : undefined}
                      />
                      {isSubOpen(`ch:g:${g.id}`) && (
                        <div className="pl-2 space-y-0.5">
                          {list.length === 0
                            ? <p className="pl-3 py-1 text-[11px] text-muted-foreground/70">Empty group</p>
                            : list.map(renderChannel)}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Ungrouped custom channels */}
                {channelBuckets.ungrouped.length > 0 && (
                  <>
                    <SubHeader icon={Folder} label="Other channels" count={channelBuckets.ungrouped.length}
                      unread={totalUnread(channelBuckets.ungrouped)} openKey="ch:ungrouped"
                      rightAction={isAdmin && onNewChannelInGroup ? (
                        <button onClick={() => onNewChannelInGroup(null)} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="New channel">
                          <Plus className="w-3 h-3" />
                        </button>
                      ) : undefined}
                    />
                    {isSubOpen('ch:ungrouped') && (
                      <div className="pl-2 space-y-0.5">
                        {channelBuckets.ungrouped.map(renderChannel)}
                      </div>
                    )}
                  </>
                )}

                {/* Quick "new channel" if no group exists yet */}
                {isAdmin && channelGroups.length === 0 && channelBuckets.ungrouped.length === 0 && onNewChannelInGroup && (
                  <button
                    onClick={() => onNewChannelInGroup(null)}
                    className="w-full mt-1 flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-md"
                  >
                    <Plus className="w-3 h-3" /> New channel
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <AlertDialog open={!!deleteChannelTarget} onOpenChange={(open) => !open && setDeleteChannelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" /> Delete this conversation?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All messages will be permanently deleted for everyone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingChannel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChannel}
              disabled={isDeletingChannel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingChannel ? 'Deleting…' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
