import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useDrive } from "@/hooks/useDrive";
import { useToast } from "@/hooks/use-toast";
import { Copy, Trash2, Link as LinkIcon } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folderId?: string;
  fileId?: string;
  folderName?: string;
  fileName?: string;
}

export function ShareLinkModal({ open, onOpenChange, folderId, fileId, folderName, fileName }: Props) {
  const { createShareLink, listShareLinks, revokeShareLink } = useDrive();
  const { toast } = useToast();
  const isFile = !!fileId;
  const targetName = isFile ? (fileName || "file") : (folderName || "folder");

  const [permission, setPermission] = useState<"view" | "download" | "upload" | "full">("download");
  const [password, setPassword] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("");
  const [maxMB, setMaxMB] = useState<string>("");
  const [maxFiles, setMaxFiles] = useState<string>("");
  const [links, setLinks] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isFile && (permission === "upload" || permission === "full")) setPermission("download");
  }, [isFile, permission]);

  const refresh = async () => {
    try { setLinks(await listShareLinks({ folderId, fileId })); } catch {}
  };

  useEffect(() => { if (open) refresh(); /* eslint-disable-next-line */ }, [open, folderId, fileId]);

  const generate = async () => {
    setBusy(true);
    try {
      const expiresAt = expiresInDays ? new Date(Date.now() + parseInt(expiresInDays) * 86400000).toISOString() : null;
      const link = await createShareLink({
        folderId,
        fileId,
        permission,
        password: password || undefined,
        expiresAt,
        maxUploadBytes: maxMB ? parseInt(maxMB) * 1024 * 1024 : null,
        maxFiles: maxFiles ? parseInt(maxFiles) : null,
      });
      const url = `${window.location.origin}/s/${link.token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast({ title: "Link created", description: "Copied to clipboard" });
      setPassword(""); setExpiresInDays(""); setMaxMB(""); setMaxFiles("");
      refresh();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const copy = (token: string) => {
    const url = `${window.location.origin}/s/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied" });
  };

  const revoke = async (id: string) => {
    await revokeShareLink(id);
    refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share "{targetName}"</DialogTitle>
          <DialogDescription>
            {isFile
              ? "Anyone with the link can view or download this file. No account needed."
              : "Anyone with the link can access this folder. No account needed."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Permission</Label>
            <Select value={permission} onValueChange={(v: any) => setPermission(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="view">View only</SelectItem>
                <SelectItem value="download">View + download</SelectItem>
                <SelectItem value="upload">Upload only (drop box)</SelectItem>
                <SelectItem value="full">Full (view, download, upload)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Password (optional)</Label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank for none" />
            </div>
            <div>
              <Label>Expires in (days)</Label>
              <Input type="number" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} placeholder="Never" />
            </div>
          </div>

          {(permission === "upload" || permission === "full") && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max upload size (MB)</Label>
                <Input type="number" value={maxMB} onChange={(e) => setMaxMB(e.target.value)} placeholder="Unlimited" />
              </div>
              <div>
                <Label>Max files</Label>
                <Input type="number" value={maxFiles} onChange={(e) => setMaxFiles(e.target.value)} placeholder="Unlimited" />
              </div>
            </div>
          )}

          <Button onClick={generate} disabled={busy} className="w-full">
            <LinkIcon className="w-4 h-4 mr-2" />Generate link
          </Button>
        </div>

        {links.length > 0 && (
          <div className="space-y-2 max-h-60 overflow-auto border-t pt-3">
            <p className="text-sm font-medium">Existing links</p>
            {links.map((l) => (
              <div key={l.id} className="flex items-center gap-2 text-sm border rounded p-2">
                <Badge variant={l.is_revoked ? "secondary" : "default"}>{l.permission}</Badge>
                <span className="flex-1 truncate text-xs text-muted-foreground">/s/{l.token.slice(0, 8)}…</span>
                {l.is_revoked ? (
                  <Badge variant="destructive">Revoked</Badge>
                ) : (
                  <>
                    <Button size="icon" variant="ghost" onClick={() => copy(l.token)}><Copy className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => revoke(l.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
