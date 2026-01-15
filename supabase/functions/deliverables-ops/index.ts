import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Action = "signed_url" | "rename" | "delete";

function extractDeliverablesPathFromUrl(fileUrl: string): string | null {
  if (!fileUrl) return null;

  // If it's already a storage path like "projectId/filename.ext"
  if (!/^https?:\/\//i.test(fileUrl)) {
    return decodeURIComponent(fileUrl.split("?")[0]);
  }

  const idx = fileUrl.indexOf("/deliverables/");
  if (idx === -1) return null;

  const path = fileUrl.slice(idx + "/deliverables/".length);
  return decodeURIComponent(path.split("?")[0]);
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

    const body = await req.json().catch(() => ({}));
    const action = body?.action as Action | undefined;
    const deliverableId = body?.deliverableId as string | undefined;

    if (!action || !deliverableId) {
      return new Response(JSON.stringify({ error: "Missing action or deliverableId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch deliverable + project
    const { data: deliverable, error: deliverableError } = await service
      .from("deliverables")
      .select("id, project_id, file_name, file_url")
      .eq("id", deliverableId)
      .maybeSingle();

    if (deliverableError) throw deliverableError;
    if (!deliverable) {
      return new Response(JSON.stringify({ error: "Deliverable not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: project, error: projectError } = await service
      .from("projects")
      .select("id, agency_id, client_id")
      .eq("id", deliverable.project_id)
      .maybeSingle();

    if (projectError) throw projectError;
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow, error: roleError } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("agency_id", project.agency_id)
      .maybeSingle();

    if (roleError) throw roleError;

    if (!roleRow?.role) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isEditor, error: isEditorError } = await service.rpc(
      "is_project_editor",
      { _user_id: userId, _project_id: project.id }
    );
    if (isEditorError) throw isEditorError;

    const canView =
      roleRow.role === "admin" || project.client_id === userId || isEditor === true;

    const canManage = roleRow.role === "admin" || isEditor === true;

    if (action === "signed_url") {
      if (!canView) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const expiresIn = Number(body?.expiresIn ?? 3600);
      const filePath = extractDeliverablesPathFromUrl(deliverable.file_url);
      if (!filePath) {
        return new Response(JSON.stringify({ error: "Invalid file_url" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await service.storage
        .from("deliverables")
        .createSignedUrl(filePath, Number.isFinite(expiresIn) ? expiresIn : 3600);

      if (error) throw error;

      return new Response(JSON.stringify({ signedUrl: data.signedUrl }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "rename") {
      if (!canManage) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newName = String(body?.newName ?? "").trim();
      if (!newName) {
        return new Response(JSON.stringify({ error: "Missing newName" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: updated, error } = await service
        .from("deliverables")
        .update({ file_name: newName })
        .eq("id", deliverableId)
        .select("id, file_name")
        .maybeSingle();

      if (error) throw error;
      if (!updated) {
        return new Response(JSON.stringify({ error: "Rename failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true, deliverable: updated }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      if (!canManage) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const filePath = extractDeliverablesPathFromUrl(deliverable.file_url);

      if (filePath) {
        const { error: storageError } = await service.storage
          .from("deliverables")
          .remove([filePath]);

        // If it was already removed, continue deleting the DB row
        if (storageError && !String(storageError.message ?? "").includes("Object not found")) {
          throw storageError;
        }
      }

      const { data: deleted, error: dbError } = await service
        .from("deliverables")
        .delete()
        .eq("id", deliverableId)
        .select("id")
        .maybeSingle();

      if (dbError) throw dbError;
      if (!deleted) {
        return new Response(JSON.stringify({ error: "Delete failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
    console.error("Error in deliverables-ops:", error);
    return new Response(JSON.stringify({ error: error.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
