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

// Verify parent folder is within the share's subtree (inclusive)
async function isWithinShareTree(admin: any, shareFolderId: string, target: string) {
  if (target === shareFolderId) return true;
  let cur: string | null = target;
  for (let i = 0; i < 25 && cur; i++) {
    const { data: f } = await admin.from("drive_folders").select("parent_id").eq("id", cur).maybeSingle();
    if (!f) return false;
    if (f.parent_id === shareFolderId) return true;
    cur = f.parent_id;
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { token, password, parentId, name, action } = body || {};
    if (!token) return json({ error: "Token required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: link } = await admin.from("drive_share_links").select("*").eq("token", token).maybeSingle();
    if (!link) return json({ error: "Invalid link" }, 404);
    if (link.is_revoked) return json({ error: "Link revoked" }, 403);
    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) return json({ error: "Link expired" }, 403);
    if (!link.folder_id) return json({ error: "Not a folder share" }, 400);
    if (!["edit", "full"].includes(link.permission)) return json({ error: "Editing not allowed for this link" }, 403);

    if (link.password_hash) {
      if (!password) return json({ error: "Password required" }, 401);
      if ((await hashPassword(password)) !== link.password_hash) return json({ error: "Wrong password" }, 401);
    }

    const op = action || "create";

    if (op === "create") {
      const trimmed = (name || "").trim();
      if (!trimmed) return json({ error: "Name required" }, 400);
      if (trimmed.length > 120) return json({ error: "Name too long" }, 400);
      const target = parentId || link.folder_id;
      if (!(await isWithinShareTree(admin, link.folder_id, target))) {
        return json({ error: "Forbidden" }, 403);
      }
      const { data: ins, error } = await admin
        .from("drive_folders")
        .insert({
          agency_id: link.agency_id,
          parent_id: target,
          name: trimmed,
          kind: "custom",
          created_by: link.created_by,
          share_link_id: link.id,
        })
        .select()
        .single();
      if (error) throw error;
      return json({ ok: true, folder: ins });
    }

    if (op === "rename") {
      const { folderId } = body;
      const trimmed = (name || "").trim();
      if (!folderId || !trimmed) return json({ error: "Missing fields" }, 400);
      const { data: f } = await admin.from("drive_folders").select("share_link_id, agency_id").eq("id", folderId).maybeSingle();
      if (!f || f.agency_id !== link.agency_id) return json({ error: "Not found" }, 404);
      if (f.share_link_id !== link.id) return json({ error: "You can only manage items you created via this link" }, 403);
      await admin.from("drive_folders").update({ name: trimmed }).eq("id", folderId);
      return json({ ok: true });
    }

    if (op === "delete") {
      const { folderId } = body;
      if (!folderId) return json({ error: "Missing fields" }, 400);
      const { data: f } = await admin.from("drive_folders").select("share_link_id, agency_id").eq("id", folderId).maybeSingle();
      if (!f || f.agency_id !== link.agency_id) return json({ error: "Not found" }, 404);
      if (f.share_link_id !== link.id) return json({ error: "You can only manage items you created via this link" }, 403);
      const now = new Date().toISOString();
      await admin.from("drive_folders").update({ deleted_at: now }).eq("id", folderId);
      return json({ ok: true });
    }

    if (op === "rename_file" || op === "delete_file") {
      const { fileId } = body;
      if (!fileId) return json({ error: "Missing fields" }, 400);
      const { data: file } = await admin.from("drive_files").select("share_link_id, agency_id").eq("id", fileId).maybeSingle();
      if (!file || file.agency_id !== link.agency_id) return json({ error: "Not found" }, 404);
      if (file.share_link_id !== link.id) return json({ error: "You can only manage files you uploaded via this link" }, 403);
      if (op === "rename_file") {
        const trimmed = (name || "").trim();
        if (!trimmed) return json({ error: "Name required" }, 400);
        await admin.from("drive_files").update({ file_name: trimmed }).eq("id", fileId);
      } else {
        await admin.from("drive_files").update({ deleted_at: new Date().toISOString() }).eq("id", fileId);
      }
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    console.error("drive-share-folder error", e);
    return json({ error: e.message || "Server error" }, 500);
  }
});
