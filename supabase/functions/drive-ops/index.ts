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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const sb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await sb.auth.getUser(auth.replace("Bearer ", ""));
  return data?.user ?? null;
}

async function hashPassword(pw: string): Promise<string> {
  const enc = new TextEncoder().encode(pw + ":veylodesk-drive");
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { action, ...payload } = await req.json();

    // Resolve user agency + role
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("agency_id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!roleRow?.agency_id) return json({ error: "No agency" }, 403);
    const agencyId = roleRow.agency_id as string;
    const role = roleRow.role as string;

    switch (action) {
      // ---------- FOLDERS ----------
      case "list_folder": {
        // payload: { folderId?: string|null }
        const folderId = payload.folderId ?? null;

        // Subfolders (exclude trashed)
        const folderQ = admin
          .from("drive_folders")
          .select("*")
          .eq("agency_id", agencyId)
          .is("deleted_at", null)
          .order("name");
        const { data: folders, error: fErr } = folderId
          ? await folderQ.eq("parent_id", folderId)
          : await folderQ.is("parent_id", null);
        if (fErr) throw fErr;

        // Files in this folder (exclude trashed)
        let files: any[] = [];
        if (folderId) {
          const { data: dfiles } = await admin
            .from("drive_files")
            .select("*")
            .eq("folder_id", folderId)
            .is("deleted_at", null)
            .order("created_at", { ascending: false });
          files = dfiles || [];

          // If folder is a project_root, also include deliverables for that project
          const { data: folderRow } = await admin
            .from("drive_folders")
            .select("kind, project_id, name")
            .eq("id", folderId)
            .maybeSingle();
          if (folderRow?.kind === "project_root" && folderRow.project_id) {
            const { data: dlvs } = await admin
              .from("deliverables")
              .select("id, file_name, file_url, file_size, created_at, uploaded_by")
              .eq("project_id", folderRow.project_id)
              .order("created_at", { ascending: false });
            for (const d of dlvs || []) {
              files.push({
                id: `dlv:${d.id}`,
                folder_id: folderId,
                file_name: d.file_name,
                file_url: d.file_url,
                file_size: d.file_size || 0,
                source: "deliverable",
                uploaded_by: d.uploaded_by,
                created_at: d.created_at,
              });
            }
          }
        }

        // Breadcrumb
        const crumbs: any[] = [];
        let cur = folderId;
        while (cur) {
          const { data: f } = await admin
            .from("drive_folders")
            .select("id, name, parent_id")
            .eq("id", cur)
            .maybeSingle();
          if (!f) break;
          crumbs.unshift({ id: f.id, name: f.name });
          cur = f.parent_id;
        }

        return json({ ok: true, folders: folders || [], files, breadcrumb: crumbs });
      }

      case "create_folder": {
        const { name, parentId } = payload;
        if (!name?.trim()) return json({ error: "Name required" }, 400);
        const { data, error } = await admin
          .from("drive_folders")
          .insert({
            agency_id: agencyId,
            parent_id: parentId || null,
            name: name.trim(),
            kind: "custom",
            created_by: user.id,
          })
          .select()
          .single();
        if (error) throw error;
        return json({ ok: true, folder: data });
      }

      case "rename_folder": {
        const { folderId, name } = payload;
        const { data: f } = await admin.from("drive_folders").select("created_by, kind").eq("id", folderId).maybeSingle();
        if (!f) return json({ error: "Not found" }, 404);
        if (f.kind === "project_root") return json({ error: "Cannot rename project folder" }, 400);
        if (role !== "admin" && f.created_by !== user.id) return json({ error: "Forbidden" }, 403);
        await admin.from("drive_folders").update({ name: name.trim() }).eq("id", folderId);
        return json({ ok: true });
      }

      case "delete_folder": {
        const { folderId } = payload;
        const { data: f } = await admin.from("drive_folders").select("created_by, kind").eq("id", folderId).maybeSingle();
        if (!f) return json({ error: "Not found" }, 404);
        if (f.kind === "project_root") return json({ error: "Cannot delete project folder" }, 400);
        if (role !== "admin" && f.created_by !== user.id) return json({ error: "Forbidden" }, 403);
        await admin.from("drive_folders").delete().eq("id", folderId);
        return json({ ok: true });
      }

      // ---------- FILES (drive_files) ----------
      case "register_file": {
        // After client uploads to Bunny, register the resulting URL
        const { folderId, fileName, fileUrl, fileSize, mimeType } = payload;
        if (!folderId || !fileName || !fileUrl) return json({ error: "Missing fields" }, 400);
        const { data: folder } = await admin.from("drive_folders").select("agency_id").eq("id", folderId).maybeSingle();
        if (!folder || folder.agency_id !== agencyId) return json({ error: "Forbidden" }, 403);

        const { data, error } = await admin
          .from("drive_files")
          .insert({
            agency_id: agencyId,
            folder_id: folderId,
            file_name: fileName,
            file_url: fileUrl,
            file_size: fileSize || 0,
            mime_type: mimeType || null,
            uploaded_by: user.id,
            source: "user",
          })
          .select()
          .single();
        if (error) throw error;
        return json({ ok: true, file: data });
      }

      case "delete_file": {
        const { fileId } = payload;
        const { data: f } = await admin.from("drive_files").select("*").eq("id", fileId).maybeSingle();
        if (!f) return json({ error: "Not found" }, 404);
        if (role !== "admin" && f.uploaded_by !== user.id) return json({ error: "Forbidden" }, 403);

        // Best-effort Bunny delete
        try {
          if (f.file_url?.includes("b-cdn.net")) {
            const u = new URL(f.file_url);
            const path = u.pathname.replace(/^\//, "");
            await fetch(`https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${path}`, {
              method: "DELETE",
              headers: { AccessKey: BUNNY_API_KEY },
            });
          }
        } catch (e) { console.warn("Bunny delete failed", e); }

        await admin.from("drive_files").delete().eq("id", fileId);
        return json({ ok: true });
      }

      // ---------- SHARE LINKS ----------
      case "create_share_link": {
        const { folderId, fileId, permission, password, expiresAt, maxUploadBytes, maxFiles } = payload;
        if (!folderId && !fileId) return json({ error: "folderId or fileId required" }, 400);
        if (folderId && fileId) return json({ error: "Pass only one of folderId/fileId" }, 400);

        if (folderId) {
          const { data: folder } = await admin
            .from("drive_folders").select("agency_id").eq("id", folderId).maybeSingle();
          if (!folder || folder.agency_id !== agencyId) return json({ error: "Forbidden" }, 403);
        } else {
          const { data: file } = await admin
            .from("drive_files").select("agency_id").eq("id", fileId).maybeSingle();
          if (!file || file.agency_id !== agencyId) return json({ error: "Forbidden" }, 403);
        }

        const password_hash = password ? await hashPassword(password) : null;
        // File shares only support view/download.
        const perm = fileId
          ? (["view", "download"].includes(permission) ? permission : "download")
          : (permission || "download");

        const { data, error } = await admin
          .from("drive_share_links")
          .insert({
            agency_id: agencyId,
            folder_id: folderId || null,
            file_id: fileId || null,
            created_by: user.id,
            permission: perm,
            password_hash,
            expires_at: expiresAt || null,
            max_upload_bytes: fileId ? null : (maxUploadBytes || null),
            max_files: fileId ? null : (maxFiles || null),
          })
          .select()
          .single();
        if (error) throw error;
        return json({ ok: true, link: data });
      }

      case "list_share_links": {
        const { folderId, fileId } = payload;
        let q = admin.from("drive_share_links").select("*").eq("agency_id", agencyId).order("created_at", { ascending: false });
        if (folderId) q = q.eq("folder_id", folderId);
        if (fileId) q = q.eq("file_id", fileId);
        const { data } = await q;
        return json({ ok: true, links: data || [] });
      }

      case "revoke_share_link": {
        const { linkId } = payload;
        const { data: l } = await admin.from("drive_share_links").select("created_by").eq("id", linkId).maybeSingle();
        if (!l) return json({ error: "Not found" }, 404);
        if (role !== "admin" && l.created_by !== user.id) return json({ error: "Forbidden" }, 403);
        await admin.from("drive_share_links").update({ is_revoked: true }).eq("id", linkId);
        return json({ ok: true });
      }

      // ---------- BACKFILL: ensure project_root folders ----------
      case "sync_project_folders": {
        const { data: projects } = await admin
          .from("projects")
          .select("id, title")
          .eq("agency_id", agencyId);
        for (const p of projects || []) {
          const { data: existing } = await admin
            .from("drive_folders")
            .select("id")
            .eq("agency_id", agencyId)
            .eq("project_id", p.id)
            .eq("kind", "project_root")
            .maybeSingle();
          if (!existing) {
            await admin.from("drive_folders").insert({
              agency_id: agencyId,
              parent_id: null,
              name: p.title || "Untitled project",
              kind: "project_root",
              project_id: p.id,
              created_by: user.id,
            });
          }
        }
        return json({ ok: true });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e: any) {
    console.error("drive-ops error", e);
    return json({ error: e.message || "Server error" }, 500);
  }
});
