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
  Clock,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react';
import { VideoComment } from '@/hooks/useVideoComments';

interface CommentPanelProps {
  comments: VideoComment[];
  unresolvedComments: VideoComment[];
  resolvedComments: VideoComment[];
  canResolve: boolean;
  onAddComment: (content: string, timestampSeconds?: number) => void;
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

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onAddComment(newComment.trim(), currentTimestamp);
      setNewComment('');
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

  const CommentItem = ({ comment, showResolveButton }: { comment: VideoComment; showResolveButton: boolean }) => {
    const isOwn = currentUserId && comment.user_id === currentUserId;
    const canEdit = isOwn && comment.source !== 'public' && onEditComment;
    const canDelete = (isOwn || showResolveButton) && comment.source !== 'public' && onDeleteComment;
    const showMenu = canEdit || canDelete;

    return (
      <div
        className={cn(
          'p-3 rounded-lg border transition-colors group',
          comment.is_resolved 
            ? 'bg-muted/30 border-border/30' 
            : 'bg-card border-border hover:border-primary/30'
        )}
      >
        <div className="flex items-start gap-3">
          <Avatar className="w-8 h-8">
            <AvatarImage src={comment.user_avatar} />
            <AvatarFallback className={cn(
              'text-xs',
              comment.source === 'public' 
                ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400' 
                : 'bg-primary/20 text-primary'
            )}>
              {getInitials(comment.user_name || 'U')}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium text-sm text-foreground truncate">
                {comment.user_name}
              </span>
              {comment.source === 'public' && (
                <Badge variant="outline" className="text-[10px] h-4 gap-0.5">
                  <Globe className="w-2.5 h-2.5" />
                  Public
                </Badge>
              )}
              {comment.timestamp_seconds >= 0 && (
                <button
                  onClick={() => onSeekToTimestamp?.(comment.timestamp_seconds)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-mono font-medium hover:bg-primary/20 transition-colors cursor-pointer"
                  title="Jump to timestamp"
                >
                  <Clock className="w-2.5 h-2.5" />
                  {formatTimestamp(comment.timestamp_seconds)}
                </button>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(comment.created_at).toLocaleDateString()}
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
                'text-sm',
                comment.is_resolved ? 'text-muted-foreground line-through' : 'text-foreground'
              )}>
                {comment.content}
              </p>
            )}

            {/* Resolve button - works for BOTH internal and public comments */}
            {showResolveButton && editingId !== comment.id && (
              <div className="mt-2">
                {comment.is_resolved ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onUnresolveComment(comment.id)}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Undo2 className="w-3 h-3 mr-1" />
                    Reopen
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onResolveComment(comment.id)}
                    className="h-7 text-xs"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Mark Resolved
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Include public unresolved in "open" tab
  const allUnresolved = comments.filter(c => !c.is_resolved);
  const allResolved = comments.filter(c => c.is_resolved);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Feedback</h3>
        {allUnresolved.length > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {allUnresolved.length} open
          </Badge>
        )}
      </div>

      {/* Add comment form */}
      <div className="p-4 border-b border-border">
        {currentTimestamp >= 0 && (
          <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3 text-primary" />
            <span>Commenting at</span>
            <span className="font-mono font-medium text-primary">{formatTimestamp(currentTimestamp)}</span>
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add feedback..."
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
                  <CommentItem 
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
                  <CommentItem 
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
