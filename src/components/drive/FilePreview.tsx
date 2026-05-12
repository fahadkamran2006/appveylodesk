import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";
import { useDownloadContext } from "@/contexts/DownloadContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  file: { id: string; file_name: string; file_url: string; file_size: number; mime_type?: string | null } | null;
}

function kindOf(name: string, mime?: string | null): "image" | "video" | "audio" | "pdf" | "text" | "other" {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (mime?.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "image";
  if (mime?.startsWith("video/") || ["mp4", "webm", "mov", "mkv"].includes(ext)) return "video";
  if (mime?.startsWith("audio/") || ["mp3", "wav", "m4a", "aac", "ogg"].includes(ext)) return "audio";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime?.startsWith("text/") || ["txt", "md", "json", "csv", "log"].includes(ext)) return "text";
  return "other";
}

export function FilePreview({ open, onOpenChange, file }: Props) {
  const { startDownload } = useDownloadContext();
  if (!file) return null;
  const k = kindOf(file.file_name, file.mime_type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{file.file_name}</DialogTitle>
        </DialogHeader>

        <div className="bg-muted/30 rounded-md flex items-center justify-center min-h-[300px] max-h-[70vh] overflow-auto">
          {k === "image" && <img src={file.file_url} alt={file.file_name} className="max-h-[70vh] object-contain" />}
          {k === "video" && <video src={file.file_url} controls className="max-h-[70vh] w-full" />}
          {k === "audio" && <audio src={file.file_url} controls className="w-full px-6" />}
          {k === "pdf" && <iframe src={file.file_url} className="w-full h-[70vh]" title={file.file_name} />}
          {k === "text" && <iframe src={file.file_url} className="w-full h-[70vh] bg-background" title={file.file_name} />}
          {k === "other" && (
            <div className="text-center p-8 text-muted-foreground">
              <p>No preview available for this file type.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
            <a href={file.file_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />Open in new tab
            </a>
          </Button>
          <Button onClick={() => startDownload(file.id, file.file_name, file.file_url, file.file_size)}>
            <Download className="w-4 h-4 mr-2" />Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
