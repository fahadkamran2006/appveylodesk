import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, ChevronLeft, ChevronRight, Loader2, RotateCcw } from "lucide-react";
import { useDownloadContext } from "@/contexts/DownloadContext";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

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

function PdfViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerWidth(Math.floor(e.contentRect.width));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const t = thumbsRef.current?.querySelector(`[data-page="${pageNumber}"]`) as HTMLElement | null;
    t?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [pageNumber]);

  const goPrev = () => setPageNumber((p) => Math.max(1, p - 1));
  const goNext = () => setPageNumber((p) => Math.min(numPages, p + 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [numPages]);

  return (
    <Document
      file={url}
      onLoadSuccess={({ numPages: n }) => setNumPages(n)}
      loading={<div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>}
      error={<div className="p-8 text-center text-muted-foreground">Failed to load PDF.</div>}
    >
      <div className="flex gap-3 h-[70vh]">
        {/* Thumbnails */}
        <div ref={thumbsRef} className="w-32 shrink-0 overflow-y-auto bg-background/50 rounded-md p-2 space-y-2 border border-border">
          {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              data-page={n}
              onClick={() => setPageNumber(n)}
              className={`block w-full rounded-sm overflow-hidden border-2 transition-colors ${
                n === pageNumber ? "border-primary" : "border-transparent hover:border-border"
              }`}
            >
              <Page pageNumber={n} width={104} renderAnnotationLayer={false} renderTextLayer={false} />
              <div className="text-[10px] text-center py-1 text-muted-foreground">{n}</div>
            </button>
          ))}
        </div>

        {/* Main page */}
        <div className="flex-1 flex flex-col min-w-0">
          <div ref={containerRef} className="flex-1 overflow-auto flex items-start justify-center bg-muted/30 rounded-md">
            <Page pageNumber={pageNumber} width={Math.min(containerWidth - 16, 900)} />
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={goPrev} disabled={pageNumber <= 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums">
              Page {pageNumber} / {numPages || "…"}
            </span>
            <Button variant="outline" size="sm" onClick={goNext} disabled={pageNumber >= numPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Document>
  );
}

function VideoViewer({ fileId, url }: { fileId: string; url: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const storageKey = `drive:video:pos:${fileId}`;
  const [resumeAt, setResumeAt] = useState<number | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const t = parseFloat(raw);
      if (!isNaN(t) && t > 5) setResumeAt(t);
    }
  }, [storageKey]);

  const onLoadedMetadata = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    if (resumeAt && resumeAt < v.duration - 5) {
      v.currentTime = resumeAt;
    }
  }, [resumeAt]);

  const onTimeUpdate = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    if (Math.floor(v.currentTime) % 3 === 0) {
      localStorage.setItem(storageKey, String(v.currentTime));
    }
  }, [storageKey]);

  const onEnded = useCallback(() => {
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  const restart = () => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = 0;
    localStorage.removeItem(storageKey);
    v.play().catch(() => {});
  };

  return (
    <div className="w-full">
      <video
        ref={ref}
        src={url}
        controls
        controlsList="nodownload"
        playsInline
        preload="metadata"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        className="max-h-[65vh] w-full bg-black rounded-md"
      />
      {resumeAt && (
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 px-1">
          <span>Resumed at {Math.floor(resumeAt / 60)}:{String(Math.floor(resumeAt % 60)).padStart(2, "0")}</span>
          <Button variant="ghost" size="sm" onClick={restart}>
            <RotateCcw className="w-3 h-3 mr-1" /> Start over
          </Button>
        </div>
      )}
    </div>
  );
}

export function FilePreview({ open, onOpenChange, file }: Props) {
  const { startDownload } = useDownloadContext();
  if (!file) return null;
  const k = kindOf(file.file_name, file.mime_type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{file.file_name}</DialogTitle>
        </DialogHeader>

        <div className="bg-muted/30 rounded-md flex items-center justify-center min-h-[300px] overflow-hidden">
          {k === "image" && <img src={file.file_url} alt={file.file_name} className="max-h-[70vh] object-contain" />}
          {k === "video" && <VideoViewer fileId={file.id} url={file.file_url} />}
          {k === "audio" && <audio src={file.file_url} controls className="w-full px-6" />}
          {k === "pdf" && <div className="w-full p-2"><PdfViewer url={file.file_url} /></div>}
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
