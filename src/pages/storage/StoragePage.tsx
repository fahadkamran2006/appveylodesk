import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppSidebar } from '@/components/AppSidebar';
import { ClientSidebar } from '@/components/client/ClientSidebar';
import { EditorSidebar } from '@/components/editor/EditorSidebar';
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
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const { formatBytes, deleteDeliverable, renameDeliverable } = useStorage();

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
      // Update local state
      setFiles(prev => prev.map(f => 
        f.id === previewFile.id ? { ...f, file_name: newName } : f
      ));
      setPreviewFile(prev => prev ? { ...prev, file_name: newName } : null);
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

      <div className="min-h-screen bg-background flex">
        {userRole === 'admin' ? (
          <AppSidebar role="admin" />
        ) : userRole === 'client' ? (
          <ClientSidebar />
        ) : (
          <EditorSidebar />
        )}

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

          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search files, projects, or clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-surface-elevated border-border/50"
              />
            </div>
          </div>

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
                  <div key={file.id} className="flex items-center justify-between p-4 hover:bg-muted/30">
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
                                    className="flex items-center justify-between p-4 pl-16 hover:bg-muted/20"
                                  >
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
    </>
  );
};

export default StoragePage;
