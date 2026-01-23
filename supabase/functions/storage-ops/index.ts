import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Bunny Storage configuration
const BUNNY_API_KEY = Deno.env.get("BUNNY_API_KEY") || "";
const BUNNY_STORAGE_ZONE = Deno.env.get("BUNNY_STORAGE_ZONE") || "";
const BUNNY_CDN_URL = Deno.env.get("BUNNY_CDN_URL") || "";
const BUNNY_STORAGE_HOSTNAME = Deno.env.get("BUNNY_STORAGE_HOSTNAME") || "storage.bunnycdn.com";

// Bunny Stream configuration
const BUNNY_STREAM_API_KEY = Deno.env.get("BUNNY_STREAM_API_KEY") || "";
const BUNNY_STREAM_LIBRARY_ID = Deno.env.get("BUNNY_STREAM_LIBRARY_ID") || "";

function isBunnyStorageConfigured(): boolean {
  return Boolean(BUNNY_API_KEY && BUNNY_STORAGE_ZONE);
}

function isBunnyStreamConfigured(): boolean {
  return Boolean(BUNNY_STREAM_API_KEY && BUNNY_STREAM_LIBRARY_ID);
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
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data?.user?.id) return null;

  return data.user.id;
}

// Fetch storage zone usage from Bunny Storage API
async function getBunnyStorageUsage(): Promise<number> {
  if (!isBunnyStorageConfigured()) {
    console.log("Bunny Storage not configured");
    return 0;
  }

  try {
    // List all files recursively and sum their sizes
    const listUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/`;
    const response = await fetch(listUrl, {
      headers: { AccessKey: BUNNY_API_KEY },
    });

    if (!response.ok) {
      console.error("Failed to list Bunny Storage files:", await response.text());
      return 0;
    }

    const files = await response.json();
    return calculateTotalSize(files);
  } catch (error) {
    console.error("Bunny Storage usage error:", error);
    return 0;
  }
}

// Recursively calculate total size of files/folders
function calculateTotalSize(items: any[]): number {
  let total = 0;
  for (const item of items) {
    if (item.IsDirectory) {
      // For directories, we'd need to fetch recursively, but for now just use Length if available
      total += item.Length || 0;
    } else {
      total += item.Length || 0;
    }
  }
  return total;
}

// Fetch library stats from Bunny Stream API
async function getBunnyStreamUsage(): Promise<number> {
  if (!isBunnyStreamConfigured()) {
    console.log("Bunny Stream not configured");
    return 0;
  }

  try {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}`,
      {
        headers: { AccessKey: BUNNY_STREAM_API_KEY },
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch Bunny Stream library:", await response.text());
      return 0;
    }

    const library = await response.json();
    return library.StorageUsage || 0;
  } catch (error) {
    console.error("Bunny Stream usage error:", error);
    return 0;
  }
}

// List all files from Bunny Storage
async function listBunnyStorageFiles(path: string = ""): Promise<any[]> {
  if (!isBunnyStorageConfigured()) return [];

  try {
    const listUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${path}`;
    const response = await fetch(listUrl, {
      headers: { AccessKey: BUNNY_API_KEY },
    });

    if (!response.ok) {
      console.error("Failed to list storage:", await response.text());
      return [];
    }

    const items = await response.json();
    const allFiles: any[] = [];

    for (const item of items) {
      if (item.IsDirectory) {
        // Recursively fetch subdirectory
        const subPath = path ? `${path}${item.ObjectName}/` : `${item.ObjectName}/`;
        const subFiles = await listBunnyStorageFiles(subPath);
        allFiles.push(...subFiles);
      } else {
        allFiles.push({
          path: path + item.ObjectName,
          size: item.Length || 0,
          lastChanged: item.LastChanged,
          fullUrl: `${BUNNY_CDN_URL}/${path}${item.ObjectName}`,
        });
      }
    }

    return allFiles;
  } catch (error) {
    console.error("Error listing Bunny Storage:", error);
    return [];
  }
}

// List all videos from Bunny Stream
async function listBunnyStreamVideos(): Promise<any[]> {
  if (!isBunnyStreamConfigured()) return [];

  try {
    const allVideos: any[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await fetch(
        `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos?page=${page}&itemsPerPage=${perPage}`,
        {
          headers: { AccessKey: BUNNY_STREAM_API_KEY },
        }
      );

      if (!response.ok) {
        console.error("Failed to list Stream videos:", await response.text());
        break;
      }

      const data = await response.json();
      const videos = data.items || [];
      
      for (const video of videos) {
        allVideos.push({
          id: video.guid,
          title: video.title,
          size: video.storageSize || 0,
          created: video.dateUploaded,
          // Construct the HLS URL that would be stored in DB
          hlsUrl: `https://vz-${BUNNY_STREAM_LIBRARY_ID.substring(0, 8)}.b-cdn.net/${video.guid}/playlist.m3u8`,
        });
      }

      if (videos.length < perPage) break;
      page++;
    }

    return allVideos;
  } catch (error) {
    console.error("Error listing Bunny Stream:", error);
    return [];
  }
}

// Delete file from Bunny Storage
async function deleteFromBunnyStorage(path: string): Promise<boolean> {
  const deleteUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${path}`;
  
  try {
    const response = await fetch(deleteUrl, {
      method: "DELETE",
      headers: { AccessKey: BUNNY_API_KEY },
    });

    return response.ok || response.status === 404;
  } catch (error) {
    console.error("Delete storage error:", error);
    return false;
  }
}

// Delete video from Bunny Stream
async function deleteFromBunnyStream(videoId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`,
      {
        method: "DELETE",
        headers: { AccessKey: BUNNY_STREAM_API_KEY },
      }
    );

    return response.ok || response.status === 404;
  } catch (error) {
    console.error("Delete stream error:", error);
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  console.log("storage-ops: Request received");

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

    // Check user role - only admin can access these operations
    const { data: roleRow, error: roleError } = await service
      .from("user_roles")
      .select("role, agency_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleError) throw roleError;
    if (!roleRow || roleRow.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // GET PROVIDER-BASED USAGE
    if (action === "get_usage") {
      console.log("Fetching usage from Bunny providers...");
      
      const [storageBytes, streamBytes] = await Promise.all([
        getBunnyStorageUsage(),
        getBunnyStreamUsage(),
      ]);

      const totalBytes = storageBytes + streamBytes;

      // Get agency storage limit
      const { data: agency } = await service
        .from("agencies")
        .select("storage_limit_bytes, subscription_plan")
        .eq("id", roleRow.agency_id)
        .single();

      return new Response(
        JSON.stringify({
          ok: true,
          storageBytes,
          streamBytes,
          totalBytes,
          limitBytes: agency?.storage_limit_bytes || 0,
          plan: agency?.subscription_plan || "starter",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // LIST ORPHAN FILES
    if (action === "list_orphans") {
      console.log("Scanning for orphan files...");

      // Get all file URLs from database
      const { data: deliverables } = await service
        .from("deliverables")
        .select("file_url")
        .not("file_url", "is", null);

      const dbUrls = new Set((deliverables || []).map((d) => d.file_url));

      // Get all files from Bunny providers
      const [storageFiles, streamVideos] = await Promise.all([
        listBunnyStorageFiles(),
        listBunnyStreamVideos(),
      ]);

      // Find orphans (on Bunny but not in DB)
      const orphanStorageFiles = storageFiles.filter((f) => !dbUrls.has(f.fullUrl));
      const orphanStreamVideos = streamVideos.filter((v) => !dbUrls.has(v.hlsUrl));

      const totalOrphanSize =
        orphanStorageFiles.reduce((sum, f) => sum + f.size, 0) +
        orphanStreamVideos.reduce((sum, v) => sum + v.size, 0);

      return new Response(
        JSON.stringify({
          ok: true,
          orphanStorageFiles,
          orphanStreamVideos,
          totalOrphanCount: orphanStorageFiles.length + orphanStreamVideos.length,
          totalOrphanSize,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // DELETE ORPHAN FILES
    if (action === "delete_orphans") {
      const { storagePaths = [], streamVideoIds = [] } = body;
      
      console.log(`Deleting ${storagePaths.length} storage files and ${streamVideoIds.length} stream videos...`);

      let deletedStorage = 0;
      let deletedStream = 0;

      // Delete storage files
      for (const path of storagePaths) {
        const success = await deleteFromBunnyStorage(path);
        if (success) deletedStorage++;
      }

      // Delete stream videos
      for (const videoId of streamVideoIds) {
        const success = await deleteFromBunnyStream(videoId);
        if (success) deletedStream++;
      }

      return new Response(
        JSON.stringify({
          ok: true,
          deletedStorage,
          deletedStream,
          totalDeleted: deletedStorage + deletedStream,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // RECALCULATE STORAGE COUNTER
    if (action === "recalculate") {
      console.log("Recalculating agency storage counters...");

      const { error: rpcError } = await service.rpc("recalculate_agency_storage");
      
      if (rpcError) {
        console.error("Recalculate error:", rpcError);
        throw rpcError;
      }

      return new Response(
        JSON.stringify({ ok: true, message: "Storage counters recalculated" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("storage-ops error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
