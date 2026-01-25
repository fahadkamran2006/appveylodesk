const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isBunnyStreamGuid(value: string): boolean {
  return GUID_REGEX.test(value);
}

/**
 * Supports:
 * - direct GUID
 * - HLS url: https://vz-XXXX.b-cdn.net/{guid}/playlist.m3u8
 * - embed url: https://iframe.mediadelivery.net/embed/{LIB}/{guid}
 * - any string containing a GUID
 */
export function extractBunnyStreamVideoId(urlOrId: string): string | null {
  if (!urlOrId) return null;

  if (isBunnyStreamGuid(urlOrId)) return urlOrId;

  const hlsMatch = urlOrId.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/playlist\.m3u8/i
  );
  if (hlsMatch) return hlsMatch[1];

  const embedMatch = urlOrId.match(
    /iframe\.mediadelivery\.net\/embed\/[^/]+\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  if (embedMatch) return embedMatch[1];

  const anyGuid = urlOrId.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  return anyGuid ? anyGuid[1] : null;
}

export function isLikelyBunnyStreamVideo(urlOrId: string): boolean {
  // We purposely keep this liberal; if it contains a GUID we treat it as Stream.
  return extractBunnyStreamVideoId(urlOrId) !== null;
}

export function buildBunnyStreamEmbedUrl(libraryId: string, videoId: string): string {
  return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?autoplay=false`;
}

export function buildBunnyStreamDownloadUrl(libraryId: string, videoId: string): string {
  // Use Pull Zone CDN format for downloads (requires "Keep Original Files" enabled)
  return `https://vz-${libraryId}.b-cdn.net/${videoId}/original`;
}

export function extractBunnyStreamLibraryIdFromEmbedUrl(embedUrl: string): string | null {
  const m = embedUrl.match(/iframe\.mediadelivery\.net\/embed\/([^/]+)\//i);
  return m ? m[1] : null;
}

export function ensureAutoplayFalse(embedUrl: string): string {
  try {
    const url = new URL(embedUrl);
    url.searchParams.set('autoplay', 'false');
    return url.toString();
  } catch {
    // Fallback for non-URL strings
    if (embedUrl.includes('autoplay=')) {
      return embedUrl.replace(/autoplay=[^&]*/i, 'autoplay=false');
    }
    return embedUrl.includes('?') ? `${embedUrl}&autoplay=false` : `${embedUrl}?autoplay=false`;
  }
}

/** Best-effort fallback when config hasn't loaded yet. */
export function inferLibraryIdFromStreamUrl(fileUrl: string): string | null {
  // Bunny Stream HLS host: vz-{LIBRARY_ID}.b-cdn.net (common)
  const m = fileUrl.match(/https?:\/\/vz-([a-z0-9]+)\.b-cdn\.net\//i);
  return m ? m[1] : null;
}
