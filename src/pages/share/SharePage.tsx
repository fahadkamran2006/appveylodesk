import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Folder, Download, Upload, Lock, Loader2, File as FileIcon, Film,
  Image as ImageIcon, FileText, FolderPlus, ChevronRight, Home,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PoweredByVeylodesk } from "@/components/PoweredByVeylodesk";

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

interface Crumb { id: string; name: string }

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [needPassword, setNeedPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [uploaderName, setUploaderName] = useState("");
  const [uploaderEmail, setUploaderEmail] = useState("");
  const [uploading, setUploading] = useState(false);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async (pw?: string, subFolderId?: string | null) => {
    setLoading(true); setError(null);
    try {
      const { data: res, error: fErr } = await supabase.functions.invoke("drive-share-resolve", {
        body: { token, password: pw, subFolderId: subFolderId || undefined },
      });
      if (fErr) throw fErr;
      if (res?.requiresPassword) { setNeedPassword(true); setLoading(false); return; }
      if (res?.error) throw new Error(res.error);
      setData(res); setNeedPassword(false);
      if (res?.kind === "folder") {
        setCurrentFolderId(res.folder?.id || res.link?.folder_id || null);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally { setLoading(false); }
  };

  useEffect(() => { if (token) load(); /* eslint-disable-next-line */ }, [token]);

  const enterFolder = async (f: { id: string; name: string }) => {
    setCrumbs((prev) => [...prev, f]);
    await load(password, f.id);
  };

  const goToCrumb = async (idx: number) => {
    if (idx === -1) {
      setCrumbs([]);
      await load(password, null);
      return;
    }
    const next = crumbs.slice(0, idx + 1);
    const target = next[next.length - 1];
    setCrumbs(next);
    await load(password, target.id);
  };

  const permission = data?.link?.permission;
  const canDownload = ["download", "full"].includes(permission || "");
  const canUpload = ["upload", "edit", "full"].includes(permission || "");
  const canCreateFolder = ["edit", "full"].includes(permission || "");

  const handleDownload = (f: any) => {
    const a = document.createElement("a");
    a.href = f.file_url;
    a.download = f.file_name;
    a.target = "_blank";
    document.body.appendChild(a); a.click(); a.remove();
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("token", token!);
        if (password) form.append("password", password);
        form.append("uploaderName", uploaderName || "Anonymous");
        if (uploaderEmail) form.append("uploaderEmail", uploaderEmail);
        if (currentFolderId) form.append("folderId", currentFolderId);
        form.append("file", file);

        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/drive-share-upload`;
        const r = await fetch(url, {
          method: "POST",
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: form,
        });
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error || "Upload failed");
      }
      toast({ title: "Upload complete" });
      load(password, currentFolderId);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleCreateFolder = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      const { data: res, error: fErr } = await supabase.functions.invoke("drive-share-folder", {
        body: { token, password, parentId: currentFolderId, name: trimmed, action: "create" },
      });
      if (fErr) throw fErr;
      if (res?.error) throw new Error(res.error);
      toast({ title: "Folder created" });
      setNewName(""); setShowNew(false);
      load(password, currentFolderId);
    } catch (e: any) {
      toast({ title: "Couldn't create folder", description: e.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (needPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Helmet><title>Protected share — Veylodesk</title></Helmet>
        <div className="max-w-sm w-full border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2"><Lock className="w-5 h-5" /><h1 className="text-lg font-semibold">Password required</h1></div>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" />
          <Button onClick={() => load(password)} className="w-full">Unlock</Button>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{error}</div>;
  }

  // ----- Single-file share -----
  if (data?.kind === "file") {
    const f = data.file;
    const ext = f.file_name.split(".").pop()?.toLowerCase() || "";
    const isVideo = ["mp4", "webm", "mov", "mkv"].includes(ext) || f.mime_type?.startsWith?.("video/");
    const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext) || f.mime_type?.startsWith?.("image/");
    const isPdf = ext === "pdf" || f.mime_type === "application/pdf";
    return (
      <div className="min-h-screen bg-background">
        <Helmet><title>{f.file_name} — Veylodesk</title></Helmet>
        <div className="max-w-4xl mx-auto p-6 space-y-4">
          <div className="flex items-center gap-3">
            {fileIcon(f.file_name)}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold truncate">{f.file_name}</h1>
              <p className="text-xs text-muted-foreground">{formatBytes(f.file_size)} · Shared via Veylodesk</p>
            </div>
            <Badge variant="outline">{permission}</Badge>
          </div>
          <div className="bg-muted/30 rounded-lg flex items-center justify-center min-h-[300px] overflow-hidden">
            {isImage && <img src={f.file_url} alt={f.file_name} className="max-h-[70vh] object-contain" />}
            {isVideo && <video src={f.file_url} controls className="max-h-[70vh] w-full" />}
            {isPdf && <iframe src={f.file_url} className="w-full h-[70vh]" title={f.file_name} />}
            {!isImage && !isVideo && !isPdf && (
              <div className="p-8 text-center text-muted-foreground text-sm">No inline preview available.</div>
            )}
          </div>
          {canDownload && (
            <div className="flex justify-end">
              <Button onClick={() => handleDownload(f)}>
                <Download className="w-4 h-4 mr-2" /> Download
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>{data?.folder?.name || "Shared folder"} — Veylodesk</title></Helmet>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Folder className="w-7 h-7 text-primary" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold truncate">{data?.folder?.name || "Shared folder"}</h1>
            <p className="text-xs text-muted-foreground">Shared via Veylodesk</p>
          </div>
          <Badge variant="outline">{permission}</Badge>
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
          <button onClick={() => goToCrumb(-1)} className="flex items-center gap-1 hover:text-foreground">
            <Home className="w-3.5 h-3.5" /> Shared folder
          </button>
          {crumbs.map((c, i) => (
            <div key={c.id} className="flex items-center gap-1">
              <ChevronRight className="w-3.5 h-3.5" />
              <button onClick={() => goToCrumb(i)} className="hover:text-foreground">{c.name}</button>
            </div>
          ))}
        </div>

        {canUpload && (
          <div className="border-2 border-dashed rounded-xl p-6 space-y-3">
            <p className="font-medium flex items-center gap-2"><Upload className="w-4 h-4" />Upload to "{crumbs.length ? crumbs[crumbs.length - 1].name : data?.folder?.name}"</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Your name</Label>
                <Input value={uploaderName} onChange={(e) => setUploaderName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <Label>Email (optional)</Label>
                <Input type="email" value={uploaderEmail} onChange={(e) => setUploaderEmail(e.target.value)} placeholder="you@example.com" />
              </div>
            </div>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
                {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading…</> : <><Upload className="w-4 h-4 mr-2" />Choose files</>}
              </Button>
              {canCreateFolder && (
                <Button variant="outline" onClick={() => setShowNew(true)}>
                  <FolderPlus className="w-4 h-4 mr-2" />New folder
                </Button>
              )}
            </div>
            {data?.link?.max_upload_bytes && (
              <p className="text-xs text-muted-foreground">Limit: {formatBytes(data.link.max_upload_bytes)} total · used {formatBytes(data.link.used_bytes)}</p>
            )}
          </div>
        )}

        <div className="border rounded-lg divide-y">
          {(data?.subfolders || []).map((f: any) => (
            <button
              key={f.id}
              onClick={() => enterFolder(f)}
              className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 text-left"
            >
              <Folder className="w-5 h-5 text-primary" />
              <span className="flex-1 text-sm font-medium truncate">{f.name}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
          {(data?.files || []).length === 0 && (data?.subfolders || []).length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">This folder is empty.</div>
          )}
          {(data?.files || []).map((f: any) => (
            <div key={f.id} className="flex items-center gap-3 p-3">
              {fileIcon(f.file_name)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.file_name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(f.file_size)}</p>
              </div>
              {canDownload && (
                <Button size="sm" variant="ghost" onClick={() => handleDownload(f)}>
                  <Download className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {data?.is_free_plan && (
        <div className="max-w-3xl mx-auto px-4 pb-6">
          <PoweredByVeylodesk variant="footer" />
        </div>
      )}


      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>New folder</DialogTitle></DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder} disabled={!newName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
