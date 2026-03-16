import { useState, useEffect, useCallback, useRef, DragEvent } from 'react';
import { isDefinitelyBunnyStreamUrl } from '@/lib/bunnyStream';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FilePreviewModal } from '@/components/ui/file-preview-modal';
import { useToast } from '@/hooks/use-toast';
import {
  FolderOpen,
  File,
  Video,
  Image,
  FileText,
  Download,
  Trash2,
  Search,
  HardDrive,
  Loader2,
  ChevronRight,
  Eye,
  CheckSquare,
  X,
  Upload,
  CloudUpload,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { useStorage } from '@/hooks/useStorage';
import { useUploadContext } from '@/contexts/UploadContext';
import { useDownloadContext } from '@/contexts/DownloadContext';

interface StorageFile {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  project_id: string;
  project_title: string;
  client_name: string;
  client_id: string;
  uploaded_by: string;
  uploader_name: string;
  created_at: string;
}

interface GroupedFiles {
  [clientName: string]: {
    clientId: string;
    projects: {
      [projectTitle: string]: {
        projectId: string;
        files: StorageFile[];
      };
    };
  };
}

const StoragePage = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    formatBytes, 
    deleteDeliverable, 
    renameDeliverable, 
  } = useStorage();
  
  const { addToQueue, queue } = useUploadContext();
  const { startDownload } = useDownloadContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  
  // Admin tools state
  const [orphanData, setOrphanData] = useState<{
    storageFiles: any[]; 
    streamVideos: any[]; 
    totalSize: number 
  } | null>(null);
  const [scanningOrphans, setScanningOrphans] = useState(false);
  const [deletingOrphans, setDeletingOrphans] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  
  // Preview modal state
  const [previewFile, setPreviewFile] = useState<StorageFile | null>(null);
  
  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<StorageFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Bulk selection state
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [availableProjects, setAvailableProjects] = useState<{ id: string; title: string }[]>([]);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
  }, [user, loading, navigate]);

  // Fetch storage files with React Query for caching
  const fetchStorageData = useCallback(async () => {
    if (!user || !userRole) return null;

    // Get user's agency
    const { data: userRoleData } = await supabase
      .from('user_roles')
      .select('agency_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!userRoleData?.agency_id) return null;

    const agencyId = userRoleData.agency_id;

    // Build query based on role
    let deliverableQuery = supabase
      .from('deliverables')
      .select(`
        id,
        file_name,
        file_url,
        file_size,
        project_id,
        uploaded_by,
        created_at,
        project:projects!inner(
          id,
          title,
          client_id,
          agency_id
        )
      `)
      .order('created_at', { ascending: false });

    if (userRole === 'admin') {
      deliverableQuery = deliverableQuery.eq('project.agency_id', agencyId);
    } else if (userRole === 'client') {
      deliverableQuery = deliverableQuery.eq('project.client_id', user.id);
    } else if (userRole === 'editor') {
      const { data: assignments } = await supabase
        .from('project_editors')
        .select('project_id')
        .eq('editor_id', user.id);

      const projectIds = assignments?.map(a => a.project_id) || [];
      if (projectIds.length === 0) return { files: [], groupedFiles: {}, storageInfo: null };
      deliverableQuery = deliverableQuery.in('project_id', projectIds);
    }

    const { data: deliverables, error } = await deliverableQuery;
    if (error) throw error;

    // Batch-fetch all unique profile IDs in one query
    const allDeliverables = deliverables || [];
    const profileIds = new Set<string>();
    for (const d of allDeliverables) {
      if ((d as any).project?.client_id) profileIds.add((d as any).project.client_id);
      if (d.uploaded_by) profileIds.add(d.uploaded_by);
    }

    const profileMap = new Map<string, { full_name: string | null; email: string }>();
    if (profileIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', Array.from(profileIds));
      for (const p of profiles || []) {
        profileMap.set(p.id, { full_name: p.full_name, email: p.email });
      }
    }

    const enrichedFiles: StorageFile[] = allDeliverables.map((d: any) => {
      const clientProfile = d.project?.client_id ? profileMap.get(d.project.client_id) : null;
      const uploaderProfile = profileMap.get(d.uploaded_by);
      return {
        id: d.id,
        file_name: d.file_name,
        file_url: d.file_url,
        file_size: d.file_size || 0,
        project_id: d.project_id,
        project_title: d.project?.title || 'Unknown Project',
        client_name: clientProfile?.full_name || clientProfile?.email || 'Unknown Client',
        client_id: d.project?.client_id || '',
        uploaded_by: d.uploaded_by,
        uploader_name: uploaderProfile?.full_name || uploaderProfile?.email || 'Unknown',
        created_at: d.created_at,
      };
    });

    // Always use DB values for storage info (accurate, fast)
    const { data: agencyData } = await supabase
      .from('agencies')
      .select('storage_used_bytes, storage_limit_bytes, subscription_plan')
      .eq('id', agencyId)
      .single();

    const storageInfo = agencyData ? {
      used: agencyData.storage_used_bytes,
      limit: agencyData.storage_limit_bytes,
      plan: agencyData.subscription_plan,
    } : null;

    // Group files by client > project
    const grouped: GroupedFiles = {};
    enrichedFiles.forEach(file => {
      if (!grouped[file.client_name]) {
        grouped[file.client_name] = { clientId: file.client_id, projects: {} };
      }
      if (!grouped[file.client_name].projects[file.project_title]) {
        grouped[file.client_name].projects[file.project_title] = { projectId: file.project_id, files: [] };
      }
      grouped[file.client_name].projects[file.project_title].files.push(file);
    });

    return { files: enrichedFiles, groupedFiles: grouped, storageInfo };
  }, [user, userRole]);

  const { data: storageData, isLoading: loadingFiles, refetch: refetchFiles } = useQuery({
    queryKey: ['storage-files', user?.id, userRole],
    queryFn: fetchStorageData,
    enabled: !!user && !!userRole,
    staleTime: 5 * 60 * 1000, // 5 minutes - don't refetch on every navigation
  });

  const files = storageData?.files || [];
  const groupedFiles = storageData?.groupedFiles || {};
  const storageInfo = storageData?.storageInfo || null;

  // Backwards-compat wrapper for existing code that calls fetchFiles
  const fetchFiles = useCallback(() => { refetchFiles(); }, [refetchFiles]);

  useEffect(() => {
    // No-op: React Query handles initial fetch
  }, [user, userRole, fetchFiles]);

  // Fetch available projects for upload
  const fetchProjects = useCallback(async () => {
    if (!user || !userRole) return;

    try {
      const { data: userRoleData } = await supabase
        .from('user_roles')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRoleData?.agency_id) return;

      let projectQuery = supabase
        .from('projects')
        .select('id, title')
        .eq('agency_id', userRoleData.agency_id)
        .order('title', { ascending: true });

      if (userRole === 'editor') {
        const { data: assignments } = await supabase
          .from('project_editors')
          .select('project_id')
          .eq('editor_id', user.id);

        const projectIds = assignments?.map(a => a.project_id) || [];
        if (projectIds.length === 0) {
          setAvailableProjects([]);
          return;
        }
        projectQuery = projectQuery.in('id', projectIds);
      } else if (userRole === 'client') {
        projectQuery = projectQuery.eq('client_id', user.id);
      }

      const { data: projects } = await projectQuery;
      setAvailableProjects(projects || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  }, [user, userRole]);

  useEffect(() => {
    if (user && userRole) {
      fetchProjects();
    }
  }, [user, userRole, fetchProjects]);

  // Drag and drop handlers
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const droppedItems = e.dataTransfer.files;
    if (droppedItems && droppedItems.length > 0) {
      const filesArray = Array.from(droppedItems);
      setDroppedFiles(filesArray);
      setShowProjectSelector(true);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedItems = e.target.files;
    if (selectedItems && selectedItems.length > 0) {
      const filesArray = Array.from(selectedItems);
      setDroppedFiles(filesArray);
      setShowProjectSelector(true);
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddToQueue = () => {
    if (!selectedProjectId || droppedFiles.length === 0) {
      toast({
        title: 'Missing project',
        description: 'Please select a project to upload files to.',
        variant: 'destructive',
      });
      return;
    }

    const projectTitle = availableProjects.find(p => p.id === selectedProjectId)?.title;
    addToQueue(droppedFiles, selectedProjectId, projectTitle);
    
    setShowProjectSelector(false);
    setDroppedFiles([]);
    setSelectedProjectId('');
  };

  const cancelUploadDialog = () => {
    setShowProjectSelector(false);
    setDroppedFiles([]);
    setSelectedProjectId('');
  };

  // Admin tools: Scan for orphans
  const handleScanOrphans = async () => {
    setScanningOrphans(true);
    try {
      const { data, error } = await supabase.functions.invoke('storage-ops', {
        body: { action: 'list_orphans' },
      });

      if (error || !data?.ok) {
        throw new Error(error?.message || data?.error || 'Scan failed');
      }

      setOrphanData({
        storageFiles: data.orphanStorageFiles || [],
        streamVideos: data.orphanStreamVideos || [],
        totalSize: data.totalOrphanSize || 0,
      });

      toast({
        title: 'Scan complete',
        description: `Found ${data.totalOrphanCount || 0} orphan file(s)`,
      });
    } catch (err: any) {
      console.error('Orphan scan error:', err);
      toast({
        title: 'Scan failed',
        description: err.message || 'Could not scan for orphan files',
        variant: 'destructive',
      });
    } finally {
      setScanningOrphans(false);
    }
  };

  // Admin tools: Delete orphans
  const handleDeleteOrphans = async () => {
    if (!orphanData) return;

    setDeletingOrphans(true);
    try {
      const storagePaths = orphanData.storageFiles.map((f) => f.path);
      const streamVideoIds = orphanData.streamVideos.map((v) => v.id);

      const { data, error } = await supabase.functions.invoke('storage-ops', {
        body: { action: 'delete_orphans', storagePaths, streamVideoIds },
      });

      if (error || !data?.ok) {
        throw new Error(error?.message || data?.error || 'Delete failed');
      }

      setOrphanData(null);
      toast({
        title: 'Orphans deleted',
        description: `Deleted ${data.totalDeleted || 0} orphan file(s)`,
      });

      // Refresh storage info
      fetchFiles();
    } catch (err: any) {
      console.error('Delete orphans error:', err);
      toast({
        title: 'Delete failed',
        description: err.message || 'Could not delete orphan files',
        variant: 'destructive',
      });
    } finally {
      setDeletingOrphans(false);
    }
  };

  // Admin tools: Recalculate storage
  const handleRecalculateStorage = async () => {
    setRecalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('storage-ops', {
        body: { action: 'recalculate' },
      });

      if (error || !data?.ok) {
        throw new Error(error?.message || data?.error || 'Recalculate failed');
      }

      toast({
        title: 'Storage recalculated',
        description: 'Storage counters have been synced with actual usage',
      });

      // Refresh storage info
      fetchFiles();
    } catch (err: any) {
      console.error('Recalculate error:', err);
      toast({
        title: 'Recalculate failed',
        description: err.message || 'Could not recalculate storage',
        variant: 'destructive',
      });
    } finally {
      setRecalculating(false);
    }
  };

  // Refetch files when uploads complete
  useEffect(() => {
    const completedCount = queue.filter(q => q.status === 'completed').length;
    if (completedCount > 0) {
      fetchFiles();
    }
  }, [queue, fetchFiles]);

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext || '')) {
      return <Video className="w-5 h-5 text-primary" />;
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
      return <Image className="w-5 h-5 text-success" />;
    }
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) {
      return <FileText className="w-5 h-5 text-warning" />;
    }
    return <File className="w-5 h-5 text-muted-foreground" />;
  };


  const handleDownload = (file: StorageFile) => {
    startDownload(file.id, file.file_name, file.file_url, file.file_size || undefined);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    const success = await deleteDeliverable({
      id: deleteTarget.id,
      project_id: deleteTarget.project_id,
      file_name: deleteTarget.file_name,
      file_url: deleteTarget.file_url,
      file_size: deleteTarget.file_size,
      version: null,
      uploaded_by: deleteTarget.uploaded_by,
      created_at: deleteTarget.created_at,
      file_type: (deleteTarget as any).file_type || 'deliverable',
    });
    setIsDeleting(false);
    setDeleteTarget(null);

    if (success) {
      fetchFiles();
    }
  };

  const handleRename = async (newName: string): Promise<boolean> => {
    if (!previewFile) return false;

    const success = await renameDeliverable(previewFile.id, newName);
    if (success) {
      // Refetch to ensure the change actually persisted
      await fetchFiles();
      setPreviewFile(prev => (prev ? { ...prev, file_name: newName } : null));
    }
    return success;
  };

  const toggleClient = (clientName: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientName)) {
        next.delete(clientName);
      } else {
        next.add(clientName);
      }
      return next;
    });
  };

  const toggleProject = (projectKey: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectKey)) {
        next.delete(projectKey);
      } else {
        next.add(projectKey);
      }
      return next;
    });
  };

  const filteredFiles = files.filter(file =>
    file.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.project_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.client_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canDelete = userRole === 'admin' || userRole === 'editor';
  const canRename = userRole === 'admin' || userRole === 'editor';

  // Bulk selection functions
  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const selectAllFiles = () => {
    const allFileIds = (searchQuery ? filteredFiles : files).map(f => f.id);
    setSelectedFiles(new Set(allFileIds));
  };

  const clearSelection = () => {
    setSelectedFiles(new Set());
  };

  const handleBulkDownload = async () => {
    if (selectedFiles.size === 0) return;
    
    setIsBulkDownloading(true);
    const selectedFilesArray = files.filter(f => selectedFiles.has(f.id));
    
    for (const file of selectedFilesArray) {
      try {
        const urlParts = file.file_url.split('/deliverables/');
        if (urlParts.length >= 2) {
          const filePath = decodeURIComponent(urlParts[1].split('?')[0]);
          const { data, error } = await supabase.storage
            .from('deliverables')
            .download(filePath);

          if (error) {
            console.error('Download error for', file.file_name, error);
            continue;
          }

          const url = URL.createObjectURL(data);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.file_name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          // Small delay between downloads to prevent browser issues
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        console.error('Download error for', file.file_name, error);
      }
    }
    
    setIsBulkDownloading(false);
    toast({
      title: 'Download complete',
      description: `Downloaded ${selectedFilesArray.length} file(s)`,
    });
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.size === 0) return;
    
    setIsBulkDeleting(true);
    const selectedFilesArray = files.filter(f => selectedFiles.has(f.id));
    let successCount = 0;
    
    for (const file of selectedFilesArray) {
      const success = await deleteDeliverable({
        id: file.id,
        project_id: file.project_id,
        file_name: file.file_name,
        file_url: file.file_url,
        file_size: file.file_size,
        version: null,
        uploaded_by: file.uploaded_by,
        created_at: file.created_at,
        file_type: (file as any).file_type || 'deliverable',
      });
      if (success) successCount++;
    }
    
    setIsBulkDeleting(false);
    setShowBulkDeleteConfirm(false);
    setSelectedFiles(new Set());
    
    toast({
      title: 'Files deleted',
      description: `Successfully deleted ${successCount} of ${selectedFilesArray.length} file(s)`,
    });
    
    fetchFiles();
  };

  const currentRole = userRole === 'admin' ? 'admin' : userRole === 'client' ? 'client' : 'editor';

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderFileActions = (file: StorageFile) => (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={() => setPreviewFile(file)} title="Preview">
        <Eye className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => handleDownload(file)} title="Download">
        <Download className="w-4 h-4" />
      </Button>
      {canDelete && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setDeleteTarget(file)}
          className="text-destructive hover:text-destructive"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );

  return (
    <DashboardLayout role={currentRole} hideHeader>
      <Helmet>
        <title>Storage | Veylodesk</title>
        <meta name="description" content="Manage your project files and storage." />
      </Helmet>

      <div 
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag and Drop Overlay */}
        {isDragging && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
            <div className="border-4 border-dashed border-primary rounded-3xl p-8 md:p-16 bg-primary/5 flex flex-col items-center gap-4 animate-pulse mx-4">
              <CloudUpload className="w-12 h-12 md:w-20 md:h-20 text-primary" />
              <p className="text-lg md:text-2xl font-semibold text-primary text-center">Drop files here to upload</p>
              <p className="text-muted-foreground text-center text-sm">Files will be uploaded after selecting a project</p>
            </div>
          </div>
        )}

        {loadingFiles ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
        <>
        <div>
          {/* Header */}
          <div className="flex flex-col gap-4 mb-6 md:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">Storage</h1>
                <p className="text-sm md:text-base text-muted-foreground">
                  {userRole === 'admin'
                    ? 'View and manage all files across the platform'
                    : 'View files from your projects'}
                </p>
              </div>
              
              {/* Upload Button - visible when projects available */}
              {(userRole === 'admin' || userRole === 'editor') && availableProjects.length > 0 && (
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto shrink-0"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Files
                </Button>
              )}
            </div>
            
            {/* Storage Usage Card - Stacked on mobile */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {storageInfo && (
                <div className="glass-card rounded-xl p-4 flex items-center gap-4 flex-1 lg:flex-none">
                  <HardDrive className="w-6 h-6 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">
                      Storage Used
                    </p>
                    <p className="text-base md:text-lg font-semibold text-foreground">
                      {formatBytes(storageInfo.used)} / {formatBytes(storageInfo.limit)}
                    </p>
                    <div className="w-full lg:w-40 h-2 bg-muted rounded-full mt-1">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min((storageInfo.used / storageInfo.limit) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Admin-only tools */}
              {userRole === 'admin' && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleScanOrphans}
                    disabled={scanningOrphans}
                  >
                    {scanningOrphans ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 mr-2" />
                    )}
                    Scan Orphans
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRecalculateStorage}
                    disabled={recalculating}
                  >
                    {recalculating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Recalculate
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Orphan Files Alert */}
          {orphanData && orphanData.storageFiles.length + orphanData.streamVideos.length > 0 && (
            <div className="mb-6 glass-card rounded-xl p-4 border border-warning/50 bg-warning/5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">
                      Found {orphanData.storageFiles.length + orphanData.streamVideos.length} orphan file(s)
                    </p>
                    <p className="text-sm text-muted-foreground">
                      These files exist on Bunny but have no database record. 
                      Size: {formatBytes(orphanData.totalSize)}
                    </p>
                    <div className="mt-2 text-xs text-muted-foreground space-y-1 max-h-24 overflow-y-auto">
                      {orphanData.storageFiles.slice(0, 5).map((f, i) => (
                        <div key={i}>📁 {f.path}</div>
                      ))}
                      {orphanData.streamVideos.slice(0, 5).map((v, i) => (
                        <div key={i}>🎬 {v.title || v.id}</div>
                      ))}
                      {orphanData.storageFiles.length + orphanData.streamVideos.length > 10 && (
                        <div>...and {orphanData.storageFiles.length + orphanData.streamVideos.length - 10} more</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOrphanData(null)}
                  >
                    Dismiss
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteOrphans}
                    disabled={deletingOrphans}
                  >
                    {deletingOrphans ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    Delete All
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Search and Actions Bar */}
          <div className="mb-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search files, projects, or clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-surface-elevated border-border/50"
              />
            </div>
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
            />
            
            {files.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={selectedFiles.size > 0 ? clearSelection : selectAllFiles}
                className="shrink-0"
              >
                {selectedFiles.size > 0 ? (
                  <>
                    <X className="w-4 h-4 mr-2" />
                    Clear ({selectedFiles.size})
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Select All
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Bulk Actions Bar */}
          {selectedFiles.size > 0 && (
            <div className="mb-6 glass-card rounded-xl p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-3">
                <CheckSquare className="w-5 h-5 text-primary shrink-0" />
                <span className="font-medium text-foreground text-sm md:text-base">
                  {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDownload}
                  disabled={isBulkDownloading}
                  className="flex-1 sm:flex-none"
                >
                  {isBulkDownloading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span className="hidden sm:inline">Downloading...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Download All</span>
                    </>
                  )}
                </Button>
                {canDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    disabled={isBulkDeleting}
                    className="flex-1 sm:flex-none"
                  >
                    <Trash2 className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Delete All</span>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* File Tree View */}
          {files.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No files yet</h3>
              <p className="text-muted-foreground">
                Files uploaded to projects will appear here.
              </p>
            </div>
          ) : searchQuery ? (
            // Search results - flat list
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border/50">
                <p className="text-sm text-muted-foreground">
                  {filteredFiles.length} result{filteredFiles.length !== 1 ? 's' : ''} for "{searchQuery}"
                </p>
              </div>
              <div className="divide-y divide-border/50">
                {filteredFiles.map(file => (
                  <div 
                    key={file.id} 
                    className={cn(
                      "flex items-center justify-between p-4 hover:bg-muted/30",
                      selectedFiles.has(file.id) && "bg-primary/10"
                    )}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Checkbox
                        checked={selectedFiles.has(file.id)}
                        onCheckedChange={() => toggleFileSelection(file.id)}
                        className="shrink-0"
                      />
                                      <div 
                                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                                        onClick={() => setPreviewFile(file)}
                                      >
                                        {getFileIcon(file.file_name)}
                                        <div className="min-w-0 flex-1">
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); setPreviewFile(file); }}
                                            className="font-medium text-foreground truncate hover:underline hover:text-primary flex items-center gap-1"
                                          >
                                            {file.file_name}
                                            <ExternalLink className="w-3 h-3 shrink-0" />
                                          </button>
                                          <p className="text-sm text-muted-foreground truncate">
                                            {file.client_name} / {file.project_title} • {formatBytes(file.file_size)}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                    {renderFileActions(file)}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Grouped tree view
            <div className="space-y-2">
              {Object.entries(groupedFiles).map(([clientName, clientData]) => (
                <div key={clientName} className="glass-card rounded-xl overflow-hidden">
                  {/* Client Header */}
                  <button
                    onClick={() => toggleClient(clientName)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors"
                  >
                    <ChevronRight
                      className={cn(
                        'w-4 h-4 text-muted-foreground transition-transform',
                        expandedClients.has(clientName) && 'rotate-90'
                      )}
                    />
                    <FolderOpen className="w-5 h-5 text-primary" />
                    <span className="font-medium text-foreground">{clientName}</span>
                    <span className="text-sm text-muted-foreground ml-auto">
                      {Object.keys(clientData.projects).length} project{Object.keys(clientData.projects).length !== 1 ? 's' : ''}
                    </span>
                  </button>

                  {/* Projects */}
                  {expandedClients.has(clientName) && (
                    <div className="border-t border-border/50">
                      {Object.entries(clientData.projects).map(([projectTitle, projectData]) => {
                        const projectKey = `${clientName}-${projectTitle}`;
                        return (
                          <div key={projectKey}>
                            <button
                              onClick={() => toggleProject(projectKey)}
                              className="w-full flex items-center gap-3 p-4 pl-10 hover:bg-muted/30 transition-colors"
                            >
                              <ChevronRight
                                className={cn(
                                  'w-4 h-4 text-muted-foreground transition-transform',
                                  expandedProjects.has(projectKey) && 'rotate-90'
                                )}
                              />
                              <FolderOpen className="w-5 h-5 text-warning" />
                              <span className="text-foreground">{projectTitle}</span>
                              <span className="text-sm text-muted-foreground ml-auto">
                                {projectData.files.length} file{projectData.files.length !== 1 ? 's' : ''}
                              </span>
                            </button>

                            {/* Files */}
                            {expandedProjects.has(projectKey) && (
                              <div className="border-t border-border/30 bg-muted/10">
                                {projectData.files.map(file => (
                                  <div
                                    key={file.id}
                                    className={cn(
                                      "flex items-center justify-between p-4 pl-12 hover:bg-muted/20",
                                      selectedFiles.has(file.id) && "bg-primary/10"
                                    )}
                                  >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <Checkbox
                                        checked={selectedFiles.has(file.id)}
                                        onCheckedChange={() => toggleFileSelection(file.id)}
                                        className="shrink-0"
                                      />
                                      <div 
                                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                                        onClick={() => setPreviewFile(file)}
                                      >
                                        {getFileIcon(file.file_name)}
                                        <div className="min-w-0 flex-1">
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); setPreviewFile(file); }}
                                            className="text-sm font-medium text-foreground truncate hover:underline hover:text-primary flex items-center gap-1"
                                          >
                                            {file.file_name}
                                            <ExternalLink className="w-3 h-3 shrink-0" />
                                          </button>
                                          <p className="text-xs text-muted-foreground">
                                            {formatBytes(file.file_size)} • Uploaded by {file.uploader_name}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                    {renderFileActions(file)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        </>
        )}

      </div>

      {/* File Preview Modal */}
      <FilePreviewModal
        open={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
        file={previewFile}
        onDownload={() => previewFile && handleDownload(previewFile)}
        onRename={canRename ? handleRename : undefined}
        canRename={canRename}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.file_name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedFiles.size} selected file{selectedFiles.size !== 1 ? 's' : ''}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isBulkDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete All'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Project Selector Dialog for Upload */}
      <Dialog open={showProjectSelector} onOpenChange={(open) => !open && cancelUploadDialog()}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="text-lg font-semibold">Upload Files</DialogTitle>
              <DialogDescription className="text-sm">
                Choose a project and review your {droppedFiles.length} file{droppedFiles.length !== 1 ? 's' : ''} before uploading.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 space-y-5 pb-2">
            {/* Project selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Project</label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="h-11 rounded-xl bg-muted/40 border-border/60 focus:ring-primary/30">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {availableProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Drop zone for adding more files */}
            <div
              className="relative rounded-xl border-2 border-dashed border-border/60 hover:border-primary/50 transition-colors cursor-pointer group"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) setDroppedFiles(prev => [...prev, ...files]);
              }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.onchange = (e) => {
                  const files = Array.from((e.target as HTMLInputElement).files || []);
                  if (files.length > 0) setDroppedFiles(prev => [...prev, ...files]);
                };
                input.click();
              }}
            >
              <div className="flex flex-col items-center justify-center py-5 gap-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <CloudUpload className="w-5 h-5 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Drop files here or <span className="text-primary font-medium">browse</span>
                </p>
              </div>
            </div>

            {/* File list with thumbnails */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Files ({droppedFiles.length})
                </label>
                {droppedFiles.length > 1 && (
                  <button
                    onClick={() => setDroppedFiles([])}
                    className="text-[11px] text-destructive/70 hover:text-destructive transition-colors font-medium"
                  >
                    Remove all
                  </button>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-border/50 p-2 bg-muted/20">
                {droppedFiles.map((file, index) => {
                  const ext = file.name.split('.').pop()?.toLowerCase() || '';
                  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
                  const isVideo = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'flv', 'wmv'].includes(ext);
                  const isDoc = ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);

                  return (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-3 p-2 rounded-lg bg-background/60 hover:bg-background transition-colors group/item"
                    >
                      {/* Thumbnail */}
                      <div className="h-10 w-10 rounded-lg bg-muted/60 flex items-center justify-center overflow-hidden shrink-0">
                        {isImage ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="h-full w-full object-cover rounded-lg"
                            onLoad={(e) => {
                              // Revoke object URL after loading to free memory
                              // (only revoke when component unmounts or files change, skip for simplicity)
                            }}
                          />
                        ) : isVideo ? (
                          <Video className="w-4.5 h-4.5 text-primary" />
                        ) : isDoc ? (
                          <FileText className="w-4.5 h-4.5 text-amber-500" />
                        ) : (
                          <File className="w-4.5 h-4.5 text-muted-foreground" />
                        )}
                      </div>

                      {/* Name & size */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate leading-tight">
                          {file.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatBytes(file.size)}
                          {isImage && ' · Image'}
                          {isVideo && ' · Video'}
                          {isDoc && ' · Document'}
                        </p>
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDroppedFiles(prev => prev.filter((_, i) => i !== index));
                        }}
                        className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover/item:opacity-100 transition-all shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20">
            <p className="text-xs text-muted-foreground">
              Total: {formatBytes(droppedFiles.reduce((sum, f) => sum + f.size, 0))}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-lg" onClick={cancelUploadDialog}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="rounded-lg"
                onClick={handleAddToQueue}
                disabled={!selectedProjectId || droppedFiles.length === 0}
              >
                <Upload className="w-4 h-4 mr-1.5" />
                Add to Queue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default StoragePage;
