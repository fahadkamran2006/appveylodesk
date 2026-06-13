import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function hashPassword(pw: string): Promise<string> {
  const enc = new TextEncoder().encode(pw + ":veylodesk-drive");
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { token, password, subFolderId } = await req.json();
    if (!token) return json({ error: "Token required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: link } = await admin
      .from("drive_share_links")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (!link) return json({ error: "Invalid link" }, 404);
    if (link.is_revoked) return json({ error: "Link revoked" }, 403);
    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      return json({ error: "Link expired" }, 403);
    }

    if (link.password_hash) {
      if (!password) return json({ requiresPassword: true }, 200);
      const h = await hashPassword(password);
      if (h !== link.password_hash) return json({ error: "Wrong password" }, 401);
    }

    // Determine "Powered by Veylodesk" badge by looking up agency plan_tier
    let isFreePlan = false;
    try {
      const agencyId = (link as any).agency_id;
      if (agencyId) {
        const { data: a } = await admin.from('agencies').select('plan_tier').eq('id', agencyId).maybeSingle();
        isFreePlan = ((a as any)?.plan_tier || 'free') === 'free';
      }
    } catch (_) { /* ignore */ }


    // ----- File-share short-circuit -----
    if (link.file_id) {
      const { data: file } = await admin
        .from("drive_files")
        .select("id, file_name, file_url, file_size, mime_type, created_at")
        .eq("id", link.file_id)
        .maybeSingle();
      if (!file) return json({ error: "File no longer exists" }, 404);
      return json({
        ok: true,
        kind: "file",
        link: {
          permission: link.permission,
          expires_at: link.expires_at,
          folder_id: null,
          file_id: link.file_id,
        },
        file,
        is_free_plan: isFreePlan,
      });
    }

    // ----- Folder share -----
    const folderId = subFolderId || link.folder_id;

    if (subFolderId && subFolderId !== link.folder_id) {
      let cur: string | null = subFolderId;
      let ok = false;
      for (let i = 0; i < 20 && cur; i++) {
        const { data: f } = await admin.from("drive_folders").select("parent_id").eq("id", cur).maybeSingle();
        if (!f) break;
        if (f.parent_id === link.folder_id) { ok = true; break; }
        cur = f.parent_id;
      }
      if (!ok) return json({ error: "Forbidden" }, 403);
    }

    const { data: rootFolder } = await admin.from("drive_folders").select("id, name, kind, project_id").eq("id", folderId).maybeSingle();
    const { data: subfolders } = await admin.from("drive_folders").select("id, name").eq("parent_id", folderId).order("name");
    const { data: files } = await admin.from("drive_files").select("id, file_name, file_url, file_size, mime_type, created_at").eq("folder_id", folderId).order("created_at", { ascending: false });

    let allFiles = files || [];
    if (rootFolder?.kind === "project_root" && rootFolder.project_id) {
      const { data: dlvs } = await admin.from("deliverables").select("id, file_name, file_url, file_size, created_at").eq("project_id", rootFolder.project_id);
      for (const d of dlvs || []) {
        allFiles.push({
          id: `dlv:${d.id}`,
          file_name: d.file_name,
          file_url: d.file_url,
          file_size: d.file_size || 0,
          mime_type: null,
          created_at: d.created_at,
        });
      }
    }

    return json({
      ok: true,
      kind: "folder",
      link: {
        permission: link.permission,
        expires_at: link.expires_at,
        max_upload_bytes: link.max_upload_bytes,
        max_files: link.max_files,
        used_bytes: link.used_bytes,
        used_files: link.used_files,
        folder_id: link.folder_id,
      },
      folder: rootFolder,
      subfolders: subfolders || [],
      files: allFiles,
      is_free_plan: isFreePlan,
    });
  } catch (e: any) {
    console.error("share-resolve error", e);
    return json({ error: e.message || "Error" }, 500);
  }
});
