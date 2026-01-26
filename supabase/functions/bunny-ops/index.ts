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
  // Bunny Stream uses vz-XXXXXXXX.b-cdn.net format where XXXXXXXX is first 8 chars of library ID
  return `vz-${BUNNY_STREAM_LIBRARY_ID.slice(0, 8)}.b-cdn.net`;
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
  
  // Build Bunny Storage API URL for the original file
  // Format: https://storage.bunnycdn.com/{LIBRARY_ID}/__videos/{videoId}/original
  const storageUrl = `https://storage.bunnycdn.com/${BUNNY_STREAM_LIBRARY_ID}/__videos/${videoId}/original`;
  
  console.log(`Fetching from Bunny Storage: ${storageUrl}`);
  
  // Fetch from Bunny Storage with API key
  const bunnyResponse = await fetch(storageUrl, {
    method: "GET",
    headers: {
      "AccessKey": BUNNY_STREAM_API_KEY,
    },
  });
  
  if (!bunnyResponse.ok) {
    console.error(`Bunny Storage fetch failed: ${bunnyResponse.status}`);
    return new Response(JSON.stringify({ 
      error: `Failed to fetch video from storage: ${bunnyResponse.status}` 
    }), {
      status: bunnyResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  // Sanitize filename
  const downloadFilename = sanitizeFilename(fileName || `video-${videoId}`);
  
  console.log(`Streaming video as: ${downloadFilename}`);
  
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
