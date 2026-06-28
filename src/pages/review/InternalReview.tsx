import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useVideoComments } from '@/hooks/useVideoComments';
import { VideoPlayer, VideoPlayerHandle } from '@/components/video/VideoPlayer';
import { CommentPanel } from '@/components/video/CommentPanel';
import { GenerateReviewLinkModal } from '@/components/projects/GenerateReviewLinkModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Link2, Loader2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DeliverableInfo {
  id: string;
  file_name: string;
  file_url: string;
  version: number | null;
  project_id: string;
  project_title?: string;
}

export default function InternalReview() {
  const { projectId, deliverableId } = useParams<{ projectId: string; deliverableId: string }>();
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);

  const [deliverable, setDeliverable] = useState<DeliverableInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTimestamp, setCurrentTimestamp] = useState(0);
  const [showReviewLinkModal, setShowReviewLinkModal] = useState(false);

  const {
    comments,
    unresolvedComments,
    resolvedComments,
    addComment,
    resolveComment,
    unresolveComment,
    editComment,
    deleteComment,
  } = useVideoComments(deliverableId || null);

  useEffect(() => {
    if (!deliverableId || !projectId) return;

    const fetch = async () => {
      setLoading(true);
      try {
        const { data: del } = await supabase
          .from('deliverables')
          .select('id, file_name, file_url, version, project_id')
          .eq('id', deliverableId)
          .eq('project_id', projectId)
          .single();

        if (!del) return;

        const { data: proj } = await supabase
          .from('projects')
          .select('title')
          .eq('id', projectId)
          .single();

        setDeliverable({
          ...del,
          project_title: proj?.title,
        });
      } catch (e) {
        console.error('Failed to load deliverable:', e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [deliverableId, projectId]);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTimestamp(time);
  }, []);

  const handleSeekToTimestamp = useCallback((seconds: number) => {
    videoPlayerRef.current?.seekTo(seconds);
    setCurrentTimestamp(seconds);
  }, []);

  const handleAddComment = async (content: string, timestampSeconds?: number, parentId?: string | null) => {
    await addComment(content, timestampSeconds, parentId || undefined);
  };

  const canResolve = userRole === 'admin' || userRole === 'editor';
  const canShareLink = userRole === 'admin' || userRole === 'editor';

  const handleDownload = async () => {
    if (!deliverable) return;
    try {
      const { data, error } = await supabase.functions.invoke('deliverables-ops', {
        body: { action: 'download_url', deliverableId: deliverable.id },
      });
      if (error) throw error;
      const url = (data as any)?.downloadUrl || (data as any)?.signedUrl || (data as any)?.url;
      if (!url) throw new Error('Could not generate download URL');
      const a = document.createElement('a');
      a.href = url;
      a.download = deliverable.file_name;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e: any) {
      toast({ title: 'Download failed', description: e.message || 'Please try again', variant: 'destructive' });
    }
  };

  const basePath = userRole === 'admin' ? '/admin' : userRole === 'client' ? '/client' : '/editor';

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!deliverable) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">Deliverable not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(`${basePath}/projects`)}>
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Review: {deliverable.file_name} - VeyloDesk</title>
      </Helmet>

      {/* Top bar */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-semibold text-sm text-foreground">{deliverable.file_name}</h1>
            {deliverable.project_title && (
              <p className="text-xs text-muted-foreground">{deliverable.project_title}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {deliverable.version && (
            <Badge variant="secondary" className="text-xs">v{deliverable.version}</Badge>
          )}
          {canShareLink && (
            <Button variant="outline" size="sm" onClick={() => setShowReviewLinkModal(true)}>
              <Link2 className="w-4 h-4 mr-2" />
              Share Review Link
            </Button>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Video */}
        <div className="w-full lg:flex-1 bg-black flex items-center" style={{ minHeight: '300px', maxHeight: '80vh' }}>
          <VideoPlayer
            ref={videoPlayerRef}
            src={deliverable.file_url}
            deliverableId={deliverable.id}
            comments={comments}
            onTimeUpdate={handleTimeUpdate}
            onSeekToComment={handleSeekToTimestamp}
            className="w-full h-full"
          />
        </div>

        {/* Comment panel */}
        <div className="w-full lg:w-[380px] border-t lg:border-t-0 lg:border-l border-border bg-background flex flex-col overflow-hidden">
          <CommentPanel
            comments={comments}
            unresolvedComments={unresolvedComments}
            resolvedComments={resolvedComments}
            canResolve={canResolve}
            onAddComment={handleAddComment}
            onResolveComment={resolveComment}
            onUnresolveComment={unresolveComment}
            onEditComment={editComment}
            onDeleteComment={deleteComment}
            onSeekToTimestamp={handleSeekToTimestamp}
            currentTimestamp={currentTimestamp}
            currentUserId={user?.id}
            className="h-full"
          />
        </div>
      </div>

      {/* Review Link Modal */}
      <GenerateReviewLinkModal
        open={showReviewLinkModal}
        onOpenChange={setShowReviewLinkModal}
        deliverableId={deliverable.id}
        deliverableName={deliverable.file_name}
      />
    </div>
  );
}
