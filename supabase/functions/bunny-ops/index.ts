import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Action = "upload" | "delete" | "stream_status" | "download_stream";

// Get Bunny.net configuration from environment
const BUNNY_API_KEY = Deno.env.get("BUNNY_API_KEY")!;
const BUNNY_STORAGE_ZONE = Deno.env.get("BUNNY_STORAGE_ZONE")!;
const BUNNY_CDN_URL = Deno.env.get("BUNNY_CDN_URL")!;
const BUNNY_STORAGE_HOSTNAME = Deno.env.get("BUNNY_STORAGE_HOSTNAME") || "storage.bunnycdn.com";

// Bunny Stream configuration
const BUNNY_STREAM_API_KEY = Deno.env.get("BUNNY_STREAM_API_KEY") || "";
const BUNNY_STREAM_LIBRARY_ID = Deno.env.get("BUNNY_STREAM_LIBRARY_ID") || "";
const BUNNY_STREAM_TOKEN_AUTH_KEY = Deno.env.get("BUNNY_STREAM_TOKEN_AUTH_KEY") || "";

// Video file extensions that should use Bunny Stream
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'm4v', 'flv', 'mpeg', 'mpg'];

function isVideoFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return VIDEO_EXTENSIONS.includes(ext);
}

function isBunnyStreamConfigured(): boolean {
  return Boolean(BUNNY_STREAM_API_KEY && BUNNY_STREAM_LIBRARY_ID);
}

// Generate library-specific CDN hostname
function getStreamCdnHost(): string {
  // NOTE: Bunny Stream pull zone hostnames are NOT derived from the library id.
  // They are typically `vz-<pullZoneId>.b-cdn.net` (see the deliverable's playlist.m3u8 URL).
  // Keep this as a last-resort fallback only.
  return `vz-${BUNNY_STREAM_LIBRARY_ID}.b-cdn.net`;
}

function getStreamPullZoneHostFromFileUrl(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl);
    // Expected: https://vz-<pullzone>.b-cdn.net/<videoId>/playlist.m3u8
    if (url.host.includes(".b-cdn.net") && url.pathname.includes("/playlist.m3u8")) {
      return url.host;
    }
    return null;
  } catch {
    return null;
  }
}

function toBase64Url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Minimal MD5 (hex) implementation for Deno Edge runtime (no external deps)
// Based on a small public-domain JS implementation pattern.
function md5Hex(input: string): string {
  function add32(a: number, b: number) {
    return (a + b) & 0xffffffff;
  }

  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }

  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(c ^ (b | ~d), a, b, x, s, t);
  }

  function md5cycle(state: number[], k: number[]) {
    let [a, b, c, d] = state;

    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);

    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);

    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);

    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);

    state[0] = add32(state[0], a);
    state[1] = add32(state[1], b);
    state[2] = add32(state[2], c);
    state[3] = add32(state[3], d);
  }

  function md5blk(s: string) {
    const blocks: number[] = [];
    for (let i = 0; i < 64; i += 4) {
      blocks[i >> 2] =
        s.charCodeAt(i) |
        (s.charCodeAt(i + 1) << 8) |
        (s.charCodeAt(i + 2) << 16) |
        (s.charCodeAt(i + 3) << 24);
    }
    return blocks;
  }

  function md51(s: string) {
    const n = s.length;
    const state = [1732584193, -271733879, -1732584194, 271733878];
    let i: number;
    for (i = 64; i <= n; i += 64) {
      md5cycle(state, md5blk(s.substring(i - 64, i)));
    }
    s = s.substring(i - 64);
    const tail = new Array(16).fill(0);
    for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) {
      md5cycle(state, tail);
      for (i = 0; i < 16; i++) tail[i] = 0;
    }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
  }

  function rhex(n: number) {
    const s = "0123456789abcdef";
    let j = 0;
    let out = "";
    for (; j < 4; j++) out += s.charAt((n >> (j * 8 + 4)) & 0x0f) + s.charAt((n >> (j * 8)) & 0x0f);
    return out;
  }

  const x = md51(input);
  return rhex(x[0]) + rhex(x[1]) + rhex(x[2]) + rhex(x[3]);
}

type BunnyTokenAlgo = "sha256" | "md5";

// Sign a Bunny CDN URL using Token Authentication.
// NOTE: Pull Zones can be configured for MD5 *or* SHA256; we support both.
async function signBunnyCdnUrl(
  url: string,
  expiresInSeconds: number = 3600,
  algo: BunnyTokenAlgo = "sha256"
): Promise<string> {
  if (!BUNNY_STREAM_TOKEN_AUTH_KEY) {
    console.log("No Token Auth Key configured, returning unsigned URL");
    return url;
  }
  
  const urlObj = new URL(url);
  const path = urlObj.pathname;
  const expirationTime = Math.floor(Date.now() / 1000) + expiresInSeconds;
  
  // Hashable base (query params intentionally excluded; token auth uses path + expires)
  const hashableBase = BUNNY_STREAM_TOKEN_AUTH_KEY + path + expirationTime;

  let token: string;
  if (algo === "md5") {
    token = md5Hex(hashableBase);
  } else {
    const data = new TextEncoder().encode(hashableBase);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    token = toBase64Url(new Uint8Array(hashBuffer));
  }
  
  // Add token and expires to URL.
  // Bunny supports configurable token parameter names; many setups expect `bcdn_token`.
  // We set both to be compatible across configurations.
  urlObj.searchParams.set("token", token);
  urlObj.searchParams.set("bcdn_token", token);
  urlObj.searchParams.set("expires", expirationTime.toString());
  
  const signedUrl = urlObj.toString();
  console.log(
    `Signed URL (${algo}, expires in ${expiresInSeconds}s): ${signedUrl.substring(0, 90)}...`
  );
  
  return signedUrl;
}

async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await anon.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;

  return data.claims.sub as string;
}

// Upload video to Bunny Stream for HLS transcoding
async function uploadToBunnyStream(
  fileName: string,
  fileBuffer: ArrayBuffer,
  _projectId: string
): Promise<{ videoId: string; streamUrl: string; thumbnailUrl: string }> {
  console.log(`Creating video in Bunny Stream library ${BUNNY_STREAM_LIBRARY_ID}`);
  
  // Step 1: Create video entry in Bunny Stream
  const createResponse = await fetch(
    `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos`,
    {
      method: "POST",
      headers: {
        "AccessKey": BUNNY_STREAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: fileName,
      }),
    }
  );

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error("Bunny Stream create error:", errorText);
    throw new Error(`Bunny Stream create failed: ${createResponse.status} ${errorText}`);
  }

  const videoData = await createResponse.json();
  const videoId = videoData.guid;
  
  console.log(`Video created with ID: ${videoId}. Uploading file...`);

  // Step 2: Upload the actual video file
  const uploadResponse = await fetch(
    `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`,
    {
      method: "PUT",
      headers: {
        "AccessKey": BUNNY_STREAM_API_KEY,
        "Content-Type": "application/octet-stream",
      },
      body: fileBuffer,
    }
  );

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error("Bunny Stream upload error:", errorText);
    throw new Error(`Bunny Stream upload failed: ${uploadResponse.status} ${errorText}`);
  }

  console.log(`Video uploaded successfully. Video ID: ${videoId}`);

  const cdnHost = getStreamCdnHost();
  const hlsUrl = `https://${cdnHost}/${videoId}/playlist.m3u8`;
  const thumbnailUrl = `https://${cdnHost}/${videoId}/thumbnail.jpg`;

  return {
    videoId,
    streamUrl: hlsUrl,
    thumbnailUrl,
  };
}

// Get Bunny Stream video status and URLs
async function getBunnyStreamStatus(videoId: string): Promise<any> {
  const response = await fetch(
    `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`,
    {
      method: "GET",
      headers: {
        "AccessKey": BUNNY_STREAM_API_KEY,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get stream status: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const cdnHost = getStreamCdnHost();
  
  return {
    videoId: data.guid,
    status: data.status, // 0=created, 1=uploaded, 2=processing, 3=transcoding, 4=finished, 5=error
    isReady: data.status === 4,
    hlsUrl: `https://${cdnHost}/${data.guid}/playlist.m3u8`,
    thumbnailUrl: `https://${cdnHost}/${data.guid}/thumbnail.jpg`,
    mp4Url: data.mp4Fallback ? `https://${cdnHost}/${data.guid}/play_720p.mp4` : null,
    iframeUrl: `https://iframe.mediadelivery.net/embed/${BUNNY_STREAM_LIBRARY_ID}/${data.guid}`,
    duration: data.length,
    width: data.width,
    height: data.height,
  };
}

// Delete video from Bunny Stream
async function deleteFromBunnyStream(videoId: string): Promise<void> {
  console.log(`Deleting video ${videoId} from Bunny Stream`);
  
  const response = await fetch(
    `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`,
    {
      method: "DELETE",
      headers: {
        "AccessKey": BUNNY_STREAM_API_KEY,
      },
    }
  );

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    console.error("Bunny Stream delete error:", errorText);
    throw new Error(`Bunny Stream delete failed: ${response.status} ${errorText}`);
  }

  console.log("Video deleted from Bunny Stream successfully");
}

async function uploadToBunny(
  fileName: string,
  fileBuffer: ArrayBuffer,
  projectId: string
): Promise<string> {
  const fileExt = fileName.split('.').pop() || '';
  const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
  const storagePath = `${projectId}/${uniqueName}`;

  const uploadUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${storagePath}`;

  console.log(`Uploading to Bunny Storage: ${uploadUrl}`);

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "AccessKey": BUNNY_API_KEY,
      "Content-Type": "application/octet-stream",
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Bunny upload error:", errorText);
    throw new Error(`Bunny upload failed: ${response.status} ${errorText}`);
  }

  const cdnUrl = `${BUNNY_CDN_URL.replace(/\/$/, '')}/${storagePath}`;
  console.log(`File uploaded successfully. CDN URL: ${cdnUrl}`);
  return cdnUrl;
}

async function deleteFromBunny(fileUrl: string): Promise<void> {
  const cdnBase = BUNNY_CDN_URL.replace(/\/$/, '');
  if (!fileUrl.startsWith(cdnBase)) {
    console.log("File URL doesn't match Bunny CDN, skipping Bunny delete:", fileUrl);
    return;
  }

  const storagePath = fileUrl.replace(cdnBase + '/', '');
  const deleteUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${storagePath}`;

  console.log(`Deleting from Bunny: ${deleteUrl}`);

  const response = await fetch(deleteUrl, {
    method: "DELETE",
    headers: {
      "AccessKey": BUNNY_API_KEY,
    },
  });

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    console.error("Bunny delete error:", errorText);
    throw new Error(`Bunny delete failed: ${response.status} ${errorText}`);
  }

  console.log("File deleted from Bunny successfully");
}

// Check if URL is a Bunny Stream HLS URL
function isBunnyStreamUrl(url: string): boolean {
  return url.includes('.b-cdn.net/') && url.includes('/playlist.m3u8');
}

// Extract video ID from Bunny Stream URL
function extractStreamVideoId(url: string): string | null {
  // URL format: https://vz-XXXXXXXX.b-cdn.net/{videoId}/playlist.m3u8
  const match = url.match(/\.b-cdn\.net\/([a-f0-9-]+)\//);
  if (match) return match[1];
  
  // Also try to match GUID directly
  const guidMatch = url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return guidMatch ? guidMatch[1] : null;
}

// Sanitize filename for download (remove invalid characters)
function sanitizeFilename(filename: string): string {
  // Remove characters that are invalid in filenames
  let sanitized = filename.replace(/[/\\:*?"<>|]/g, '_');
  
  // Ensure it ends with .mp4
  if (!sanitized.toLowerCase().endsWith('.mp4')) {
    // Remove any existing extension and add .mp4
    const lastDot = sanitized.lastIndexOf('.');
    if (lastDot > 0) {
      sanitized = sanitized.substring(0, lastDot);
    }
    sanitized = sanitized + '.mp4';
  }
  
  return sanitized || 'video.mp4';
}

// Proxy download for Bunny Stream videos with proper filename
async function handleDownloadStream(
  deliverableId: string,
  // deno-lint-ignore no-explicit-any
  service: any
): Promise<Response> {
  console.log(`Downloading stream video for deliverable: ${deliverableId}`);
  
  // Fetch deliverable details
  const { data: deliverable, error: deliverableError } = await service
    .from("deliverables")
    .select("id, file_url, file_name, project_id")
    .eq("id", deliverableId)
    .maybeSingle();
  
  if (deliverableError) throw deliverableError;
  if (!deliverable) {
    return new Response(JSON.stringify({ error: "Deliverable not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  // Extract video ID
  const fileUrl = deliverable.file_url as string;
  const fileName = deliverable.file_name as string;
  
  const videoId = extractStreamVideoId(fileUrl);
  if (!videoId) {
    return new Response(JSON.stringify({ error: "Could not extract video ID from URL" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  console.log(`Extracted video ID: ${videoId}`);

  const pullZoneHostFromUrl = getStreamPullZoneHostFromFileUrl(fileUrl);
  const pullZoneHost = pullZoneHostFromUrl || getStreamCdnHost();
  if (pullZoneHostFromUrl) {
    console.log(`Detected Stream Pull Zone host from file_url: ${pullZoneHostFromUrl}`);
  } else {
    console.log(`No Pull Zone host detected from file_url; falling back to: ${pullZoneHost}`);
  }
  
  // Use Bunny Stream Video API to get the video download
  // First, try to fetch the original file using the Video API's direct storage path
  // The Stream Video API endpoint provides authenticated access
  const videoApiUrl = `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`;
  
  console.log(`Checking video status from: ${videoApiUrl}`);
  
  // First get video info to confirm it exists and is ready
  const videoInfoResponse = await fetch(videoApiUrl, {
    method: "GET",
    headers: {
      "AccessKey": BUNNY_STREAM_API_KEY,
    },
  });
  
  if (!videoInfoResponse.ok) {
    console.error(`Video API fetch failed: ${videoInfoResponse.status}`);
    return new Response(JSON.stringify({ 
      error: `Video not found: ${videoInfoResponse.status}` 
    }), {
      status: videoInfoResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  const videoInfo = await videoInfoResponse.json();
  console.log(`Video status: ${videoInfo.status}, Original stored: ${videoInfo.storageSize}, MP4 Fallback: ${videoInfo.mp4Fallback}`);
  
  // Get available resolutions from the video info
  const availableResolutions = videoInfo.availableResolutions?.split(',') || [];
  console.log(`Available resolutions: ${availableResolutions.join(', ')}`);
  
  // Strategy 1: Use Bunny Storage API directly with the Stream API key
  // For Bunny Stream, storage access uses: https://video.bunnycdn.com/library/{libraryId}/videos/{videoId}
  // But for direct file access, we need the storage URL with proper auth
  // The storage path for Stream is under the library ID as a pseudo-storage-zone
  
  // First, try to get the direct download URL from video info if available
  let bunnyResponse: Response | null = null;
  let downloadSucceeded = false;
  
  // Strategy 1: Try HLS origin download (authenticated via API)
  // Bunny Stream stores originals at: /{libraryId}/{videoId}/original
  const storageUrl = `https://${BUNNY_STREAM_LIBRARY_ID}.b-cdn.net/${videoId}/original`;
  console.log(`Trying Stream CDN storage: ${storageUrl}`);
  
  bunnyResponse = await fetch(storageUrl);
  
  if (bunnyResponse.ok) {
    downloadSucceeded = true;
    console.log(`Stream CDN storage download succeeded`);
  } else {
    console.log(`Stream CDN storage failed (${bunnyResponse.status}), trying direct storage API...`);
    
    // Strategy 2: Try direct Bunny Video API download endpoint
    // Some Bunny Stream setups allow direct download through the API
    const directDownloadUrl = `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}/play`;
    console.log(`Trying Video API direct: ${directDownloadUrl}`);
    
    bunnyResponse = await fetch(directDownloadUrl, {
      headers: { "AccessKey": BUNNY_STREAM_API_KEY },
    });
    
    if (bunnyResponse.ok && bunnyResponse.headers.get("content-type")?.includes("video")) {
      downloadSucceeded = true;
      console.log(`Video API direct download succeeded`);
    } else {
      console.log(`Video API direct failed (${bunnyResponse.status}), trying mp4_source redirect discovery...`);

      // Strategy 2b: Use the public player endpoint to discover the MP4 source.
      // This often responds with a redirect to the actual CDN mp4 file (which may be token-protected).
      const mp4SourceUrl = `https://video.bunnycdn.com/play/${BUNNY_STREAM_LIBRARY_ID}/${videoId}/mp4_source`;
      console.log(`Trying mp4_source discovery: ${mp4SourceUrl}`);

      const mp4SourceResp = await fetch(mp4SourceUrl, { redirect: "manual" });
      const redirectStatuses = new Set([301, 302, 303, 307, 308]);
      const location = redirectStatuses.has(mp4SourceResp.status)
        ? mp4SourceResp.headers.get("location")
        : null;

      if (location) {
        console.log(`mp4_source redirected to: ${location}`);
        const signedSha = await signBunnyCdnUrl(location, 3600, "sha256");
        console.log(`Trying signed mp4_source redirect (sha256): ${signedSha.substring(0, 80)}...`);
        bunnyResponse = await fetch(signedSha);
        if (!bunnyResponse.ok && bunnyResponse.status === 403) {
          try { await bunnyResponse.text(); } catch { /* ignore */ }
          const signedMd5 = await signBunnyCdnUrl(location, 3600, "md5");
          console.log(`SHA256 signed mp4_source redirect returned 403; retrying MD5: ${signedMd5.substring(0, 80)}...`);
          bunnyResponse = await fetch(signedMd5);
        }

        if (bunnyResponse.ok && bunnyResponse.headers.get("content-type")?.includes("video")) {
          downloadSucceeded = true;
          console.log(`mp4_source redirect download succeeded`);
        } else {
          console.log(`mp4_source redirect download failed (${bunnyResponse.status}), trying Pull Zone CDN with signed URL...`);
        }
      } else if (mp4SourceResp.ok && mp4SourceResp.headers.get("content-type")?.includes("video")) {
        // In some setups this might return a video body directly.
        bunnyResponse = mp4SourceResp;
        downloadSucceeded = true;
        console.log(`mp4_source direct download succeeded`);
      } else {
        try { await mp4SourceResp.text(); } catch { /* ignore */ }
        console.log(`mp4_source discovery failed (${mp4SourceResp.status}), trying Pull Zone CDN with signed URL...`);
      }

      if (downloadSucceeded) {
        // Skip remaining fallback attempts
      }

      if (!downloadSucceeded) {
        console.log(`Trying Pull Zone CDN with signed URL...`);
      
        // Strategy 3: Try the Stream Pull Zone CDN with signed URL
        // IMPORTANT: use the real pull zone hostname (from the deliverable's playlist URL)
        const cdnHost = pullZoneHost;
        const originalUrl = `https://${cdnHost}/${videoId}/original`;
      
        // Sign the URL for Token Authentication.
        // Pull Zones can be configured for SHA256 or MD5. We'll try SHA256 first, then fallback to MD5 if 403.
        const signedOriginalUrlSha = await signBunnyCdnUrl(originalUrl, 3600, "sha256");
        console.log(`Trying signed Pull Zone CDN (sha256): ${signedOriginalUrlSha.substring(0, 80)}...`);
        
        bunnyResponse = await fetch(signedOriginalUrlSha);
        if (!bunnyResponse.ok && bunnyResponse.status === 403) {
          try { await bunnyResponse.text(); } catch { /* ignore */ }
          const signedOriginalUrlMd5 = await signBunnyCdnUrl(originalUrl, 3600, "md5");
          console.log(`SHA256 signed URL returned 403; retrying with MD5: ${signedOriginalUrlMd5.substring(0, 80)}...`);
          bunnyResponse = await fetch(signedOriginalUrlMd5);
        }
      
        if (bunnyResponse.ok) {
          downloadSucceeded = true;
          console.log(`Signed Pull Zone CDN download succeeded`);
        } else {
          console.log(`Signed Pull Zone CDN original failed (${bunnyResponse.status}), trying signed MP4 fallbacks...`);
        
          // Strategy 4: Try signed MP4 fallbacks if enabled
        if (videoInfo.mp4Fallback) {
          // Try resolutions in order of quality
          const resolutionsToTry = ['1080', '720', '480', '360'];
          
          for (const res of resolutionsToTry) {
            if (availableResolutions.includes(res) || availableResolutions.length === 0) {
              const fallbackUrl = `https://${cdnHost}/${videoId}/play_${res}p.mp4`;
               const signedFallbackUrlSha = await signBunnyCdnUrl(fallbackUrl, 3600, "sha256");
               console.log(`Trying signed MP4 fallback ${res}p (sha256): ${signedFallbackUrlSha.substring(0, 80)}...`);
               
               let fallbackResponse = await fetch(signedFallbackUrlSha);
               if (!fallbackResponse.ok && fallbackResponse.status === 403) {
                 try { await fallbackResponse.text(); } catch { /* ignore */ }
                 const signedFallbackUrlMd5 = await signBunnyCdnUrl(fallbackUrl, 3600, "md5");
                 console.log(`SHA256 MP4 fallback returned 403; retrying MD5: ${signedFallbackUrlMd5.substring(0, 80)}...`);
                 fallbackResponse = await fetch(signedFallbackUrlMd5);
               }
              if (fallbackResponse.ok) {
                bunnyResponse = fallbackResponse;
                downloadSucceeded = true;
                console.log(`Signed MP4 fallback ${res}p succeeded`);
                break;
              }
            }
          }
        }
        
          // Strategy 5: Try iframe embed source extraction (last resort)
          if (!downloadSucceeded) {
            console.log(`All standard methods failed. Trying embed page extraction...`);
          
          // The embed page might have a direct source URL we can parse
          const embedUrl = `https://iframe.mediadelivery.net/embed/${BUNNY_STREAM_LIBRARY_ID}/${videoId}`;
          const embedResponse = await fetch(embedUrl);
          
          if (embedResponse.ok) {
            const embedHtml = await embedResponse.text();
            // Try to extract the HLS or MP4 source from the embed page
            const sourceMatch = embedHtml.match(/https:\/\/[^"'\s]+\.m3u8/);
            if (sourceMatch) {
              console.log(`Found HLS source: ${sourceMatch[0]}`);
              // HLS files can't be downloaded directly, inform user
            }
          }
          }
        }
      }
    }
  }
  
  if (!downloadSucceeded || !bunnyResponse || !bunnyResponse.ok) {
    console.error(`All download attempts failed`);
    
    // Provide detailed error with configuration suggestions
    const errorDetails = {
      error: `Unable to download video file.`,
      details: `The video exists (status: ${videoInfo.status}) but download access is restricted.`,
      suggestions: [
        "Enable 'MP4 Fallback' in your Bunny Stream library settings",
        "Disable 'Token Authentication' on the Stream Pull Zone, OR",
        "Ensure 'Keep Original Files' is enabled in Stream settings"
      ],
      videoStatus: videoInfo.status,
      mp4FallbackEnabled: videoInfo.mp4Fallback || false,
      originalStored: videoInfo.storageSize > 0
    };
    
    return new Response(JSON.stringify(errorDetails), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  // Sanitize filename
  const downloadFilename = sanitizeFilename(fileName || `video-${videoId}`);
  
  console.log(`Streaming video as: ${downloadFilename}, size: ${bunnyResponse.headers.get("Content-Length")}`);
  
  // Stream the response back with proper headers
  return new Response(bunnyResponse.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${downloadFilename}"`,
      "Content-Length": bunnyResponse.headers.get("Content-Length") || "",
    },
  });
}

const handler = async (req: Request): Promise<Response> => {
  // Log environment variables for debugging (redacted for security)
  console.log("Bunny Config Check:", {
    BUNNY_STORAGE_HOSTNAME: BUNNY_STORAGE_HOSTNAME || "UNDEFINED",
    BUNNY_STORAGE_ZONE: BUNNY_STORAGE_ZONE ? `${BUNNY_STORAGE_ZONE.slice(0, 4)}...` : "UNDEFINED",
    BUNNY_CDN_URL: BUNNY_CDN_URL ? `${BUNNY_CDN_URL.slice(0, 20)}...` : "UNDEFINED",
    BUNNY_API_KEY: BUNNY_API_KEY ? "SET (length: " + BUNNY_API_KEY.length + ")" : "UNDEFINED",
    BUNNY_STREAM_LIBRARY_ID: BUNNY_STREAM_LIBRARY_ID ? BUNNY_STREAM_LIBRARY_ID : "UNDEFINED",
    BUNNY_STREAM_API_KEY: BUNNY_STREAM_API_KEY ? "SET (length: " + BUNNY_STREAM_API_KEY.length + ")" : "UNDEFINED",
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check user role
    const { data: roleRow, error: roleError } = await service
      .from("user_roles")
      .select("role, agency_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleError) throw roleError;
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "No role found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = req.headers.get("content-type") || "";

    // Handle FormData for uploads
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const action = formData.get("action") as Action;
      const projectId = formData.get("projectId") as string;
      const file = formData.get("file") as File;
      const useStream = formData.get("useStream") === "true";

      if (action !== "upload") {
        return new Response(JSON.stringify({ error: "Invalid action for FormData" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!projectId || !file) {
        return new Response(JSON.stringify({ error: "Missing projectId or file" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify project exists and user has access
      const { data: project, error: projectError } = await service
        .from("projects")
        .select("id, agency_id, client_id, status")
        .eq("id", projectId)
        .maybeSingle();

      if (projectError) throw projectError;
      if (!project) {
        return new Response(JSON.stringify({ error: "Project not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check authorization: must be admin, editor on this project, or client who owns this project
      const { data: isEditor } = await service.rpc("is_project_editor", {
        _user_id: userId,
        _project_id: projectId,
      });

      // Check if user is the client who owns this project
      const isClientOwner = roleRow.role === "client" && project.client_id === userId;

      if (roleRow.role !== "admin" && !isEditor && !isClientOwner) {
        return new Response(JSON.stringify({ error: "Forbidden - you don't have permission to upload to this project" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fileBuffer = await file.arrayBuffer();
      const shouldUseStream = useStream && isVideoFile(file.name) && isBunnyStreamConfigured();

      if (shouldUseStream) {
        // Upload to Bunny Stream for HLS transcoding
        console.log(`Uploading video to Bunny Stream: ${file.name}`);
        const streamResult = await uploadToBunnyStream(file.name, fileBuffer, projectId);
        
        console.log(`Stream upload complete. HLS URL: ${streamResult.streamUrl}`);

        return new Response(
          JSON.stringify({
            ok: true,
            cdnUrl: streamResult.streamUrl,
            videoId: streamResult.videoId,
            thumbnailUrl: streamResult.thumbnailUrl,
            isStream: true,
            fileName: file.name,
            fileSize: file.size,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } else {
        // Upload to Bunny Storage
        const cdnUrl = await uploadToBunny(file.name, fileBuffer, projectId);
        console.log(`Upload complete. CDN URL: ${cdnUrl}`);

        return new Response(
          JSON.stringify({
            ok: true,
            cdnUrl,
            isStream: false,
            fileName: file.name,
            fileSize: file.size,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Handle JSON for other operations
    const body = await req.json().catch(() => ({}));
    const action = body?.action as Action;

    if (action === "stream_status") {
      const videoId = body?.videoId as string;
      const fileUrl = body?.fileUrl as string;

      if (!videoId && !fileUrl) {
        return new Response(JSON.stringify({ error: "Missing videoId or fileUrl" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!isBunnyStreamConfigured()) {
        return new Response(JSON.stringify({ error: "Bunny Stream not configured" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract videoId from URL if not provided
      const resolvedVideoId = videoId || extractStreamVideoId(fileUrl);
      if (!resolvedVideoId) {
        return new Response(JSON.stringify({ error: "Could not determine video ID" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const status = await getBunnyStreamStatus(resolvedVideoId);

      return new Response(JSON.stringify({ ok: true, ...status }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle download_stream action - proxy download with proper filename
    if (action === "download_stream") {
      const deliverableId = body?.deliverableId as string;
      if (!deliverableId) {
        return new Response(JSON.stringify({ error: "Missing deliverableId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!isBunnyStreamConfigured()) {
        return new Response(JSON.stringify({ error: "Bunny Stream not configured" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify user has access to the deliverable's project
      const { data: deliverable } = await service
        .from("deliverables")
        .select("project_id")
        .eq("id", deliverableId)
        .maybeSingle();

      if (!deliverable) {
        return new Response(JSON.stringify({ error: "Deliverable not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check authorization
      const { data: project } = await service
        .from("projects")
        .select("id, agency_id, client_id")
        .eq("id", deliverable.project_id)
        .maybeSingle();

      if (!project) {
        return new Response(JSON.stringify({ error: "Project not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: isEditor } = await service.rpc("is_project_editor", {
        _user_id: userId,
        _project_id: deliverable.project_id,
      });

      const isClientOwner = roleRow.role === "client" && project.client_id === userId;

      if (roleRow.role !== "admin" && !isEditor && !isClientOwner) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return handleDownloadStream(deliverableId, service);
    }

    if (action === "delete") {
      const deliverableId = body?.deliverableId as string;
      if (!deliverableId) {
        return new Response(JSON.stringify({ error: "Missing deliverableId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: deliverable, error: deliverableError } = await service
        .from("deliverables")
        .select("id, file_url, project_id")
        .eq("id", deliverableId)
        .maybeSingle();

      if (deliverableError) throw deliverableError;
      if (!deliverable) {
        return new Response(JSON.stringify({ error: "Deliverable not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: isEditor } = await service.rpc("is_project_editor", {
        _user_id: userId,
        _project_id: deliverable.project_id,
      });

      if (roleRow.role !== "admin" && !isEditor) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if it's a Bunny Stream URL and delete accordingly
      if (isBunnyStreamUrl(deliverable.file_url) && isBunnyStreamConfigured()) {
        const videoId = extractStreamVideoId(deliverable.file_url);
        if (videoId) {
          await deleteFromBunnyStream(videoId);
        }
      } else {
        await deleteFromBunny(deliverable.file_url);
      }

      // Delete from database
      const { error: dbError } = await service
        .from("deliverables")
        .delete()
        .eq("id", deliverableId);

      if (dbError) throw dbError;

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in bunny-ops:", error);
    return new Response(
      JSON.stringify({ error: error.message ?? "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
