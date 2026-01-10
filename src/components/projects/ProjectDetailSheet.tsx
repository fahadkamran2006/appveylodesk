import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
  MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStorage, Deliverable } from '@/hooks/useStorage';
import { useVideoComments } from '@/hooks/useVideoComments';
import { FileManager } from './FileManager';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { CommentPanel } from '@/components/video/CommentPanel';

interface ProjectDetailSheetProps {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProjectDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  budget: number | null;
  editor_rate: number | null;
  client_name?: string;
  editor_name?: string;
}

const STATUS_COLORS: Record<string, string> = {
  backlog: 'bg-muted text-muted-foreground',
  in_progress: 'bg-primary/20 text-primary',
  review: 'bg-warning/20 text-warning',
  done: 'bg-accent/20 text-accent',
};

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Delivered',
};

export function ProjectDetailSheet({
  projectId,
  open,
  onOpenChange,
}: ProjectDetailSheetProps) {
  const { user, userRole } = useAuth();
  const { fetchDeliverables, storageInfo, fetchStorageInfo } = useStorage();
  const navigate = useNavigate();
  
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('files');
  const [projectChannelId, setProjectChannelId] = useState<string | null>(null);
  
  // Video review state
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
    formatTimestamp,
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
  const canUpload = userRole === 'admin' || userRole === 'editor' || userRole === 'client';
  const canDelete = userRole === 'admin' || userRole === 'editor';
  const canResolveComments = userRole === 'admin' || userRole === 'editor';

  const handleViewVideo = (deliverable: Deliverable) => {
    setSelectedVideo(deliverable);
    setActiveTab('review');
    setCurrentTimestamp(null);
  };

  const handleAddComment = async (content: string) => {
    if (currentTimestamp !== null) {
      await addComment(currentTimestamp, content);
    }
  };

  const handleBackFromVideo = () => {
    setSelectedVideo(null);
    setCurrentTimestamp(null);
  };

  const handleOpenProjectChat = () => {
    onOpenChange(false);
    // Navigate to messages page - the channel will be selected there
    const basePath = userRole === 'admin' ? '/admin' : userRole === 'client' ? '/client' : '/editor';
    navigate(`${basePath}/messages?channel=${projectChannelId}`);
  };

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
                    </div>
                  ) : (
                    <>
                      <SheetTitle className="text-xl">{project.title}</SheetTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={cn('text-xs', STATUS_COLORS[project.status])}>
                          {STATUS_LABELS[project.status]}
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
                  {project.budget && userRole === 'admin' && (
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
                      className="ml-auto"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Open Project Chat
                    </Button>
                  )}
                </div>
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
              // Video review mode
              <div className="flex-1 flex overflow-hidden">
                {/* Video player */}
                <div className="flex-1 flex flex-col bg-black">
                  <VideoPlayer
                    src={selectedVideo.file_url}
                    comments={comments}
                    onTimeUpdate={setCurrentTimestamp}
                    onSeekToComment={setCurrentTimestamp}
                    onAddComment={(timestamp) => setCurrentTimestamp(timestamp)}
                    className="flex-1"
                  />
                </div>

                {/* Comment panel */}
                <div className="w-80 border-l border-border bg-background">
                  <CommentPanel
                    comments={comments}
                    unresolvedComments={unresolvedComments}
                    resolvedComments={resolvedComments}
                    currentTimestamp={currentTimestamp}
                    canResolve={canResolveComments}
                    formatTimestamp={formatTimestamp}
                    onAddComment={handleAddComment}
                    onResolveComment={resolveComment}
                    onUnresolveComment={unresolveComment}
                    onSeekToTimestamp={setCurrentTimestamp}
                  />
                </div>
              </div>
            ) : (
              // File management mode
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="mx-6 mt-4 w-auto">
                  <TabsTrigger value="files" className="gap-2">
                    <FolderOpen className="w-4 h-4" />
                    Files ({deliverables.length})
                  </TabsTrigger>
                  <TabsTrigger value="review" className="gap-2">
                    <Video className="w-4 h-4" />
                    Review
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="files" className="flex-1 overflow-hidden m-0">
                  <FileManager
                    projectId={project.id}
                    deliverables={deliverables}
                    canUpload={canUpload}
                    canDelete={canDelete}
                    onFileUploaded={fetchProject}
                    onFileDeleted={fetchProject}
                    onViewVideo={handleViewVideo}
                  />
                </TabsContent>

                <TabsContent value="review" className="flex-1 overflow-hidden m-0">
                  <div className="p-6">
                    {deliverables.filter(d => {
                      const ext = d.file_name.split('.').pop()?.toLowerCase();
                      return ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext || '');
                    }).length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Video className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm font-medium">No videos to review</p>
                        <p className="text-xs">Upload a video file to start reviewing</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {deliverables
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
              </Tabs>
            )}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
