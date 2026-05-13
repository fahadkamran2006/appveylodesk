import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BUNNY_API_KEY = Deno.env.get("BUNNY_API_KEY")!;
const BUNNY_STORAGE_ZONE = Deno.env.get("BUNNY_STORAGE_ZONE")!;
const BUNNY_STORAGE_HOSTNAME = Deno.env.get("BUNNY_STORAGE_HOSTNAME") || "storage.bunnycdn.com";
const BUNNY_CDN_URL = Deno.env.get("BUNNY_CDN_URL") || "";

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function hashPassword(pw: string): Promise<string> {
  const enc = new TextEncoder().encode(pw + ":veylodesk-drive");
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sanitize(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 200);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const form = await req.formData();
    const token = form.get("token")?.toString();
    const password = form.get("password")?.toString();
    const uploaderName = form.get("uploaderName")?.toString() || "Anonymous";
    const uploaderEmail = form.get("uploaderEmail")?.toString() || null;
    const targetFolderId = form.get("folderId")?.toString() || null;
    const file = form.get("file");

    if (!token) return json({ error: "Token required" }, 400);
    if (!(file instanceof File)) return json({ error: "File required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: link } = await admin.from("drive_share_links").select("*").eq("token", token).maybeSingle();
    if (!link) return json({ error: "Invalid link" }, 404);
    if (link.is_revoked) return json({ error: "Link revoked" }, 403);
    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) return json({ error: "Link expired" }, 403);
    if (!["upload", "edit", "full"].includes(link.permission)) return json({ error: "Upload not allowed" }, 403);

    if (link.password_hash) {
      if (!password) return json({ error: "Password required" }, 401);
      if ((await hashPassword(password)) !== link.password_hash) return json({ error: "Wrong password" }, 401);
    }

    // Resolve folder for upload — must be within the share's subtree
    let folderId = link.folder_id as string;
    if (targetFolderId && targetFolderId !== link.folder_id) {
      let cur: string | null = targetFolderId;
      let ok = false;
      for (let i = 0; i < 25 && cur; i++) {
        const { data: f } = await admin.from("drive_folders").select("parent_id").eq("id", cur).maybeSingle();
        if (!f) break;
        if (f.parent_id === link.folder_id || cur === link.folder_id) { ok = true; break; }
        cur = f.parent_id;
      }
      if (!ok) return json({ error: "Folder outside this share" }, 403);
      folderId = targetFolderId;
    }

    // Per-link caps
    if (link.max_files != null && link.used_files >= link.max_files) {
      return json({ error: "Upload limit reached" }, 403);
    }
    const size = file.size;
    if (link.max_upload_bytes != null && link.used_bytes + size > link.max_upload_bytes) {
      return json({ error: "Upload size cap exceeded for this link" }, 403);
    }

    // Agency quota
    const { data: agency } = await admin.from("agencies").select("storage_used_bytes, storage_limit_bytes").eq("id", link.agency_id).single();
    if (agency.storage_used_bytes + size > agency.storage_limit_bytes) {
      return json({ error: "Agency storage full" }, 403);
    }

    // Upload to Bunny
    const safeName = sanitize(file.name);
    const path = `agency/${link.agency_id}/drive/${folderId}/${Date.now()}_${safeName}`;
    const buf = new Uint8Array(await file.arrayBuffer());
    const up = await fetch(`https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${path}`, {
      method: "PUT",
      headers: { AccessKey: BUNNY_API_KEY, "Content-Type": "application/octet-stream" },
      body: buf,
    });
    if (!up.ok) {
      const t = await up.text();
      console.error("Bunny PUT failed", up.status, t);
      return json({ error: "Storage upload failed" }, 502);
    }

    const cdnHost = BUNNY_CDN_URL || `${BUNNY_STORAGE_ZONE}.b-cdn.net`;
    const cdnUrl = `https://${cdnHost.replace(/^https?:\/\//, "")}/${path}`;

    // Register drive_file
    const { data: dfile, error: insErr } = await admin
      .from("drive_files")
      .insert({
        agency_id: link.agency_id,
        folder_id: link.folder_id,
        file_name: file.name,
        file_url: cdnUrl,
        file_size: size,
        mime_type: file.type || null,
        uploaded_by: null,
        uploader_label: uploaderName,
        source: "public_link",
        share_link_id: link.id,
      })
      .select()
      .single();
    if (insErr) throw insErr;

    // Update link usage
    await admin
      .from("drive_share_links")
      .update({ used_bytes: link.used_bytes + size, used_files: link.used_files + 1 })
      .eq("id", link.id);

    // Audit
    const ipHash = req.headers.get("x-forwarded-for") || "";
    await admin.from("drive_share_uploads").insert({
      share_link_id: link.id,
      file_id: dfile.id,
      uploader_name: uploaderName,
      uploader_email: uploaderEmail,
      ip_hash: ipHash.slice(0, 64),
    });

    return json({ ok: true, file: dfile });
  } catch (e: any) {
    console.error("share-upload error", e);
    return json({ error: e.message || "Error" }, 500);
  }
});
