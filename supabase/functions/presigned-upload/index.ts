import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-storage-path, x-upload-action",
  "Access-Control-Allow-Methods": "POST, PUT, OPTIONS",
};

// Get Bunny.net configuration from environment
const BUNNY_API_KEY = Deno.env.get("BUNNY_API_KEY")!;
const BUNNY_STORAGE_ZONE = Deno.env.get("BUNNY_STORAGE_ZONE")!;
const BUNNY_CDN_URL = Deno.env.get("BUNNY_CDN_URL")!;
const BUNNY_STORAGE_HOSTNAME = Deno.env.get("BUNNY_STORAGE_HOSTNAME") || "storage.bunnycdn.com";

// Bunny Stream configuration
const BUNNY_STREAM_API_KEY = Deno.env.get("BUNNY_STREAM_API_KEY") || "";
const BUNNY_STREAM_LIBRARY_ID = Deno.env.get("BUNNY_STREAM_LIBRARY_ID") || "";

// Video file extensions
const VIDEO_EXTENSIONS = [
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'm4v', 'flv', 'mpeg', 'mpg',
  'ts', 'mts', 'm2ts', '3gp', '3g2', 'ogv', 'vob', 'mxf', 'rm', 'rmvb',
  'asf', 'divx', 'f4v', 'swf', 'dv', 'qt', 'yuv', 'amv', 'mp2', 'mpv',
  'm2v', 'svi', 'mpe', 'nsv', 'f4p', 'f4a', 'f4b',
];

function isVideoFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return VIDEO_EXTENSIONS.includes(ext);
}

function isBunnyStreamConfigured(): boolean {
  return Boolean(BUNNY_STREAM_API_KEY && BUNNY_STREAM_LIBRARY_ID);
}

function getStreamCdnHost(): string {
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

const handler = async (req: Request): Promise<Response> => {
  console.log("presigned-upload: Request received", req.method);

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

    // Handle proxied file upload (PUT with binary body)
    if (req.method === "PUT" || req.headers.get("x-upload-action") === "upload") {
      const storagePath = req.headers.get("x-storage-path");
      if (!storagePath) {
        return new Response(JSON.stringify({ error: "Missing x-storage-path header" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fileBody = await req.arrayBuffer();
      if (!fileBody || fileBody.byteLength === 0) {
        return new Response(JSON.stringify({ error: "Empty file body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const uploadUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${storagePath}`;
      const bunnyResp = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "AccessKey": BUNNY_API_KEY,
          "Content-Type": "application/octet-stream",
        },
        body: fileBody,
      });

      if (!bunnyResp.ok) {
        const errText = await bunnyResp.text();
        console.error("Bunny Storage upload failed:", bunnyResp.status, errText);
        return new Response(JSON.stringify({ error: "CDN upload failed" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, projectId, fileName, fileSize, useStream } = body;

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check user role and permissions
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

    // INITIATE: Get presigned upload credentials
    if (action === "initiate") {
      if (!projectId || !fileName || !fileSize) {
        return new Response(JSON.stringify({ error: "Missing projectId, fileName, or fileSize" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify project exists and user has access
      const { data: project, error: projectError } = await service
        .from("projects")
        .select("id, agency_id, client_id")
        .eq("id", projectId)
        .maybeSingle();

      if (projectError) throw projectError;
      if (!project) {
        return new Response(JSON.stringify({ error: "Project not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check authorization
      const { data: isEditor } = await service.rpc("is_project_editor", {
        _user_id: userId,
        _project_id: projectId,
      });

      const isClientOwner = roleRow.role === "client" && project.client_id === userId;

      if (roleRow.role !== "admin" && !isEditor && !isClientOwner) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check storage limit
      const { data: limitOk } = await service.rpc("check_storage_limit", {
        _agency_id: project.agency_id,
        _file_size: fileSize,
      });

      if (!limitOk) {
        return new Response(JSON.stringify({ error: "Storage limit exceeded" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const shouldUseStream = useStream && isVideoFile(fileName) && isBunnyStreamConfigured();

      if (shouldUseStream) {
        // For Bunny Stream: Create video entry and return TUS upload URL
        console.log(`Creating Bunny Stream video for: ${fileName}`);
        
        const createResponse = await fetch(
          `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos`,
          {
            method: "POST",
            headers: {
              "AccessKey": BUNNY_STREAM_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ title: fileName }),
          }
        );

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          throw new Error(`Bunny Stream create failed: ${errorText}`);
        }

        const videoData = await createResponse.json();
        const videoId = videoData.guid;
        const cdnHost = getStreamCdnHost();

        // Generate TUS upload URL for resumable uploads
        // Use a single expiration timestamp to prevent mismatch
        const tusUploadUrl = `https://video.bunnycdn.com/tusupload`;
        const expirationTime = Math.floor(Date.now() / 1000) + 3600;
        const authorizationSignature = await generateTusSignature(BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_API_KEY, videoId, expirationTime);

        console.log(`TUS upload prepared for video ${videoId}, expires at ${expirationTime}`);

        return new Response(JSON.stringify({
          ok: true,
          uploadType: "stream",
          videoId,
          uploadUrl: tusUploadUrl,
          libraryId: BUNNY_STREAM_LIBRARY_ID,
          authorizationSignature,
          authorizationExpire: expirationTime,
          cdnUrl: `https://${cdnHost}/${videoId}/playlist.m3u8`,
          thumbnailUrl: `https://${cdnHost}/${videoId}/thumbnail.jpg`,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        // For Bunny Storage: Return upload metadata (NO secret key!)
        const fileExt = fileName.split('.').pop() || '';
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const storagePath = `${projectId}/${uniqueName}`;
        const cdnUrl = `${BUNNY_CDN_URL.replace(/\/$/, '')}/${storagePath}`;

        return new Response(JSON.stringify({
          ok: true,
          uploadType: "storage",
          cdnUrl,
          storagePath,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // FINALIZE: Save file record to database after successful upload
    if (action === "finalize") {
      const { cdnUrl, fileType = "deliverable" } = body;

      if (!projectId || !fileName || !fileSize || !cdnUrl) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get current version number
      const { data: existingDeliverables } = await service
        .from("deliverables")
        .select("version")
        .eq("project_id", projectId)
        .order("version", { ascending: false })
        .limit(1);

      const nextVersion = (existingDeliverables?.[0]?.version || 0) + 1;

      // Create deliverable record
      const { data: deliverable, error: dbError } = await service
        .from("deliverables")
        .insert({
          project_id: projectId,
          file_name: fileName,
          file_url: cdnUrl,
          file_size: fileSize,
          version: nextVersion,
          uploaded_by: userId,
          file_type: fileType,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      return new Response(JSON.stringify({
        ok: true,
        deliverable,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CLEANUP: Delete an orphaned Bunny Stream video (e.g. cancelled upload)
    if (action === "cleanup") {
      const { videoId } = body;
      if (!videoId) {
        return new Response(JSON.stringify({ error: "Missing videoId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Only allow cleanup if this video doesn't have a finalized deliverable
      const { data: existing } = await service
        .from("deliverables")
        .select("id")
        .ilike("file_url", `%${videoId}%`)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "Video is linked to a deliverable, cannot clean up" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete from Bunny Stream
      if (isBunnyStreamConfigured()) {
        try {
          const deleteResp = await fetch(
            `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`,
            {
              method: "DELETE",
              headers: { "AccessKey": BUNNY_STREAM_API_KEY },
            }
          );
          console.log(`Bunny Stream cleanup: video ${videoId}, status ${deleteResp.status}`);
        } catch (err) {
          console.error("Bunny Stream cleanup error:", err);
        }
      }

      return new Response(JSON.stringify({ ok: true, cleaned: videoId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("presigned-upload error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

// Generate SHA256-based authorization signature for TUS uploads
async function generateTusSignature(
  libraryId: string,
  apiKey: string,
  videoId: string,
  expirationTime: number
): Promise<string> {
  const message = libraryId + apiKey + expirationTime + videoId;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(handler);
