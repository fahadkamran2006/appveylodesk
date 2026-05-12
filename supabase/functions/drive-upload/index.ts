import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const BUNNY_API_KEY = Deno.env.get("BUNNY_API_KEY")!;
const BUNNY_STORAGE_ZONE = Deno.env.get("BUNNY_STORAGE_ZONE")!;
const BUNNY_STORAGE_HOSTNAME = Deno.env.get("BUNNY_STORAGE_HOSTNAME") || "storage.bunnycdn.com";
const BUNNY_CDN_URL = Deno.env.get("BUNNY_CDN_URL") || "";

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function sanitize(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 200);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const sb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser(auth.replace("Bearer ", ""));
    const user = u?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const form = await req.formData();
    const folderId = form.get("folderId")?.toString();
    const file = form.get("file");
    if (!folderId) return json({ error: "folderId required" }, 400);
    if (!(file instanceof File)) return json({ error: "file required" }, 400);

    const { data: folder } = await admin
      .from("drive_folders").select("agency_id, kind").eq("id", folderId).maybeSingle();
    if (!folder) return json({ error: "Folder not found" }, 404);

    const { data: roleRow } = await admin
      .from("user_roles").select("agency_id").eq("user_id", user.id).maybeSingle();
    if (!roleRow || roleRow.agency_id !== folder.agency_id) return json({ error: "Forbidden" }, 403);

    const size = file.size;
    const { data: agency } = await admin
      .from("agencies").select("storage_used_bytes, storage_limit_bytes").eq("id", folder.agency_id).single();
    if (agency.storage_used_bytes + size > agency.storage_limit_bytes) {
      return json({ error: "Agency storage full" }, 403);
    }

    const safeName = sanitize(file.name);
    const path = `agency/${folder.agency_id}/drive/${folderId}/${Date.now()}_${safeName}`;
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

    const { data: dfile, error: insErr } = await admin
      .from("drive_files")
      .insert({
        agency_id: folder.agency_id,
        folder_id: folderId,
        file_name: file.name,
        file_url: cdnUrl,
        file_size: size,
        mime_type: file.type || null,
        uploaded_by: user.id,
        source: "user",
      })
      .select()
      .single();
    if (insErr) throw insErr;

    return json({ ok: true, file: dfile });
  } catch (e: any) {
    console.error("drive-upload error", e);
    return json({ error: e.message || "Error" }, 500);
  }
});
