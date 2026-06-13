import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Download,
  Eye,
  Undo2,
} from 'lucide-react';
import { VideoPlayer, VideoPlayerHandle } from '@/components/video/VideoPlayer';
import { PoweredByVeylodesk } from '@/components/PoweredByVeylodesk';

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

interface ReviewPermissions {
  allow_comments: boolean;
  allow_approval: boolean;
  allow_download: boolean;
}

export default function PublicReview() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<any>(null);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [permissions, setPermissions] = useState<ReviewPermissions>({
    allow_comments: true,
    allow_approval: false,
    allow_download: false,
  });

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
  const [revisionRequested, setRevisionRequested] = useState(false);

  // Comment tabs
  const [commentTab, setCommentTab] = useState('all');

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
          setPermissions({
            allow_comments: data.review_link?.allow_comments ?? true,
            allow_approval: data.review_link?.allow_approval ?? false,
            allow_download: data.review_link?.allow_download ?? false,
          });
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

  // Redirect signed-in users to internal review page
  useEffect(() => {
    if (!reviewData) return;
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && reviewData?.deliverable?.id && reviewData?.deliverable?.project_id) {
        navigate(`/review/internal/${reviewData.deliverable.project_id}/${reviewData.deliverable.id}`, { replace: true });
      }
    };
    checkAuth();
  }, [reviewData, navigate]);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !nameSubmitted || !permissions.allow_comments) return;
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
        if (action === 'approve') {
          setApproved(true);
          setShowApproveDialog(false);
        } else {
          setRevisionRequested(true);
          setShowRevisionDialog(false);
        }
      }
    } finally {
      setApproving(false);
    }
  };

  const handleDownload = async () => {
    if (!token) return;
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/public-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({ action: 'download', token }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Download failed (${res.status})`);
      }
      const disp = res.headers.get('Content-Disposition') || '';
      const match = disp.match(/filename="([^"]+)"/);
      const name = match ? match[1] : (reviewData?.deliverable?.file_name || 'download');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('Download error:', e);
      alert(e.message || 'Download failed. Please try again or contact support.');
    }
  };

  const handleToggleResolve = async (comment: ReviewComment) => {
    const resolved = !comment.is_resolved;
    setComments(prev => prev.map(c => c.id === comment.id ? { ...c, is_resolved: resolved } : c));
    try {
      const data = await invoke({ action: 'resolve_comment', token, comment_id: comment.id, resolved });
      if (!data?.ok) throw new Error(data?.error || 'Failed');
    } catch {
      // revert
      setComments(prev => prev.map(c => c.id === comment.id ? { ...c, is_resolved: !resolved } : c));
    }
  };


  const formatTimestamp = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const publicComments = comments.filter(c => c.source === 'public');
  const internalComments = comments.filter(c => c.source === 'internal');
  const openComments = comments.filter(c => !c.is_resolved);
  const resolvedComments = comments.filter(c => c.is_resolved);

  const getFilteredComments = () => {
    switch (commentTab) {
      case 'public': return publicComments;
      case 'team': return internalComments;
      case 'resolved': return resolvedComments;
      default: return openComments;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-violet-500 mb-4" />
          <p className="text-zinc-400">Loading review...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Review Unavailable</h1>
          <p className="text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  // Name entry gate
  if (!nameSubmitted) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <Helmet>
          <title>Video Review - {reviewData?.deliverable?.file_name || 'VeyloDesk'}</title>
        </Helmet>
        <div className="w-full max-w-sm space-y-6 text-center">
          <div>
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
              <Film className="w-8 h-8 text-violet-500" />
            </div>
            <h1 className="text-2xl font-bold text-white">Video Review</h1>
            <p className="text-zinc-400 mt-2">
              {reviewData?.project_title && <span className="block font-medium text-zinc-200">{reviewData.project_title}</span>}
              <span className="text-sm">{reviewData?.deliverable?.file_name}</span>
            </p>
          </div>

          <div className="space-y-3">
            <Input
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              placeholder="Enter your name to continue"
              className="text-center bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && reviewerName.trim()) {
                  setNameSubmitted(true);
                }
              }}
            />
            <Button
              onClick={() => setNameSubmitted(true)}
              disabled={!reviewerName.trim()}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            >
              Continue to Review
            </Button>
          </div>

          <p className="text-xs text-zinc-500">
            <ShieldCheck className="w-3 h-3 inline mr-1" />
            No account required. Your name will appear with your feedback.
          </p>
        </div>
      </div>
    );
  }

  const deliverable = reviewData?.deliverable;

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <Helmet>
        <title>Review: {deliverable?.file_name || 'Video'} - VeyloDesk</title>
      </Helmet>

      {/* Top bar */}
      <header className="border-b border-zinc-800 bg-[#0f0f18] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Film className="w-4 h-4 text-violet-500" />
          </div>
          <div>
            <h1 className="font-semibold text-sm text-white">{deliverable?.file_name}</h1>
            {reviewData?.project_title && (
              <p className="text-xs text-zinc-500">{reviewData.project_title}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-300">
            Reviewing as {reviewerName}
          </Badge>
          {deliverable?.version && (
            <Badge className="text-xs bg-violet-500/10 text-violet-400 border-violet-500/20">
              v{deliverable.version}
            </Badge>
          )}
          {permissions.allow_download && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Video player */}
        <div className="w-full lg:flex-1 bg-black flex items-center min-h-[300px]">
          {deliverable?.file_url && (
            <VideoPlayer
              ref={videoPlayerRef}
              src={deliverable.file_url}
              comments={comments.map(c => ({
                id: c.id,
                deliverable_id: deliverable.id,
                user_id: '',
                content: c.content,
                timestamp_seconds: c.timestamp_seconds,
                is_resolved: !!c.is_resolved,
                resolved_by: null,
                resolved_at: null,
                created_at: c.created_at,
                updated_at: c.created_at,
              })) as any}
              onTimeUpdate={(t) => setCurrentTime(t)}
              className="w-full h-full"
            />
          )}
        </div>


        {/* Side panel */}
        <div className="w-full lg:w-[380px] border-t lg:border-t-0 lg:border-l border-zinc-800 bg-[#0f0f18] flex flex-col">
          {/* Approval buttons */}
          {permissions.allow_approval && !approved && !revisionRequested && (
            <div className="p-4 border-b border-zinc-800 space-y-3">
              <p className="text-sm font-medium text-zinc-200">Ready to decide?</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
                  onClick={() => setShowApproveDialog(true)}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  onClick={() => setShowRevisionDialog(true)}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Request Revision
                </Button>
              </div>
            </div>
          )}

          {approved && (
            <div className="p-4 border-b border-zinc-800 bg-emerald-500/5">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium text-sm">Video Approved</span>
              </div>
            </div>
          )}

          {revisionRequested && (
            <div className="p-4 border-b border-zinc-800 bg-amber-500/5">
              <div className="flex items-center gap-2 text-amber-400">
                <Undo2 className="w-5 h-5" />
                <span className="font-medium text-sm">Revision Requested</span>
              </div>
            </div>
          )}

          {/* Comment input */}
          {permissions.allow_comments ? (
            <div className="p-4 border-b border-zinc-800">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Leave feedback..."
                    className="min-h-[60px] resize-none bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitComment();
                      }
                    }}
                  />
                  {currentTime > 0 && (
                    <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      at {formatTimestamp(currentTime)}
                    </p>
                  )}
                </div>
                <Button
                  size="icon"
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || submitting}
                  className="bg-violet-600 hover:bg-violet-700 text-white shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 border-b border-zinc-800">
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <Eye className="w-4 h-4" />
                <span>View-only mode — comments are disabled</span>
              </div>
            </div>
          )}

          {/* Comments tabs & list */}
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <MessageSquare className="w-4 h-4 text-violet-500" />
            <span className="font-medium text-sm text-white">Feedback ({comments.length})</span>
          </div>

          <div className="px-4 pb-2">
            <div className="flex gap-1 bg-zinc-900 rounded-lg p-0.5">
              {[
                { key: 'all', label: `Open (${openComments.length})` },
                { key: 'resolved', label: `Resolved (${resolvedComments.length})` },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setCommentTab(tab.key)}
                  className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-colors ${
                    commentTab === tab.key
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {getFilteredComments().length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-zinc-700" />
                  <p className="text-sm text-zinc-500">No feedback yet</p>
                  {permissions.allow_comments && (
                    <p className="text-xs text-zinc-600">Be the first to leave a comment</p>
                  )}
                </div>
              ) : (
                getFilteredComments().map(comment => (
                  <div
                    key={comment.id}
                    className={`p-3 rounded-xl border transition-colors ${
                      comment.source === 'internal'
                        ? 'bg-zinc-900/50 border-zinc-800/50'
                        : 'bg-zinc-900 border-zinc-800'
                    } ${comment.is_resolved ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="w-7 h-7">
                        <AvatarFallback className={`text-[10px] ${
                          comment.source === 'internal' 
                            ? 'bg-blue-500/20 text-blue-400' 
                            : 'bg-violet-500/20 text-violet-400'
                        }`}>
                          {(comment.reviewer_name || comment.user_name || 'A')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-xs text-zinc-200">
                            {comment.reviewer_name || comment.user_name}
                          </span>
                          {comment.source === 'internal' && (
                            <Badge className="text-[10px] h-4 bg-blue-500/10 text-blue-400 border-blue-500/20">
                              Team
                            </Badge>
                          )}
                          {comment.timestamp_seconds > 0 && (
                            <button
                              onClick={() => videoPlayerRef.current?.seekTo(comment.timestamp_seconds)}
                              className="text-[10px] text-violet-400 hover:text-violet-300 font-mono bg-violet-500/10 px-1.5 py-0.5 rounded"
                            >
                              {formatTimestamp(comment.timestamp_seconds)}
                            </button>
                          )}
                        </div>
                        <p className={`text-sm ${comment.is_resolved ? 'line-through text-zinc-600' : 'text-zinc-300'}`}>
                          {comment.content}
                        </p>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className="text-[10px] text-zinc-600">
                            {new Date(comment.created_at).toLocaleString()}
                          </p>
                          {comment.source === 'public' && (
                            <button
                              onClick={() => handleToggleResolve(comment)}
                              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                                comment.is_resolved
                                  ? 'text-zinc-500 hover:text-zinc-300 bg-zinc-800/50'
                                  : 'text-emerald-400 hover:text-emerald-300 bg-emerald-500/10'
                              }`}
                            >
                              {comment.is_resolved ? 'Reopen' : 'Mark resolved'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {reviewData?.is_free_plan && (
        <div className="border-t border-zinc-800 bg-[#0a0a12]">
          <PoweredByVeylodesk variant="footer" />
        </div>
      )}


      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent className="bg-[#0f0f18] border-zinc-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this video?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This will mark the video as approved and notify the team.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approving} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleApproval('approve')} disabled={approving} className="bg-violet-600 hover:bg-violet-700">
              {approving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revision Dialog */}
      <AlertDialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
        <AlertDialogContent className="bg-[#0f0f18] border-zinc-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Request revision?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This will send the video back for revisions. Make sure you've left feedback on what needs to change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approving} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleApproval('revision')} disabled={approving} className="bg-amber-600 hover:bg-amber-700">
              {approving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Request Revision
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
