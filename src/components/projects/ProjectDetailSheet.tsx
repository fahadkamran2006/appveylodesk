import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  X, 
  Calendar, 
  User, 
  Users, 
  DollarSign,
  Video,
  FolderOpen,
  ArrowLeft,
  MessageSquare,
  Trash2,
  Loader2,
  Image as ImageIcon,
  Edit3,
  Link as LinkIcon,
  ExternalLink,
  Package,
  FolderKanban,
  ArrowRightLeft,
  Link2
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStorage, Deliverable } from '@/hooks/useStorage';
import { useVideoComments } from '@/hooks/useVideoComments';
import { FileManager } from './FileManager';
import { VideoPlayer, VideoPlayerHandle } from '@/components/video/VideoPlayer';
import { CommentPanel } from '@/components/video/CommentPanel';
import { useToast } from '@/hooks/use-toast';
import { FilePreviewModal } from '@/components/ui/file-preview-modal';
import { ProjectEditModal } from './ProjectEditModal';
import { MoveVideoModal } from './MoveVideoModal';
import { VideoApprovalActions } from './VideoApprovalActions';
import { GenerateReviewLinkModal } from './GenerateReviewLinkModal';
import { ReviewActivityTab } from './ReviewActivityTab';

interface ProjectDetailSheetProps {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectDeleted?: () => void;
}

interface ProjectDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  budget: number | null;
  editor_rate: number | null;
  reference_links: string | null;
  client_id: string | null;
  agency_id: string;
  container_id: string | null;
  client_name?: string;
  editor_name?: string;
}

const STATUS_COLORS: Record<string, string> = {
  proposal: 'bg-amber-500/20 text-amber-500',
  backlog: 'bg-muted text-muted-foreground',
  in_progress: 'bg-primary/20 text-primary',
  review: 'bg-warning/20 text-warning',
  done: 'bg-accent/20 text-accent',
  paid: 'bg-emerald-500/20 text-emerald-500',
  archived: 'bg-slate-500/20 text-slate-500',
  cancelled: 'bg-destructive/20 text-destructive',
};

const STATUS_LABELS: Record<string, string> = {
  proposal: 'Proposal',
  backlog: 'Backlog',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Delivered',
  paid: 'Paid',
  archived: 'Archived',
  cancelled: 'Cancelled',
};

export function ProjectDetailSheet({
  projectId,
  open,
  onOpenChange,
  onProjectDeleted,
}: ProjectDetailSheetProps) {
  const { user, userRole } = useAuth();
  const { fetchDeliverables, storageInfo, fetchStorageInfo } = useStorage();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assets');
  const [projectChannelId, setProjectChannelId] = useState<string | null>(null);
  
  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Move video modal state
  const [showMoveModal, setShowMoveModal] = useState(false);
  
  // Review link modal state
  const [showReviewLinkModal, setShowReviewLinkModal] = useState(false);
  
  // Image preview state
  const [previewImage, setPreviewImage] = useState<Deliverable | null>(null);
  
  // Video review state
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);
  const [selectedVideo, setSelectedVideo] = useState<Deliverable | null>(null);
  const [currentTimestamp, setCurrentTimestamp] = useState<number | null>(null);

  // Comments for selected video
  const {
    comments,
    unresolvedComments,
    resolvedComments,
    addComment,
    resolveComment,
    unresolveComment,
  } = useVideoComments(selectedVideo?.id || null);

  // Fetch project details
  const fetchProject = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const { data: projectData, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;

      // Get client name
      let clientName: string | undefined;
      if (projectData.client_id) {
        const { data: clientProfile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', projectData.client_id)
          .maybeSingle();
        clientName = clientProfile?.full_name || clientProfile?.email;
      }

      // Get editor name
      let editorName: string | undefined;
      const { data: projectEditor } = await supabase
        .from('project_editors')
        .select('editor_id')
        .eq('project_id', projectId)
        .maybeSingle();

      if (projectEditor?.editor_id) {
        const { data: editorProfile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', projectEditor.editor_id)
          .maybeSingle();
        editorName = editorProfile?.full_name || editorProfile?.email;
      }

      // Get project channel ID
      const { data: channelData } = await supabase
        .from('channels')
        .select('id')
        .eq('project_id', projectId)
        .eq('type', 'project')
        .maybeSingle();
      
      setProjectChannelId(channelData?.id || null);

      setProject({
        ...projectData,
        client_name: clientName,
        editor_name: editorName,
      });

      // Fetch deliverables
      const files = await fetchDeliverables(projectId);
      setDeliverables(files);

      // Fetch storage info
      await fetchStorageInfo();
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, fetchDeliverables, fetchStorageInfo]);

  useEffect(() => {
    if (open && projectId) {
      fetchProject();
      setSelectedVideo(null);
      setCurrentTimestamp(null);
    }
  }, [open, projectId, fetchProject]);

  // Permissions
  const canUploadDeliverables = userRole === 'admin' || userRole === 'editor';
  const canUploadAssets = userRole === 'admin' || userRole === 'editor' || (userRole === 'client' && project?.client_id === user?.id);
  const canDelete = userRole === 'admin' || userRole === 'editor';
  const canResolveComments = userRole === 'admin' || userRole === 'editor';
  const canEdit = userRole === 'admin';
  
  // Budget visibility: hide from editors, show to admin and project's client only
  const canSeeBudget = userRole === 'admin' || (userRole === 'client' && project?.client_id === user?.id);

  // Filter deliverables by type
  const assetFiles = deliverables.filter(d => d.file_type === 'asset');
  const deliverableFiles = deliverables.filter(d => d.file_type === 'deliverable');

  const handleViewVideo = (deliverable: Deliverable) => {
    setSelectedVideo(deliverable);
    setActiveTab('review');
    setCurrentTimestamp(0);
  };

  const handleAddComment = async (content: string) => {
    await addComment(content);
  };

  const handleBackFromVideo = () => {
    setSelectedVideo(null);
    setCurrentTimestamp(null);
  };

  // Pause video and capture timestamp for commenting
  const handlePauseForComment = useCallback(() => {
    if (videoPlayerRef.current) {
      // First get the current time BEFORE pausing (more accurate for iframe)
      const time = videoPlayerRef.current.getCurrentTime();
      // Then pause the video
      videoPlayerRef.current.pause();
      // Update the timestamp state - use the captured time
      // Only update if we got a valid time (> 0 means video has been played)
      if (time > 0 || currentTimestamp === null) {
        setCurrentTimestamp(time);
      }
    }
  }, [currentTimestamp]);

  // Handle seeking to a timestamp from the comment panel
  const handleSeekToTimestamp = useCallback((timestamp: number) => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.seekTo(timestamp);
      setCurrentTimestamp(timestamp);
    }
  }, []);

  // Handle time updates from the video player
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTimestamp(time);
  }, []);

  const handleOpenProjectChat = () => {
    onOpenChange(false);
    const basePath = userRole === 'admin' ? '/admin' : userRole === 'client' ? '/client' : '/editor';
    navigate(`${basePath}/messages?channel=${projectChannelId}`);
  };

  const handleDeleteProject = async () => {
    if (!projectId) return;

    setIsDeleting(true);
    try {
      // Step 1: Clean up Bunny assets (fail-safe - block if cleanup fails)
      const { data: assetResult, error: assetError } = await supabase.functions.invoke('delete-asset', {
        body: { action: 'delete_project_files', projectId },
      });

      if (assetError || assetResult?.error) {
        console.error('Asset cleanup failed:', assetError || assetResult?.error);
        toast({
          title: 'Cleanup failed',
          description: 'Could not remove files from storage. Project deletion blocked.',
          variant: 'destructive',
        });
        setIsDeleting(false);
        setShowDeleteDialog(false);
        return;
      }

      // Step 2: Delete the project from database
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: 'Project deleted',
        description: 'All files and data have been permanently removed.',
      });

      onOpenChange(false);
      onProjectDeleted?.();
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast({
        title: 'Delete failed',
        description: error.message || 'Could not delete the project',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleEditSuccess = () => {
    fetchProject();
    onProjectDeleted?.(); // Refresh parent list too
  };

  const isImageFile = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
  };

  // Parse reference links (newline separated)
  const referenceLinks = project?.reference_links
    ? project.reference_links.split('\n').filter(link => link.trim())
    : [];

  if (!project && !loading) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl p-0 flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        ) : project ? (
          <>
            {/* Header */}
            <SheetHeader className="p-6 border-b border-border">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {selectedVideo ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleBackFromVideo}
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                      <div>
                        <SheetTitle className="text-lg">{selectedVideo.file_name}</SheetTitle>
                        <p className="text-sm text-muted-foreground">
                          Version {selectedVideo.version}
                        </p>
                      </div>
                      {(userRole === 'admin' || userRole === 'editor') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowReviewLinkModal(true)}
                          className="ml-auto"
                        >
                          <Link2 className="w-4 h-4 mr-2" />
                          Share Review Link
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <SheetTitle className="text-xl">{project.title}</SheetTitle>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowEditModal(true)}
                            className="h-8 w-8"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={cn('text-xs', STATUS_COLORS[project.status])}>
                          {STATUS_LABELS[project.status] || project.status}
                        </Badge>
                        {project.due_date && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            Due {format(new Date(project.due_date), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {!selectedVideo && (
                <>
                  <div className="flex flex-wrap gap-4 mt-4 text-sm">
                    {project.client_name && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span>Client: <span className="text-foreground">{project.client_name}</span></span>
                      </div>
                    )}
                    {project.editor_name && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>Editor: <span className="text-foreground">{project.editor_name}</span></span>
                      </div>
                    )}
                    {/* Budget - only visible to admin and client */}
                    {canSeeBudget && project.budget && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <DollarSign className="w-4 h-4" />
                        <span>Budget: <span className="text-foreground">${project.budget.toLocaleString()}</span></span>
                      </div>
                    )}
                    {projectChannelId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenProjectChat}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Open Project Chat
                      </Button>
                    )}
                    {userRole === 'admin' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowMoveModal(true)}
                        >
                          <ArrowRightLeft className="w-4 h-4 mr-2" />
                          Move Video
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowDeleteDialog(true)}
                          className="ml-auto text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Project
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Reference Links */}
                  {referenceLinks.length > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-2 text-sm font-medium mb-2">
                        <LinkIcon className="w-4 h-4" />
                        Reference Links
                      </div>
                      <div className="space-y-1">
                        {referenceLinks.map((link, index) => (
                          <a
                            key={index}
                            href={link.startsWith('http') ? link : `https://${link}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-primary hover:underline truncate"
                          >
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{link}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Video Approval Actions for Clients */}
                  {userRole === 'client' && project.client_id === user?.id && (
                    <VideoApprovalActions
                      projectId={project.id}
                      projectTitle={project.title}
                      status={project.status}
                      onStatusChange={fetchProject}
                    />
                  )}
                </>
              )}

              {/* Storage usage for admin */}
              {!selectedVideo && userRole === 'admin' && storageInfo && (
                <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Agency Storage</span>
                    <span className="font-medium">
                      {storageInfo.storageUsedPercentage.toFixed(1)}% used
                    </span>
                  </div>
                  <Progress value={storageInfo.storageUsedPercentage} className="h-2" />
                </div>
              )}
            </SheetHeader>

            {/* Content */}
            {selectedVideo ? (
              // Video review mode — stacks vertically on mobile, side-by-side on desktop
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Video player */}
                <div className="w-full md:flex-1 flex flex-col bg-black min-h-[200px] md:min-h-0" style={{ maxHeight: 'clamp(200px, 40vh, 50vh)' }}>
                  <VideoPlayer
                    ref={videoPlayerRef}
                    src={selectedVideo.file_url}
                    deliverableId={selectedVideo.id}
                    comments={comments}
                    onTimeUpdate={handleTimeUpdate}
                    onSeekToComment={handleSeekToTimestamp}
                    onAddComment={(timestamp) => setCurrentTimestamp(timestamp)}
                    onPause={() => {}}
                    className="flex-1"
                  />
                </div>

                {/* Comment panel */}
                <div className="flex-1 md:flex-none md:w-80 border-t md:border-t-0 md:border-l border-border bg-background overflow-hidden">
                  <CommentPanel
                    comments={comments}
                    unresolvedComments={unresolvedComments}
                    resolvedComments={resolvedComments}
                    canResolve={canResolveComments}
                    onAddComment={handleAddComment}
                    onResolveComment={resolveComment}
                    onUnresolveComment={unresolveComment}
                    className="h-full"
                  />
                </div>
              </div>
            ) : (
              // File management mode
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="mx-6 mt-4 w-auto">
                  <TabsTrigger value="assets" className="gap-2">
                    <Package className="w-4 h-4" />
                    Assets ({assetFiles.length})
                  </TabsTrigger>
                  <TabsTrigger value="files" className="gap-2">
                    <FolderOpen className="w-4 h-4" />
                    Deliverables ({deliverableFiles.length})
                  </TabsTrigger>
                  <TabsTrigger value="review" className="gap-2">
                    <Video className="w-4 h-4" />
                    Review
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Activity
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="assets" className="flex-1 overflow-hidden m-0">
                  <FileManager
                    projectId={project.id}
                    deliverables={assetFiles}
                    canUpload={canUploadAssets}
                    canDelete={canDelete}
                    onFileUploaded={fetchProject}
                    onFileDeleted={fetchProject}
                    onViewVideo={handleViewVideo}
                    fileType="asset"
                    emptyTitle="No project assets"
                    emptyDescription="Upload raw footage, scripts, or reference materials"
                    uploadLabel="Upload raw assets"
                  />
                </TabsContent>

                <TabsContent value="files" className="flex-1 overflow-hidden m-0">
                  <FileManager
                    projectId={project.id}
                    deliverables={deliverableFiles}
                    canUpload={canUploadDeliverables}
                    canDelete={canDelete}
                    onFileUploaded={fetchProject}
                    onFileDeleted={fetchProject}
                    onViewVideo={handleViewVideo}
                    fileType="deliverable"
                    emptyTitle="No deliverables yet"
                    emptyDescription="Editors will upload finished versions here"
                    uploadLabel="Upload deliverable"
                  />
                </TabsContent>

                <TabsContent value="review" className="flex-1 overflow-hidden m-0">
                  <div className="p-6">
                    {deliverableFiles.filter(d => {
                      const ext = d.file_name.split('.').pop()?.toLowerCase();
                      return ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext || '');
                    }).length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Video className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm font-medium">No videos to review</p>
                        <p className="text-xs">Upload a video deliverable to start reviewing</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {deliverableFiles
                          .filter(d => {
                            const ext = d.file_name.split('.').pop()?.toLowerCase();
                            return ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext || '');
                          })
                          .map(video => (
                            <button
                              key={video.id}
                              onClick={() => handleViewVideo(video)}
                              className="p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors text-left"
                            >
                              <Video className="w-8 h-8 text-primary mb-2" />
                              <p className="font-medium text-sm truncate">{video.file_name}</p>
                              <p className="text-xs text-muted-foreground">
                                Version {video.version} • {video.uploader_name}
                              </p>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="flex-1 overflow-hidden m-0">
                  <ReviewActivityTab projectId={project.id} />
                </TabsContent>
              </Tabs>
            )}
          </>
        ) : null}
      </SheetContent>

      {/* Delete Project Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{project?.title}" and all associated files. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Project'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Project Modal */}
      {project && (
        <ProjectEditModal
          project={project}
          open={showEditModal}
          onOpenChange={setShowEditModal}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Move Video Modal */}
      {project && (
        <MoveVideoModal
          open={showMoveModal}
          onOpenChange={setShowMoveModal}
          videoId={project.id}
          videoTitle={project.title}
          currentContainerId={project.container_id}
          onSuccess={() => {
            fetchProject();
            onProjectDeleted?.();
          }}
        />
      )}

      {/* Review Link Modal */}
      {selectedVideo && (
        <GenerateReviewLinkModal
          open={showReviewLinkModal}
          onOpenChange={setShowReviewLinkModal}
          deliverableId={selectedVideo.id}
          deliverableName={selectedVideo.file_name}
        />
      )}
    </Sheet>
  );
}
