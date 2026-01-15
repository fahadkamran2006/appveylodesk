import { supabase } from "@/integrations/supabase/client";

export function extractDeliverablesPathFromUrl(fileUrl: string): string | null {
  if (!fileUrl) return null;

  // If we already have a storage path like "projectId/filename.ext"
  if (!/^https?:\/\//i.test(fileUrl)) {
    return decodeURIComponent(fileUrl.split("?")[0]);
  }

  const idx = fileUrl.indexOf("/deliverables/");
  if (idx === -1) return null;

  const path = fileUrl.slice(idx + "/deliverables/".length);
  return decodeURIComponent(path.split("?")[0]);
}

export function guessVideoMimeType(fileNameOrUrl: string): string | undefined {
  const clean = fileNameOrUrl.split("?")[0];
  const ext = clean.split(".").pop()?.toLowerCase();
  if (!ext) return undefined;

  if (ext === "mp4") return "video/mp4";
  if (ext === "mov") return "video/quicktime";
  if (ext === "webm") return "video/webm";
  if (ext === "mkv") return "video/x-matroska";
  if (ext === "avi") return "video/x-msvideo";
  return undefined;
}

export async function getDeliverableSignedUrl(
  deliverableId: string,
  expiresIn: number = 3600
): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("deliverables-ops", {
    body: { action: "signed_url", deliverableId, expiresIn },
  });

  if (error) throw error;
  if (!data) return null;
  if ((data as any).error) throw new Error((data as any).error);

  return (data as any).signedUrl ?? null;
}
