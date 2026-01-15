import { useState, useEffect, useCallback, useRef, DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar';
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
  Square,
  X,
  Upload,
  CloudUpload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { useStorage } from '@/hooks/useStorage';

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
  const { formatBytes, deleteDeliverable, renameDeliverable, uploadDeliverable } = useStorage();

  const [files, setFiles] = useState<StorageFile[]>([]);
  const [groupedFiles, setGroupedFiles] = useState<GroupedFiles>({});
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [storageInfo, setStorageInfo] = useState<{ used: number; limit: number; plan: string } | null>(null);
  
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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
  }, [user, loading, navigate]);

  const fetchFiles = useCallback(async () => {
    if (!user || !userRole) return;

    setLoadingFiles(true);
    try {
      // Get user's agency
      const { data: userRoleData } = await supabase
        .from('user_roles')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRoleData?.agency_id) {
        setLoadingFiles(false);
        return;
      }

      // Fetch storage info for admin
      if (userRole === 'admin') {
        const { data: agencyData } = await supabase
          .from('agencies')
          .select('storage_used_bytes, storage_limit_bytes, subscription_plan')
          .eq('id', userRoleData.agency_id)
          .single();

        if (agencyData) {
          setStorageInfo({
            used: agencyData.storage_used_bytes,
            limit: agencyData.storage_limit_bytes,
            plan: agencyData.subscription_plan,
          });
        }
      }

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
        deliverableQuery = deliverableQuery.eq('project.agency_id', userRoleData.agency_id);
      } else if (userRole === 'client') {
        deliverableQuery = deliverableQuery.eq('project.client_id', user.id);
      } else if (userRole === 'editor') {
        const { data: assignments } = await supabase
          .from('project_editors')
          .select('project_id')
          .eq('editor_id', user.id);

        const projectIds = assignments?.map(a => a.project_id) || [];
        if (projectIds.length === 0) {
          setFiles([]);
          setLoadingFiles(false);
          return;
        }
        deliverableQuery = deliverableQuery.in('project_id', projectIds);
      }

      const { data: deliverables, error } = await deliverableQuery;
      if (error) throw error;

      // Enrich with client and uploader names
      const enrichedFiles: StorageFile[] = await Promise.all(
        (deliverables || []).map(async (d: any) => {
          let clientName = 'Unknown Client';
          let uploaderName = 'Unknown';

          if (d.project?.client_id) {
            const { data: clientProfile } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', d.project.client_id)
              .maybeSingle();
            clientName = clientProfile?.full_name || clientProfile?.email || 'Unknown Client';
          }

          const { data: uploaderProfile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', d.uploaded_by)
            .maybeSingle();
          uploaderName = uploaderProfile?.full_name || uploaderProfile?.email || 'Unknown';

          return {
            id: d.id,
            file_name: d.file_name,
            file_url: d.file_url,
            file_size: d.file_size || 0,
            project_id: d.project_id,
            project_title: d.project?.title || 'Unknown Project',
            client_name: clientName,
            client_id: d.project?.client_id || '',
            uploaded_by: d.uploaded_by,
            uploader_name: uploaderName,
            created_at: d.created_at,
          };
        })
      );

      setFiles(enrichedFiles);

      // Group files by client > project
      const grouped: GroupedFiles = {};
      enrichedFiles.forEach(file => {
        if (!grouped[file.client_name]) {
          grouped[file.client_name] = {
            clientId: file.client_id,
            projects: {},
          };
        }
        if (!grouped[file.client_name].projects[file.project_title]) {
          grouped[file.client_name].projects[file.project_title] = {
            projectId: file.project_id,
            files: [],
          };
        }
        grouped[file.client_name].projects[file.project_title].files.push(file);
      });
      setGroupedFiles(grouped);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast({
        title: 'Error',
        description: 'Failed to load files',
        variant: 'destructive',
      });
    } finally {
      setLoadingFiles(false);
    }
  }, [user, userRole, toast]);

  useEffect(() => {
    if (user && userRole) {
      fetchFiles();
    }
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

  const handleUploadFiles = async () => {
    if (!selectedProjectId || droppedFiles.length === 0) {
      toast({
        title: 'Missing project',
        description: 'Please select a project to upload files to.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    let successCount = 0;
    for (let i = 0; i < droppedFiles.length; i++) {
      const file = droppedFiles[i];
      const result = await uploadDeliverable(selectedProjectId, file);
      if (result) successCount++;
      setUploadProgress(Math.round(((i + 1) / droppedFiles.length) * 100));
    }

    setIsUploading(false);
    setShowProjectSelector(false);
    setDroppedFiles([]);
    setSelectedProjectId('');

    if (successCount > 0) {
      toast({
        title: 'Upload complete',
        description: `Successfully uploaded ${successCount} of ${droppedFiles.length} file(s)`,
      });
      fetchFiles();
    }
  };

  const cancelUpload = () => {
    setShowProjectSelector(false);
    setDroppedFiles([]);
    setSelectedProjectId('');
  };

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

  const handleDownload = async (file: StorageFile) => {
    try {
      const urlParts = file.file_url.split('/deliverables/');
      if (urlParts.length < 2) {
        window.open(file.file_url, '_blank');
        return;
      }

      const filePath = decodeURIComponent(urlParts[1]);
      const { data, error } = await supabase.storage
        .from('deliverables')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download failed',
        description: 'Could not download the file',
        variant: 'destructive',
      });
    }
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

  if (loading || loadingFiles) {
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
    <>
      <Helmet>
        <title>Storage | Veylodesk</title>
        <meta name="description" content="Manage your project files and storage." />
      </Helmet>

      <div 
        className="min-h-screen bg-background flex relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag and Drop Overlay */}
        {isDragging && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
            <div className="border-4 border-dashed border-primary rounded-3xl p-16 bg-primary/5 flex flex-col items-center gap-4 animate-pulse">
              <CloudUpload className="w-20 h-20 text-primary" />
              <p className="text-2xl font-semibold text-primary">Drop files here to upload</p>
              <p className="text-muted-foreground">Files will be uploaded after selecting a project</p>
            </div>
          </div>
        )}

        <CollapsibleSidebar role={userRole === 'admin' ? 'admin' : userRole === 'client' ? 'client' : 'editor'} />

        <main className="flex-1 p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Storage</h1>
              <p className="text-muted-foreground">
                {userRole === 'admin'
                  ? 'View and manage all files across the platform'
                  : 'View files from your projects'}
              </p>
            </div>
            {storageInfo && userRole === 'admin' && (
              <div className="glass-card rounded-xl p-4 flex items-center gap-4">
                <HardDrive className="w-6 h-6 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Storage Used</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatBytes(storageInfo.used)} / {formatBytes(storageInfo.limit)}
                  </p>
                  <div className="w-40 h-2 bg-muted rounded-full mt-1">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min((storageInfo.used / storageInfo.limit) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Search and Upload */}
          <div className="mb-6 flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
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
            
            {/* Upload Button */}
            {(userRole === 'admin' || userRole === 'editor') && availableProjects.length > 0 && (
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Files
              </Button>
            )}
            
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
            <div className="mb-6 glass-card rounded-xl p-4 flex items-center justify-between border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-3">
                <CheckSquare className="w-5 h-5 text-primary" />
                <span className="font-medium text-foreground">
                  {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDownload}
                  disabled={isBulkDownloading}
                >
                  {isBulkDownloading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download All
                    </>
                  )}
                </Button>
                {canDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    disabled={isBulkDeleting}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete All
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
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{file.file_name}</p>
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
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium text-foreground truncate">{file.file_name}</p>
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
        </main>
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
      <Dialog open={showProjectSelector} onOpenChange={(open) => !open && cancelUpload()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>
              Select a project to upload {droppedFiles.length} file{droppedFiles.length !== 1 ? 's' : ''} to.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Project</label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
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
            
            {/* File list preview */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Files to upload</label>
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-border p-2 bg-muted/30">
                {droppedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <File className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="truncate text-foreground">{file.name}</span>
                    <span className="text-muted-foreground text-xs ml-auto shrink-0">
                      {formatBytes(file.size)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Upload progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Uploading...</span>
                  <span className="font-medium text-foreground">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={cancelUpload} disabled={isUploading}>
              Cancel
            </Button>
            <Button onClick={handleUploadFiles} disabled={!selectedProjectId || isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StoragePage;
