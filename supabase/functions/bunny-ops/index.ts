import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Action = "upload" | "delete";

// Get Bunny.net configuration from environment
const BUNNY_API_KEY = Deno.env.get("BUNNY_API_KEY")!;
const BUNNY_STORAGE_ZONE = Deno.env.get("BUNNY_STORAGE_ZONE")!;
const BUNNY_CDN_URL = Deno.env.get("BUNNY_CDN_URL")!;
const BUNNY_STORAGE_HOSTNAME = Deno.env.get("BUNNY_STORAGE_HOSTNAME") || "storage.bunnycdn.com";

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

async function uploadToBunny(
  fileName: string,
  fileBuffer: ArrayBuffer,
  projectId: string
): Promise<string> {
  // Create a unique path: projectId/timestamp-randomstring.ext
  const fileExt = fileName.split('.').pop() || '';
  const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
  const storagePath = `${projectId}/${uniqueName}`;

  const uploadUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${storagePath}`;

  console.log(`Uploading to Bunny: ${uploadUrl}`);

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

  // Return the CDN URL
  const cdnUrl = `${BUNNY_CDN_URL.replace(/\/$/, '')}/${storagePath}`;
  console.log(`File uploaded successfully. CDN URL: ${cdnUrl}`);
  return cdnUrl;
}

async function deleteFromBunny(fileUrl: string): Promise<void> {
  // Extract the path from the CDN URL
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

const handler = async (req: Request): Promise<Response> => {
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

      // Check authorization: must be admin or editor on this project
      const { data: isEditor } = await service.rpc("is_project_editor", {
        _user_id: userId,
        _project_id: projectId,
      });

      if (roleRow.role !== "admin" && !isEditor) {
        return new Response(JSON.stringify({ error: "Forbidden - only admins and editors can upload" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upload to Bunny.net
      const fileBuffer = await file.arrayBuffer();
      const cdnUrl = await uploadToBunny(file.name, fileBuffer, projectId);

      console.log(`Upload complete. CDN URL: ${cdnUrl}`);

      return new Response(
        JSON.stringify({
          ok: true,
          cdnUrl,
          fileName: file.name,
          fileSize: file.size,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle JSON for delete operations
    const body = await req.json().catch(() => ({}));
    const action = body?.action as Action;

    if (action === "delete") {
      const deliverableId = body?.deliverableId as string;
      if (!deliverableId) {
        return new Response(JSON.stringify({ error: "Missing deliverableId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get the deliverable
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

      // Check authorization
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

      // Delete from Bunny.net (if it's a Bunny URL)
      await deleteFromBunny(deliverable.file_url);

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
