import { useEffect, useMemo, useState, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Folder, FolderPlus, Upload, Share2, ChevronRight, Grid3x3, List,
  Search, MoreVertical, Download, Trash2, Film, Image as ImageIcon, FileText, File as FileIcon, Home,
  Trash, RotateCcw,
} from "lucide-react";
import { useDrive, useDriveFolder, useDriveTrash, type DriveFile } from "@/hooks/useDrive";
import { NewFolderModal } from "@/components/drive/NewFolderModal";
import { ShareLinkModal } from "@/components/drive/ShareLinkModal";
import { FilePreview } from "@/components/drive/FilePreview";
import { useUploadContext } from "@/contexts/UploadContext";
import { useDownloadContext } from "@/contexts/DownloadContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function formatBytes(b: number) {
  if (!b) return "0 B";
  const k = 1024, units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return (b / Math.pow(k, i)).toFixed(1) + " " + units[i];
}

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["mp4", "mov", "webm", "mkv", "avi"].includes(ext)) return <Film className="w-5 h-5 text-primary" />;
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return <ImageIcon className="w-5 h-5 text-accent" />;
  if (["pdf", "doc", "docx", "txt"].includes(ext)) return <FileText className="w-5 h-5 text-destructive" />;
  return <FileIcon className="w-5 h-5 text-muted-foreground" />;
}

const VIEW_KEY = "drive:viewMode";

export default function DrivePage() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addToQueue, addDriveUpload } = useUploadContext();
  const { startDownload } = useDownloadContext();

  const [folderId, setFolderId] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">(() => (localStorage.getItem(VIEW_KEY) as any) || "grid");
  const [search, setSearch] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ kind: "folder" | "file"; id: string; name: string } | null>(null);
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState<{ kind: "file" | "folder"; id: string; name: string } | null>(null);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth/login");
  }, [user, loading, navigate]);

  useEffect(() => { localStorage.setItem(VIEW_KEY, view); }, [view]);

  useEffect(() => {
    const onChanged = () => { refetchRef.current?.(); };
    window.addEventListener('drive-files-changed', onChanged);
    return () => window.removeEventListener('drive-files-changed', onChanged);
  }, []);
  const refetchRef = useRef<(() => void) | null>(null);

  const {
    syncProjectFolders, createFolder, deleteFolder, deleteFile, registerFile,
    restoreFile, restoreFolder, permanentDeleteFile, permanentDeleteFolder,
  } = useDrive();
  const { data, isLoading, refetch } = useDriveFolder(folderId);
  refetchRef.current = refetch;
  const trashQ = useDriveTrash(showTrash);

  useEffect(() => {
    if (user && userRole) syncProjectFolders();
  }, [user, userRole, syncProjectFolders]);

  const folders = data?.folders || [];
  const files = data?.files || [];
  const breadcrumb = data?.breadcrumb || [];

  const filteredFolders = useMemo(
    () => folders.filter((f) => f.name.toLowerCase().includes(search.toLowerCase())),
    [folders, search]
  );
  const filteredFiles = useMemo(
    () => files.filter((f) => f.file_name.toLowerCase().includes(search.toLowerCase())),
    [files, search]
  );

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFiles = async (selected: FileList | null) => {
    if (!selected || !folderId) {
      toast({ title: "Open a folder first", description: "Pick a folder, then upload.", variant: "destructive" });
      return;
    }
    const arr = Array.from(selected);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: f } = await supabase.from("drive_folders").select("kind, project_id, name").eq("id", folderId).maybeSingle();
      if (f?.kind === "project_root" && f.project_id) {
        addToQueue(arr, f.project_id, f.name || undefined, "deliverable");
      } else {
        await addDriveUpload(arr, folderId, f?.name);
      }
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = (file: DriveFile) => {
    startDownload(file.id, file.file_name, file.file_url, file.file_size);
  };

  const onDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragging(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  };

  return (
    <DashboardLayout role={(userRole as any) || "client"}>
      <Helmet><title>Drive — Veylodesk</title></Helmet>

      <div
        className="space-y-4 relative"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold flex-1">My Drive</h1>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search in folder"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-56"
            />
          </div>
          <div className="flex items-center border rounded-md">
            <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" onClick={() => setView("grid")}>
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" onClick={() => setView("list")}>
              <List className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="outline" onClick={() => setShowNewFolder(true)}>
            <FolderPlus className="w-4 h-4 mr-2" />New folder
          </Button>
          <Button onClick={handleUploadClick} disabled={!folderId}>
            <Upload className="w-4 h-4 mr-2" />Upload
          </Button>
          {folderId && (
            <Button variant="outline" onClick={() => {
              const f = breadcrumb[breadcrumb.length - 1];
              setShareTarget({ kind: "folder", id: folderId, name: f?.name || "folder" });
            }}>
              <Share2 className="w-4 h-4 mr-2" />Share
            </Button>
          )}
          <Button variant={showTrash ? "secondary" : "outline"} onClick={() => setShowTrash((v) => !v)}>
            <Trash className="w-4 h-4 mr-2" />{showTrash ? "Back to Drive" : "Trash"}
          </Button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </div>

        {showTrash ? (
          <TrashView
            data={trashQ.data}
            isLoading={trashQ.isLoading}
            onRestoreFile={async (id) => { await restoreFile(id); trashQ.refetch(); refetch(); }}
            onRestoreFolder={async (id) => { await restoreFolder(id); trashQ.refetch(); refetch(); }}
            onPurgeFile={(id, name) => setConfirmPurge({ kind: "file", id, name })}
            onPurgeFolder={(id, name) => setConfirmPurge({ kind: "folder", id, name })}
          />
        ) : (
          <>

        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <button onClick={() => setFolderId(null)} className="flex items-center gap-1 hover:text-foreground">
            <Home className="w-3.5 h-3.5" /> My Drive
          </button>
          {breadcrumb.map((c) => (
            <div key={c.id} className="flex items-center gap-1">
              <ChevronRight className="w-3.5 h-3.5" />
              <button onClick={() => setFolderId(c.id)} className="hover:text-foreground">{c.name}</button>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
            <Folder className="w-12 h-12 mx-auto opacity-30 mb-3" />
            <p>This folder is empty</p>
            <p className="text-xs mt-1">Create a folder, upload files, or generate a share link.</p>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredFolders.map((f) => (
              <FolderCard key={f.id} folder={f} onOpen={() => setFolderId(f.id)}
                onShare={() => setShareTarget({ kind: "folder", id: f.id, name: f.name })}
                onDelete={f.kind === "custom" ? () => deleteFolder(f.id).then(() => refetch()) : undefined} />
            ))}
            {filteredFiles.map((f) => (
              <FileCard key={f.id} file={f} onPreview={() => setPreviewFile(f)} onDownload={() => handleDownload(f)}
                onShare={() => setShareTarget({ kind: "file", id: f.id, name: f.file_name })}
                onDelete={f.source === "user" || f.source === "public_link" ? () => deleteFile(f.id).then(() => refetch()) : undefined} />
            ))}
          </div>
        ) : (
          <div className="border rounded-lg divide-y">
            {filteredFolders.map((f) => (
              <FolderRow key={f.id} folder={f} onOpen={() => setFolderId(f.id)}
                onShare={() => setShareTarget({ kind: "folder", id: f.id, name: f.name })}
                onDelete={f.kind === "custom" ? () => deleteFolder(f.id).then(() => refetch()) : undefined} />
            ))}
            {filteredFiles.map((f) => (
              <FileRow key={f.id} file={f} onPreview={() => setPreviewFile(f)} onDownload={() => handleDownload(f)}
                onShare={() => setShareTarget({ kind: "file", id: f.id, name: f.file_name })}
                onDelete={f.source === "user" || f.source === "public_link" ? () => deleteFile(f.id).then(() => refetch()) : undefined} />
            ))}
          </div>
        )}
          </>
        )}

        {isDragging && !showTrash && (
          <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
            <div className="border-2 border-dashed border-primary rounded-2xl px-10 py-8 bg-background/90 shadow-xl text-center">
              <Upload className="w-10 h-10 mx-auto mb-2 text-primary" />
              <p className="font-medium">
                {folderId ? "Drop files to upload" : "Open a folder first to upload"}
              </p>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmPurge} onOpenChange={(v) => { if (!v) setConfirmPurge(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmPurge?.name}" will be removed from Bunny storage and the database. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmPurge) return;
                if (confirmPurge.kind === "file") await permanentDeleteFile(confirmPurge.id);
                else await permanentDeleteFolder(confirmPurge.id);
                setConfirmPurge(null);
                trashQ.refetch();
              }}
            >Delete forever</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NewFolderModal
        open={showNewFolder}
        onOpenChange={setShowNewFolder}
        onCreate={async (name) => { await createFolder(name, folderId); refetch(); }}
      />
      {shareTarget && (
        <ShareLinkModal
          open={!!shareTarget}
          onOpenChange={(v) => { if (!v) setShareTarget(null); }}
          folderId={shareTarget.kind === "folder" ? shareTarget.id : undefined}
          fileId={shareTarget.kind === "file" ? shareTarget.id : undefined}
          folderName={shareTarget.kind === "folder" ? shareTarget.name : undefined}
          fileName={shareTarget.kind === "file" ? shareTarget.name : undefined}
        />
      )}
      <FilePreview open={!!previewFile} onOpenChange={(v) => { if (!v) setPreviewFile(null); }} file={previewFile} />
    </DashboardLayout>
  );
}


function FolderCard({ folder, onOpen, onShare, onDelete }: any) {
  return (
    <div className="group relative border rounded-lg p-3 hover:bg-muted/30 cursor-pointer transition" onDoubleClick={onOpen}>
      <div className="flex items-start justify-between">
        <button onClick={onOpen} className="flex-1 text-left">
          <Folder className="w-10 h-10 text-primary mb-2" />
          <p className="text-sm font-medium truncate">{folder.name}</p>
          {folder.kind === "project_root" && <Badge variant="outline" className="text-[10px] mt-1">Project</Badge>}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpen}>Open</DropdownMenuItem>
            <DropdownMenuItem onClick={onShare}><Share2 className="w-4 h-4 mr-2" />Share link</DropdownMenuItem>
            {onDelete && <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function FileCard({ file, onPreview, onDownload, onShare, onDelete }: any) {
  return (
    <div className="group relative border rounded-lg p-3 hover:bg-muted/30 transition cursor-pointer" onDoubleClick={onPreview}>
      <div className="flex items-start justify-between">
        <button onClick={onPreview} className="flex-1 min-w-0 text-left">
          {fileIcon(file.file_name)}
          <p className="text-sm font-medium truncate mt-2">{file.file_name}</p>
          <p className="text-xs text-muted-foreground">{formatBytes(file.file_size)}</p>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onPreview}>Preview</DropdownMenuItem>
            <DropdownMenuItem onClick={onDownload}><Download className="w-4 h-4 mr-2" />Download</DropdownMenuItem>
            {onShare && <DropdownMenuItem onClick={onShare}><Share2 className="w-4 h-4 mr-2" />Share link</DropdownMenuItem>}
            {onDelete && <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function FolderRow({ folder, onOpen, onShare, onDelete }: any) {
  return (
    <div className="flex items-center gap-3 p-3 hover:bg-muted/30 cursor-pointer" onDoubleClick={onOpen}>
      <Folder className="w-5 h-5 text-primary" />
      <button onClick={onOpen} className="flex-1 text-left text-sm font-medium truncate">{folder.name}</button>
      {folder.kind === "project_root" && <Badge variant="outline" className="text-[10px]">Project</Badge>}
      <Button size="sm" variant="ghost" onClick={onShare}><Share2 className="w-4 h-4" /></Button>
      {onDelete && <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
    </div>
  );
}

function FileRow({ file, onPreview, onDownload, onShare, onDelete }: any) {
  return (
    <div className="flex items-center gap-3 p-3 hover:bg-muted/30">
      {fileIcon(file.file_name)}
      <button onClick={onPreview} className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium truncate">{file.file_name}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(file.file_size)}</p>
      </button>
      <Button size="sm" variant="ghost" onClick={onDownload}><Download className="w-4 h-4" /></Button>
      {onShare && <Button size="sm" variant="ghost" onClick={onShare}><Share2 className="w-4 h-4" /></Button>}
      {onDelete && <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
    </div>
  );
}

function timeLeft(deletedAt: string) {
  const end = new Date(deletedAt).getTime() + 30 * 24 * 3600 * 1000;
  const days = Math.max(0, Math.ceil((end - Date.now()) / (24 * 3600 * 1000)));
  return `${days}d left`;
}

function TrashView({ data, isLoading, onRestoreFile, onRestoreFolder, onPurgeFile, onPurgeFolder }: any) {
  if (isLoading) return <div className="text-muted-foreground">Loading trash…</div>;
  const folders = data?.folders || [];
  const files = data?.files || [];
  if (!folders.length && !files.length) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
        <Trash className="w-12 h-12 mx-auto opacity-30 mb-3" />
        <p>Trash is empty</p>
        <p className="text-xs mt-1">Deleted items appear here for 30 days before being permanently removed.</p>
      </div>
    );
  }
  return (
    <div className="border rounded-lg divide-y">
      {folders.map((f: any) => (
        <div key={f.id} className="flex items-center gap-3 p-3 hover:bg-muted/30">
          <Folder className="w-5 h-5 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{f.name}</p>
            <p className="text-xs text-muted-foreground">Folder · {timeLeft(f.deleted_at)}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onRestoreFolder(f.id)}>
            <RotateCcw className="w-4 h-4 mr-1" />Restore
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onPurgeFolder(f.id, f.name)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ))}
      {files.map((f: any) => (
        <div key={f.id} className="flex items-center gap-3 p-3 hover:bg-muted/30">
          <FileIcon className="w-5 h-5 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{f.file_name}</p>
            <p className="text-xs text-muted-foreground">{(f.file_size / 1024 / 1024).toFixed(1)} MB · {timeLeft(f.deleted_at)}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onRestoreFile(f.id)}>
            <RotateCcw className="w-4 h-4 mr-1" />Restore
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onPurgeFile(f.id, f.file_name)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
}
