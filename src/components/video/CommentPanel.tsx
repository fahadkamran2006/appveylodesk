import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  CheckCircle2, 
  MessageSquare, 
  Send,
  Undo2,
  Globe,
  MoreVertical,
  Pencil,
  Trash2,
  Reply,
  Play,
  CornerDownRight,
  X,
} from 'lucide-react';
import { VideoComment } from '@/hooks/useVideoComments';

interface CommentPanelProps {
  comments: VideoComment[];
  unresolvedComments: VideoComment[];
  resolvedComments: VideoComment[];
  canResolve: boolean;
  onAddComment: (content: string, timestampSeconds?: number, parentId?: string | null) => void;
  onResolveComment: (commentId: string) => void;
  onUnresolveComment: (commentId: string) => void;
  onEditComment?: (commentId: string, newContent: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onSeekToTimestamp?: (seconds: number) => void;
  currentTimestamp?: number;
  currentUserId?: string;
  className?: string;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function CommentPanel({
  comments,
  unresolvedComments,
  resolvedComments,
  canResolve,
  onAddComment,
  onResolveComment,
  onUnresolveComment,
  onEditComment,
  onDeleteComment,
  onSeekToTimestamp,
  currentTimestamp = 0,
  currentUserId,
  className,
}: CommentPanelProps) {
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<VideoComment | null>(null);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onAddComment(newComment.trim(), currentTimestamp, replyingTo?.id || null);
      setNewComment('');
      setReplyingTo(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSave = async (commentId: string) => {
    if (!editContent.trim() || !onEditComment) return;
    await onEditComment(commentId, editContent.trim());
    setEditingId(null);
    setEditContent('');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const TimestampBadge = ({ seconds, onClick }: { seconds: number; onClick?: () => void }) => (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-primary/15 to-primary/5 text-primary text-[11px] font-mono font-semibold hover:from-primary/25 hover:to-primary/15 transition-all cursor-pointer ring-1 ring-primary/20 hover:ring-primary/40 shadow-sm"
      title="Jump to timestamp"
    >
      <Play className="w-2.5 h-2.5 fill-current" />
      {formatTimestamp(seconds)}
    </button>
  );

  const SingleComment = ({ comment, showResolveButton, isReply = false }: { comment: VideoComment; showResolveButton: boolean; isReply?: boolean }) => {
    const isOwn = currentUserId && comment.user_id === currentUserId;
    const canEdit = isOwn && comment.source !== 'public' && onEditComment;
    const canDelete = (isOwn || showResolveButton) && comment.source !== 'public' && onDeleteComment;
    const canReply = !isReply && comment.source !== 'public'; // only top-level internal comments can be replied to
    const showMenu = canEdit || canDelete || canReply;

    return (
      <div
        className={cn(
          'rounded-lg border transition-all group',
          isReply ? 'p-2.5' : 'p-3',
          comment.is_resolved 
            ? 'bg-muted/30 border-border/30' 
            : 'bg-card border-border hover:border-primary/20 hover:shadow-sm'
        )}
      >
        <div className="flex items-start gap-2.5">
          <Avatar className={cn(isReply ? 'w-6 h-6' : 'w-8 h-8')}>
            <AvatarImage src={comment.user_avatar} />
            <AvatarFallback className={cn(
              'text-xs font-medium',
              comment.source === 'public' 
                ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400' 
                : 'bg-primary/15 text-primary'
            )}>
              {getInitials(comment.user_name || 'U')}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className={cn(
                'font-semibold text-foreground truncate',
                isReply ? 'text-xs' : 'text-sm'
              )}>
                {comment.user_name}
              </span>
              {comment.source === 'public' && (
                <Badge variant="outline" className="text-[9px] h-[18px] gap-0.5 px-1.5 rounded-full border-violet-300/50 text-violet-600 dark:text-violet-400 bg-violet-500/5">
                  <Globe className="w-2 h-2" />
                  Public
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground/70">
                {new Date(comment.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>

              {/* Actions menu */}
              {showMenu && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canReply && (
                      <DropdownMenuItem onClick={() => setReplyingTo(comment)}>
                        <Reply className="w-3 h-3 mr-2" />
                        Reply
                      </DropdownMenuItem>
                    )}
                    {canEdit && (
                      <DropdownMenuItem onClick={() => { setEditingId(comment.id); setEditContent(comment.content); }}>
                        <Pencil className="w-3 h-3 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <DropdownMenuItem onClick={() => onDeleteComment!(comment.id)} className="text-destructive">
                        <Trash2 className="w-3 h-3 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Timestamp badge */}
            {comment.timestamp_seconds >= 0 && (
              <div className="mb-1.5">
                <TimestampBadge
                  seconds={comment.timestamp_seconds}
                  onClick={() => onSeekToTimestamp?.(comment.timestamp_seconds)}
                />
              </div>
            )}

            {editingId === comment.id ? (
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[50px] resize-none text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs" onClick={() => handleEditSave(comment.id)}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <p className={cn(
                'text-sm leading-relaxed',
                comment.is_resolved ? 'text-muted-foreground line-through' : 'text-foreground/90'
              )}>
                {comment.content}
              </p>
            )}

            {/* Reply button inline */}
            {!isReply && editingId !== comment.id && (
              <div className="flex items-center gap-2 mt-2">
                {!comment.is_resolved && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReplyingTo(comment)}
                    className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-2 gap-1"
                  >
                    <Reply className="w-3 h-3" />
                    Reply
                  </Button>
                )}
                {showResolveButton && (
                  comment.is_resolved ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onUnresolveComment(comment.id)}
                      className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-2 gap-1"
                    >
                      <Undo2 className="w-3 h-3" />
                      Reopen
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onResolveComment(comment.id)}
                      className="h-6 text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 px-2 gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Resolve
                    </Button>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const CommentThread = ({ comment, showResolveButton }: { comment: VideoComment; showResolveButton: boolean }) => {
    const replies = comment.replies || [];
    return (
      <div className="space-y-1">
        <SingleComment comment={comment} showResolveButton={showResolveButton} />
        {replies.length > 0 && (
          <div className="ml-5 pl-3 border-l-2 border-primary/10 space-y-1">
            {replies.map(reply => (
              <SingleComment key={reply.id} comment={reply} showResolveButton={showResolveButton} isReply />
            ))}
          </div>
        )}
      </div>
    );
  };

  const allUnresolved = unresolvedComments;
  const allResolved = resolvedComments;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Feedback</h3>
        {allUnresolved.length > 0 && (
          <Badge variant="secondary" className="ml-auto text-xs">
            {allUnresolved.length} open
          </Badge>
        )}
      </div>

      {/* Add comment form */}
      <div className="p-4 border-b border-border space-y-2">
        {replyingTo && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-primary/5 border border-primary/10 text-xs">
            <CornerDownRight className="w-3 h-3 text-primary shrink-0" />
            <span className="text-muted-foreground truncate">
              Replying to <span className="font-medium text-foreground">{replyingTo.user_name}</span>
            </span>
            <Button variant="ghost" size="icon" className="h-4 w-4 ml-auto shrink-0" onClick={() => setReplyingTo(null)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
        {!replyingTo && currentTimestamp >= 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Commenting at</span>
            <TimestampBadge seconds={currentTimestamp} />
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={replyingTo ? `Reply to ${replyingTo.user_name}...` : 'Add feedback...'}
            className="min-h-[60px] resize-none bg-surface-elevated"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!newComment.trim() || isSubmitting}
            className="shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Comments list */}
      <Tabs defaultValue="open" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-4">
          <TabsTrigger value="open" className="flex-1">
            Open ({allUnresolved.length})
          </TabsTrigger>
          <TabsTrigger value="resolved" className="flex-1">
            Resolved ({allResolved.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {allUnresolved.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No open feedback</p>
                  <p className="text-xs">Add feedback above</p>
                </div>
              ) : (
                allUnresolved.map(comment => (
                  <CommentThread 
                    key={comment.id} 
                    comment={comment} 
                    showResolveButton={canResolve}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="resolved" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {allResolved.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No resolved feedback</p>
                </div>
              ) : (
                allResolved.map(comment => (
                  <CommentThread 
                    key={comment.id} 
                    comment={comment} 
                    showResolveButton={canResolve}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
