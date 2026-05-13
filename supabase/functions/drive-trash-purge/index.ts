// Scheduled job: permanently delete drive items in trash > 30 days, including Bunny objects.
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

const TRASH_TTL_DAYS = 30;

async function bunnyDelete(cdnUrl: string | null) {
  if (!cdnUrl?.includes("b-cdn.net")) return;
  try {
    const u = new URL(cdnUrl);
    const path = u.pathname.replace(/^\//, "");
    const r = await fetch(`https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${path}`, {
      method: "DELETE",
      headers: { AccessKey: BUNNY_API_KEY },
    });
    if (!r.ok && r.status !== 404) console.warn("Bunny purge non-OK", r.status, path);
  } catch (e) {
    console.warn("Bunny purge failed", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const cutoff = new Date(Date.now() - TRASH_TTL_DAYS * 24 * 3600 * 1000).toISOString();

  // Files to purge
  const { data: files } = await admin
    .from("drive_files")
    .select("id, file_url")
    .lt("deleted_at", cutoff);

  let purgedFiles = 0;
  for (const f of files || []) {
    await bunnyDelete(f.file_url);
    purgedFiles++;
  }
  if (files?.length) {
    await admin.from("drive_files").delete().in("id", files.map((f: any) => f.id));
  }

  // Folders to purge (any descendant files already purged above will no-op)
  const { data: folders } = await admin
    .from("drive_folders")
    .select("id")
    .lt("deleted_at", cutoff);
  if (folders?.length) {
    // Cascade: also purge any files still inside these folders (defensive)
    const folderIds = folders.map((f: any) => f.id);
    const { data: leftoverFiles } = await admin
      .from("drive_files").select("id, file_url").in("folder_id", folderIds);
    for (const f of leftoverFiles || []) await bunnyDelete(f.file_url);
    if (leftoverFiles?.length) {
      await admin.from("drive_files").delete().in("id", leftoverFiles.map((x: any) => x.id));
    }
    await admin.from("drive_folders").delete().in("id", folderIds);
  }

  const result = { ok: true, purgedFiles, purgedFolders: folders?.length || 0, cutoff };
  console.log("trash purge", result);
  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
