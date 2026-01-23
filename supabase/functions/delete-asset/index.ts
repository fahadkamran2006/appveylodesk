import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Bunny Storage configuration
const BUNNY_API_KEY = Deno.env.get("BUNNY_API_KEY")!;
const BUNNY_STORAGE_ZONE = Deno.env.get("BUNNY_STORAGE_ZONE")!;
const BUNNY_CDN_URL = Deno.env.get("BUNNY_CDN_URL")!;
const BUNNY_STORAGE_HOSTNAME = Deno.env.get("BUNNY_STORAGE_HOSTNAME") || "storage.bunnycdn.com";

// Bunny Stream configuration
const BUNNY_STREAM_API_KEY = Deno.env.get("BUNNY_STREAM_API_KEY") || "";
const BUNNY_STREAM_LIBRARY_ID = Deno.env.get("BUNNY_STREAM_LIBRARY_ID") || "";

function isBunnyStreamConfigured(): boolean {
  return Boolean(BUNNY_STREAM_API_KEY && BUNNY_STREAM_LIBRARY_ID);
}

// Check if URL is a Bunny Stream HLS URL
function isBunnyStreamUrl(url: string): boolean {
  return url.includes('.b-cdn.net/') && url.includes('/playlist.m3u8');
}

// Extract video ID from Bunny Stream URL
function extractStreamVideoId(url: string): string | null {
  // URL format: https://vz-XXXXXXXX.b-cdn.net/{videoId}/playlist.m3u8
  const match = url.match(/\.b-cdn\.net\/([a-f0-9-]+)\//);
  return match ? match[1] : null;
}

// Delete from Bunny Stream
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
    throw new Error(`Bunny Stream delete failed: ${response.status}`);
  }

  console.log("Video deleted from Bunny Stream successfully");
}

// Delete from Bunny Storage
async function deleteFromBunnyStorage(fileUrl: string): Promise<void> {
  const cdnBase = BUNNY_CDN_URL.replace(/\/$/, '');
  if (!fileUrl.startsWith(cdnBase)) {
    console.log("File URL doesn't match Bunny CDN, skipping:", fileUrl);
    return;
  }

  const storagePath = fileUrl.replace(cdnBase + '/', '');
  const deleteUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${storagePath}`;

  console.log(`Deleting from Bunny Storage: ${deleteUrl}`);

  const response = await fetch(deleteUrl, {
    method: "DELETE",
    headers: {
      "AccessKey": BUNNY_API_KEY,
    },
  });

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    console.error("Bunny Storage delete error:", errorText);
    throw new Error(`Bunny Storage delete failed: ${response.status}`);
  }

  console.log("File deleted from Bunny Storage successfully");
}

// Delete a single file from Bunny (auto-detect storage vs stream)
async function deleteFromBunny(fileUrl: string): Promise<void> {
  if (isBunnyStreamUrl(fileUrl) && isBunnyStreamConfigured()) {
    const videoId = extractStreamVideoId(fileUrl);
    if (videoId) {
      await deleteFromBunnyStream(videoId);
    }
  } else if (fileUrl.includes('b-cdn.net') || fileUrl.includes('bunnycdn')) {
    await deleteFromBunnyStorage(fileUrl);
  } else {
    console.log("Unknown file URL format, skipping Bunny delete:", fileUrl);
  }
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
  console.log("delete-asset: Request received");

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

    const body = await req.json();
    const { action, deliverableId, projectId, fileUrls } = body;

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

    // DELETE SINGLE FILE
    if (action === "delete_file" && deliverableId) {
      // Fetch deliverable
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

      // Check permission
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

      // Delete from Bunny
      await deleteFromBunny(deliverable.file_url);

      // Delete from database
      const { error: dbError } = await service
        .from("deliverables")
        .delete()
        .eq("id", deliverableId);

      if (dbError) throw dbError;

      console.log(`Deliverable ${deliverableId} deleted successfully`);

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE PROJECT FILES (bulk delete all deliverables for a project)
    if (action === "delete_project_files" && projectId) {
      // Verify project exists and user has permission
      const { data: project, error: projectError } = await service
        .from("projects")
        .select("id, agency_id")
        .eq("id", projectId)
        .maybeSingle();

      if (projectError) throw projectError;
      if (!project) {
        return new Response(JSON.stringify({ error: "Project not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Only admin can delete all project files
      if (roleRow.role !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden - admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch all deliverables for this project
      const { data: deliverables, error: fetchError } = await service
        .from("deliverables")
        .select("id, file_url")
        .eq("project_id", projectId);

      if (fetchError) throw fetchError;

      console.log(`Deleting ${deliverables?.length || 0} files for project ${projectId}`);

      // Delete each file from Bunny
      const deletePromises = (deliverables || []).map(async (d) => {
        try {
          await deleteFromBunny(d.file_url);
        } catch (err) {
          console.error(`Failed to delete ${d.file_url}:`, err);
        }
      });

      await Promise.all(deletePromises);

      // Delete all deliverables from database
      const { error: dbError } = await service
        .from("deliverables")
        .delete()
        .eq("project_id", projectId);

      if (dbError) throw dbError;

      console.log(`All files for project ${projectId} deleted successfully`);

      return new Response(JSON.stringify({ ok: true, deletedCount: deliverables?.length || 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE MULTIPLE FILES by URL (for bulk delete operations)
    if (action === "delete_bulk" && Array.isArray(fileUrls)) {
      // Admin-only operation
      if (roleRow.role !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden - admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Bulk deleting ${fileUrls.length} files`);

      const deletePromises = fileUrls.map(async (url: string) => {
        try {
          await deleteFromBunny(url);
        } catch (err) {
          console.error(`Failed to delete ${url}:`, err);
        }
      });

      await Promise.all(deletePromises);

      return new Response(JSON.stringify({ ok: true, deletedCount: fileUrls.length }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("delete-asset error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
