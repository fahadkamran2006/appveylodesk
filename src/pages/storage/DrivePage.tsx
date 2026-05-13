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

function fileIcon(name: string, big = false) {
  const cls = big ? "w-8 h-8" : "w-5 h-5";
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["mp4", "mov", "webm", "mkv", "avi"].includes(ext)) return <Film className={`${cls} text-primary`} />;
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return <ImageIcon className={`${cls} text-accent`} />;
  if (["pdf", "doc", "docx", "txt"].includes(ext)) return <FileText className={`${cls} text-destructive`} />;
  return <FileIcon className={`${cls} text-muted-foreground`} />;
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

  const uploadIntoFolder = async (
    files: File[],
    targetId: string,
    targetMeta?: { kind?: string; project_id?: string | null; name?: string | null },
  ) => {
    if (!files.length) return;
    let meta = targetMeta;
    if (!meta) {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: f } = await supabase.from("drive_folders").select("kind, project_id, name").eq("id", targetId).maybeSingle();
      meta = f || {};
    }
    if (meta?.kind === "client_root" || meta?.kind === "container_root") {
      toast({ title: "Pick a video folder", description: "Open a video folder inside this project to upload.", variant: "destructive" });
      return;
    }
    if (meta?.kind === "project_root" && meta.project_id) {
      addToQueue(files, meta.project_id, meta.name || undefined, "deliverable");
    } else {
      await addDriveUpload(files, targetId, meta?.name || undefined);
    }
  };

  // Walk a DataTransferItemList. Returns true if any directory entries were processed.
  const handleDrop = async (
    items: DataTransferItemList | null,
    fallbackFiles: FileList | null,
    targetFolderId?: string | null,
    targetName?: string,
  ) => {
    const target = targetFolderId ?? folderId;
    if (!target) {
      toast({ title: "Open a folder first", description: "Pick a folder, then upload.", variant: "destructive" });
      return;
    }
    // Snapshot entries synchronously (DataTransferItemList becomes invalid after await)
    const entries: any[] = [];
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const entry = (it as any).webkitGetAsEntry?.();
        if (entry) entries.push(entry);
      }
    }
    const hasDirectory = entries.some((e) => e?.isDirectory);

    const { supabase } = await import("@/integrations/supabase/client");
    const { data: targetMeta } = await supabase
      .from("drive_folders").select("kind, project_id, name").eq("id", target).maybeSingle();

    const displayName = targetName || targetMeta?.name || "folder";

    if (!hasDirectory) {
      const arr = fallbackFiles ? Array.from(fallbackFiles) : [];
      if (!arr.length) return;
      toast({ title: `Uploading to “${displayName}”`, description: `${arr.length} file${arr.length > 1 ? "s" : ""}` });
      await uploadIntoFolder(arr, target, targetMeta || undefined);
      return;
    }

    if (targetMeta?.kind === "client_root" || targetMeta?.kind === "container_root") {
      toast({ title: "Pick a video folder", description: "Open a video folder inside this project to upload.", variant: "destructive" });
      return;
    }

    toast({ title: `Uploading folder to “${displayName}”`, description: "Recreating folder structure…" });

    // Helpers: read entries (paged) + read file
    const readDir = (dirReader: any): Promise<any[]> =>
      new Promise((resolve, reject) => {
        const all: any[] = [];
        const readBatch = () => dirReader.readEntries((batch: any[]) => {
          if (!batch.length) resolve(all);
          else { all.push(...batch); readBatch(); }
        }, reject);
        readBatch();
      });
    const getFile = (entry: any): Promise<File> =>
      new Promise((resolve, reject) => entry.file(resolve, reject));

    const createSub = async (name: string, parentId: string): Promise<string> => {
      const { data, error } = await supabase.functions.invoke("drive-ops", {
        body: { action: "create_folder", name, parentId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as any).folder.id as string;
    };

    // Walk entries; collect files-per-folder, creating folders on the fly
    const filesByFolder = new Map<string, File[]>();
    const walk = async (entry: any, parentFolderId: string) => {
      if (entry.isFile) {
        const file = await getFile(entry);
        const arr = filesByFolder.get(parentFolderId) || [];
        arr.push(file);
        filesByFolder.set(parentFolderId, arr);
        return;
      }
      if (entry.isDirectory) {
        const newFolderId = await createSub(entry.name, parentFolderId);
        const children = await readDir(entry.createReader());
        for (const child of children) await walk(child, newFolderId);
      }
    };
    try {
      for (const e of entries) await walk(e, target);
      // Refresh folder list
      window.dispatchEvent(new Event("drive-files-changed"));
      // Upload accumulated files per folder
      for (const [fid, files] of filesByFolder) {
        const meta = fid === target ? targetMeta || undefined : undefined;
        await uploadIntoFolder(files, fid, meta);
      }
    } catch (e: any) {
      toast({ title: "Folder upload failed", description: e.message, variant: "destructive" });
    }
  };

  const handleFiles = async (selected: FileList | null, targetFolderId?: string | null, targetName?: string) => {
    const target = targetFolderId ?? folderId;
    if (!selected || !target) {
      toast({ title: "Open a folder first", description: "Pick a folder, then upload.", variant: "destructive" });
      return;
    }
    const arr = Array.from(selected);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: f } = await supabase.from("drive_folders").select("kind, project_id, name").eq("id", target).maybeSingle();
      const displayName = targetName || f?.name || "folder";
      if (targetFolderId) {
        toast({ title: `Uploading to “${displayName}”`, description: `${arr.length} file${arr.length > 1 ? "s" : ""}` });
      }
      await uploadIntoFolder(arr, target, f || undefined);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = (file: DriveFile) => {
    startDownload(file.id, file.file_name, file.file_url, file.file_size);
  };

  // Window-level drag listeners so the entire content area is a drop zone
  // (without overlaying the sidebar).
  useEffect(() => {
    if (showTrash) return;
    const onEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      e.preventDefault();
      dragCounter.current += 1;
      setIsDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      e.preventDefault();
    };
    const onLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragging(false);
      }
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      // Only accept drops that land inside the drive content area
      const zone = dropZoneRef.current;
      if (!zone) return;
      const target = e.target as Node | null;
      if (target && !zone.contains(target)) return;
      if (e.dataTransfer) handleDrop(e.dataTransfer.items, e.dataTransfer.files, null);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [showTrash, folderId]);

  return (
    <DashboardLayout role={(userRole as any) || "client"}>
      <Helmet><title>Drive — Veylodesk</title></Helmet>

      <div
        ref={dropZoneRef}
        className="space-y-4 relative min-h-[calc(100dvh-10rem)]"
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredFolders.map((f) => (
              <FolderCard key={f.id} folder={f} onOpen={() => setFolderId(f.id)}
                onShare={() => setShareTarget({ kind: "folder", id: f.id, name: f.name })}
                onDropData={(f.kind === "client_root" || f.kind === "container_root") ? undefined : (dt: DataTransfer) => handleDrop(dt.items, dt.files, f.id, f.name)}
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
                onDropData={(f.kind === "client_root" || f.kind === "container_root") ? undefined : (dt: DataTransfer) => handleDrop(dt.items, dt.files, f.id, f.name)}
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
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-2xl bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary/60">
            <div className="rounded-2xl px-10 py-8 bg-background/90 shadow-xl text-center">
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


function FolderCard({ folder, onOpen, onShare, onDelete, onDropFiles }: any) {
  const [over, setOver] = useState(false);
  const dragHandlers = onDropFiles
    ? {
        onDragEnter: (e: React.DragEvent) => {
          if (!e.dataTransfer?.types?.includes("Files")) return;
          e.preventDefault(); e.stopPropagation(); setOver(true);
        },
        onDragOver: (e: React.DragEvent) => {
          if (!e.dataTransfer?.types?.includes("Files")) return;
          e.preventDefault(); e.stopPropagation();
        },
        onDragLeave: (e: React.DragEvent) => {
          e.preventDefault(); e.stopPropagation(); setOver(false);
        },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault(); e.stopPropagation(); setOver(false);
          if (e.dataTransfer?.files?.length) onDropFiles(e.dataTransfer.files);
        },
      }
    : {};
  return (
    <div
      {...dragHandlers}
      className={cn(
        "group relative border border-border rounded-xl p-5 bg-card hover:bg-muted/40 hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer transition-all duration-200",
        over && "border-primary bg-primary/10 ring-2 ring-primary/40"
      )}
      onDoubleClick={onOpen}
    >
      <button onClick={onOpen} className="w-full text-left">
        <div className="flex items-center justify-center h-20 mb-3 rounded-lg bg-primary/5 group-hover:bg-primary/10 transition-colors">
          <Folder className="w-12 h-12 text-primary" />
        </div>
        <p className="text-sm font-medium truncate">{folder.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {folder.kind === "client_root" ? "Client" : folder.kind === "container_root" ? "Project" : folder.kind === "project_root" ? "Video folder" : "Folder"}
        </p>
      </button>
      <div className="absolute top-2 right-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
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
    <div
      className="group relative border border-border rounded-xl p-5 bg-card hover:bg-muted/40 hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
      onDoubleClick={onPreview}
    >
      <button onClick={onPreview} className="w-full min-w-0 text-left">
        <div className="flex items-center justify-center h-20 mb-3 rounded-lg bg-muted/40 group-hover:bg-muted/60 transition-colors">
          {fileIcon(file.file_name, true)}
        </div>
        <p className="text-sm font-medium truncate">{file.file_name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{formatBytes(file.file_size)}</p>
      </button>
      <div className="absolute top-2 right-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
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

function FolderRow({ folder, onOpen, onShare, onDelete, onDropFiles }: any) {
  const [over, setOver] = useState(false);
  const dragHandlers = onDropFiles
    ? {
        onDragEnter: (e: React.DragEvent) => {
          if (!e.dataTransfer?.types?.includes("Files")) return;
          e.preventDefault(); e.stopPropagation(); setOver(true);
        },
        onDragOver: (e: React.DragEvent) => {
          if (!e.dataTransfer?.types?.includes("Files")) return;
          e.preventDefault(); e.stopPropagation();
        },
        onDragLeave: (e: React.DragEvent) => {
          e.preventDefault(); e.stopPropagation(); setOver(false);
        },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault(); e.stopPropagation(); setOver(false);
          if (e.dataTransfer?.files?.length) onDropFiles(e.dataTransfer.files);
        },
      }
    : {};
  return (
    <div
      {...dragHandlers}
      className={cn(
        "flex items-center gap-3 p-3 hover:bg-muted/30 cursor-pointer",
        over && "bg-primary/10 ring-2 ring-primary/40 ring-inset"
      )}
      onDoubleClick={onOpen}
    >
      <Folder className="w-5 h-5 text-primary" />
      <button onClick={onOpen} className="flex-1 text-left text-sm font-medium truncate">{folder.name}</button>
      {folder.kind === "project_root" && <Badge variant="outline" className="text-[10px]">Project</Badge>}
      {folder.kind === "client_root" && <Badge variant="outline" className="text-[10px]">Client</Badge>}
      {folder.kind === "container_root" && <Badge variant="outline" className="text-[10px]">Project</Badge>}
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
