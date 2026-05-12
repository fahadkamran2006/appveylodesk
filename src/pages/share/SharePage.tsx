import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Folder, Download, Upload, Lock, Loader2, File as FileIcon, Film, Image as ImageIcon, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async (pw?: string) => {
    setLoading(true); setError(null);
    try {
      const { data: res, error: fErr } = await supabase.functions.invoke("drive-share-resolve", {
        body: { token, password: pw },
      });
      if (fErr) throw fErr;
      if (res?.requiresPassword) { setNeedPassword(true); setLoading(false); return; }
      if (res?.error) throw new Error(res.error);
      setData(res); setNeedPassword(false);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally { setLoading(false); }
  };

  useEffect(() => { if (token) load(); /* eslint-disable-next-line */ }, [token]);

  const canDownload = data?.link?.permission && ["download", "full"].includes(data.link.permission);
  const canUpload = data?.link?.permission && ["upload", "full"].includes(data.link.permission);

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
      load(password);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
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

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>{data?.folder?.name || "Shared folder"} — Veylodesk</title></Helmet>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Folder className="w-7 h-7 text-primary" />
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{data?.folder?.name || "Shared folder"}</h1>
            <p className="text-xs text-muted-foreground">Shared via Veylodesk</p>
          </div>
          <Badge variant="outline">{data?.link?.permission}</Badge>
        </div>

        {canUpload && (
          <div className="border-2 border-dashed rounded-xl p-6 space-y-3">
            <p className="font-medium flex items-center gap-2"><Upload className="w-4 h-4" />Upload files</p>
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
            <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading…</> : <><Upload className="w-4 h-4 mr-2" />Choose files</>}
            </Button>
            {data?.link?.max_upload_bytes && (
              <p className="text-xs text-muted-foreground">Limit: {formatBytes(data.link.max_upload_bytes)} total · used {formatBytes(data.link.used_bytes)}</p>
            )}
          </div>
        )}

        <div className="border rounded-lg divide-y">
          {(data?.subfolders || []).map((f: any) => (
            <div key={f.id} className="flex items-center gap-3 p-3">
              <Folder className="w-5 h-5 text-primary" />
              <span className="flex-1 text-sm font-medium">{f.name}</span>
            </div>
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
    </div>
  );
}
