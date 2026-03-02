import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Send,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Film,
} from 'lucide-react';
import { VideoPlayer, VideoPlayerHandle } from '@/components/video/VideoPlayer';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface ReviewComment {
  id: string;
  reviewer_name?: string;
  user_name?: string;
  content: string;
  timestamp_seconds: number;
  created_at: string;
  source: 'public' | 'internal';
  is_resolved?: boolean;
}

export default function PublicReview() {
  const { token } = useParams<{ token: string }>();
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<any>(null);
  const [comments, setComments] = useState<ReviewComment[]>([]);

  // Reviewer identity
  const [reviewerName, setReviewerName] = useState('');
  const [nameSubmitted, setNameSubmitted] = useState(false);

  // Comment form
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Approval
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  const invoke = useCallback(async (body: any) => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/public-review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify(body),
    });
    return res.json();
  }, []);

  // Fetch review data
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    invoke({ action: 'get_review', token })
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setReviewData(data);
          // Merge public and internal comments
          const allComments = [
            ...(data.comments || []),
            ...(data.internal_comments || []),
          ].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          setComments(allComments);
        }
      })
      .catch(() => setError('Failed to load review'))
      .finally(() => setLoading(false));
  }, [token, invoke]);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !nameSubmitted) return;
    setSubmitting(true);
    try {
      const data = await invoke({
        action: 'add_comment',
        token,
        reviewer_name: reviewerName,
        content: newComment.trim(),
        timestamp_seconds: currentTime,
      });

      if (data.ok && data.comment) {
        setComments(prev => [...prev, {
          id: data.comment.id,
          reviewer_name: reviewerName,
          content: data.comment.content,
          timestamp_seconds: Number(data.comment.timestamp_seconds),
          created_at: data.comment.created_at,
          source: 'public',
        }]);
        setNewComment('');
      }
    } catch {
      // silent fail
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproval = async (action: 'approve' | 'revision') => {
    setApproving(true);
    try {
      const data = await invoke({ action: 'approve_video', token, approval_action: action });
      if (data.ok) {
        setApproved(action === 'approve');
        if (action === 'approve') {
          setShowApproveDialog(false);
        } else {
          setShowRevisionDialog(false);
        }
      }
    } finally {
      setApproving(false);
    }
  };

  const formatTimestamp = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Error / expired states
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-4" />
          <p className="text-muted-foreground">Loading review...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 mx-auto text-destructive mb-4" />
          <h1 className="text-xl font-bold mb-2">Review Unavailable</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  // Name entry gate
  if (!nameSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Helmet>
          <title>Video Review - {reviewData?.deliverable?.file_name || 'VeyloDesk'}</title>
        </Helmet>
        <div className="w-full max-w-sm space-y-6 text-center">
          <div>
            <Film className="w-12 h-12 mx-auto text-primary mb-4" />
            <h1 className="text-2xl font-bold">Video Review</h1>
            <p className="text-muted-foreground mt-2">
              {reviewData?.project_title && <span className="block font-medium text-foreground">{reviewData.project_title}</span>}
              {reviewData?.deliverable?.file_name}
            </p>
          </div>

          <div className="space-y-3">
            <Input
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              placeholder="Enter your name to continue"
              className="text-center"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && reviewerName.trim()) {
                  setNameSubmitted(true);
                }
              }}
            />
            <Button
              onClick={() => setNameSubmitted(true)}
              disabled={!reviewerName.trim()}
              className="w-full"
            >
              Continue to Review
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            <ShieldCheck className="w-3 h-3 inline mr-1" />
            No account required. Your name will appear with your feedback.
          </p>
        </div>
      </div>
    );
  }

  const deliverable = reviewData?.deliverable;
  const allowApproval = reviewData?.review_link?.allow_approval;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Review: {deliverable?.file_name || 'Video'} - VeyloDesk</title>
      </Helmet>

      {/* Top bar */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Film className="w-5 h-5 text-primary" />
          <div>
            <h1 className="font-semibold text-sm">{deliverable?.file_name}</h1>
            {reviewData?.project_title && (
              <p className="text-xs text-muted-foreground">{reviewData.project_title}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Reviewing as {reviewerName}
          </Badge>
          {deliverable?.version && (
            <Badge variant="secondary" className="text-xs">v{deliverable.version}</Badge>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Video player */}
        <div className="w-full lg:flex-1 bg-black flex items-center" style={{ minHeight: '300px', maxHeight: '70vh' }}>
          {deliverable?.file_url && (
            <VideoPlayer
              ref={videoPlayerRef}
              src={deliverable.file_url}
              comments={[]}
              onTimeUpdate={(t) => setCurrentTime(t)}
              className="w-full h-full"
            />
          )}
        </div>

        {/* Side panel */}
        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-border bg-card flex flex-col">
          {/* Approval buttons */}
          {allowApproval && !approved && (
            <div className="p-4 border-b border-border space-y-2">
              <p className="text-sm font-medium">Ready to decide?</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => setShowApproveDialog(true)}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowRevisionDialog(true)}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Request Revision
                </Button>
              </div>
            </div>
          )}

          {approved && (
            <div className="p-4 border-b border-border bg-primary/5">
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium text-sm">Video Approved</span>
              </div>
            </div>
          )}

          {/* Comment input */}
          <div className="p-4 border-b border-border">
            <div className="flex gap-2">
              <div className="flex-1">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Leave feedback..."
                  className="min-h-[60px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitComment();
                    }
                  }}
                />
                {currentTime > 0 && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    at {formatTimestamp(currentTime)}
                  </p>
                )}
              </div>
              <Button
                size="icon"
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || submitting}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Comments list */}
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Feedback ({comments.length})</span>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {comments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No feedback yet</p>
                  <p className="text-xs">Be the first to leave a comment</p>
                </div>
              ) : (
                comments.map(comment => (
                  <div
                    key={comment.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      comment.source === 'internal'
                        ? 'bg-muted/20 border-border/50'
                        : 'bg-card border-border'
                    } ${comment.is_resolved ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="w-7 h-7">
                        <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                          {(comment.reviewer_name || comment.user_name || 'A')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-xs text-foreground">
                            {comment.reviewer_name || comment.user_name}
                          </span>
                          {comment.source === 'internal' && (
                            <Badge variant="outline" className="text-[10px] h-4">Team</Badge>
                          )}
                          {comment.timestamp_seconds > 0 && (
                            <button
                              onClick={() => videoPlayerRef.current?.seekTo(comment.timestamp_seconds)}
                              className="text-[10px] text-primary hover:underline"
                            >
                              {formatTimestamp(comment.timestamp_seconds)}
                            </button>
                          )}
                        </div>
                        <p className={`text-sm ${comment.is_resolved ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {comment.content}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(comment.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this video?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the video as approved and notify the team.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleApproval('approve')} disabled={approving}>
              {approving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revision Dialog */}
      <AlertDialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request revision?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send the video back for revisions. Make sure you've left feedback on what needs to change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleApproval('revision')} disabled={approving}>
              {approving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Request Revision
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
