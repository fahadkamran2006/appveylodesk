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
        const trimmed = (name || "").trim();
        if (!trimmed) return json({ error: "Name required" }, 400);
        const { data: f } = await admin
          .from("drive_folders")
          .select("created_by, kind, project_id, container_id, agency_id")
          .eq("id", folderId)
          .maybeSingle();
        if (!f) return json({ error: "Not found" }, 404);
        if (f.agency_id !== agencyId) return json({ error: "Forbidden" }, 403);
        if (f.kind === "client_root") return json({ error: "Client folders are renamed by updating the client's profile" }, 400);
        // Only admins can rename system folders (project_root, container_root)
        const isSystem = f.kind === "project_root" || f.kind === "container_root";
        if (isSystem && role !== "admin") return json({ error: "Only an admin can rename this folder" }, 403);
        if (!isSystem && role !== "admin" && f.created_by !== user.id) return json({ error: "Forbidden" }, 403);

        await admin.from("drive_folders").update({ name: trimmed }).eq("id", folderId);

        // Sync downstream entities
        if (f.kind === "project_root" && f.project_id) {
          await admin.from("projects").update({ title: trimmed }).eq("id", f.project_id);
          await admin.from("channels").update({ name: trimmed }).eq("project_id", f.project_id).eq("type", "project");
        } else if (f.kind === "container_root" && f.container_id) {
          await admin.from("project_containers").update({ title: trimmed }).eq("id", f.container_id);
          await admin.from("channels").update({ name: trimmed }).eq("container_id", f.container_id).eq("type", "project");
        }
        return json({ ok: true });
      }

      case "delete_folder": {
        // Soft delete: move folder + descendants + their files to trash
        const { folderId } = payload;
        const { data: f } = await admin.from("drive_folders").select("created_by, kind, agency_id").eq("id", folderId).maybeSingle();
        if (!f) return json({ error: "Not found" }, 404);
        if (f.kind === "project_root" || f.kind === "client_root" || f.kind === "container_root") return json({ error: "Cannot delete system folder" }, 400);
        if (f.agency_id !== agencyId) return json({ error: "Forbidden" }, 403);
        if (role !== "admin" && f.created_by !== user.id) return json({ error: "Forbidden" }, 403);

        // Walk subtree
        const allIds: string[] = [folderId];
        let frontier = [folderId];
        while (frontier.length) {
          const { data: kids } = await admin
            .from("drive_folders").select("id").in("parent_id", frontier).is("deleted_at", null);
          const kidIds = (kids || []).map((k: any) => k.id);
          if (!kidIds.length) break;
          allIds.push(...kidIds);
          frontier = kidIds;
        }
        const now = new Date().toISOString();
        await admin.from("drive_folders").update({ deleted_at: now, deleted_by: user.id }).in("id", allIds);
        await admin.from("drive_files").update({ deleted_at: now, deleted_by: user.id }).in("folder_id", allIds).is("deleted_at", null);
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

      case "rename_file": {
        const { fileId, newName } = payload;
        const trimmed = String(newName || "").trim();
        if (!trimmed) return json({ error: "Name required" }, 400);
        const { data: f } = await admin.from("drive_files").select("agency_id, uploaded_by").eq("id", fileId).maybeSingle();
        if (!f) return json({ error: "Not found" }, 404);
        if (f.agency_id !== agencyId) return json({ error: "Forbidden" }, 403);
        if (role !== "admin" && f.uploaded_by !== user.id) return json({ error: "Forbidden" }, 403);
        await admin.from("drive_files").update({ file_name: trimmed }).eq("id", fileId);
        return json({ ok: true });
      }

      case "delete_file": {
        // Soft delete: move to trash
        const { fileId } = payload;
        const { data: f } = await admin.from("drive_files").select("agency_id, uploaded_by").eq("id", fileId).maybeSingle();
        if (!f) return json({ error: "Not found" }, 404);
        if (f.agency_id !== agencyId) return json({ error: "Forbidden" }, 403);
        if (role !== "admin" && f.uploaded_by !== user.id) return json({ error: "Forbidden" }, 403);
        await admin.from("drive_files")
          .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
          .eq("id", fileId);
        return json({ ok: true });
      }

      // ---------- TRASH ----------
      case "list_trash": {
        // Items the caller can see in trash: ones they deleted/created/uploaded, or all if admin
        const fileQ = admin.from("drive_files").select("*")
          .eq("agency_id", agencyId).not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false });
        const folderQ = admin.from("drive_folders").select("*")
          .eq("agency_id", agencyId).not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false });
        const [{ data: tFiles }, { data: tFolders }] = await Promise.all([
          role === "admin" ? fileQ : fileQ.eq("uploaded_by", user.id),
          role === "admin" ? folderQ : folderQ.eq("created_by", user.id),
        ]);
        return json({ ok: true, files: tFiles || [], folders: tFolders || [] });
      }

      case "restore_file": {
        const { fileId } = payload;
        const { data: f } = await admin.from("drive_files").select("agency_id, uploaded_by, folder_id").eq("id", fileId).maybeSingle();
        if (!f) return json({ error: "Not found" }, 404);
        if (f.agency_id !== agencyId) return json({ error: "Forbidden" }, 403);
        if (role !== "admin" && f.uploaded_by !== user.id) return json({ error: "Forbidden" }, 403);
        // If parent folder is trashed, restore to root (folder_id stays — it's hidden, so move to null is safer)
        let restoreFolderId = f.folder_id;
        if (restoreFolderId) {
          const { data: parent } = await admin.from("drive_folders").select("deleted_at").eq("id", restoreFolderId).maybeSingle();
          if (!parent || parent.deleted_at) restoreFolderId = null;
        }
        await admin.from("drive_files").update({
          deleted_at: null, deleted_by: null, folder_id: restoreFolderId,
        }).eq("id", fileId);
        return json({ ok: true });
      }

      case "restore_folder": {
        const { folderId } = payload;
        const { data: f } = await admin.from("drive_folders").select("agency_id, created_by, parent_id").eq("id", folderId).maybeSingle();
        if (!f) return json({ error: "Not found" }, 404);
        if (f.agency_id !== agencyId) return json({ error: "Forbidden" }, 403);
        if (role !== "admin" && f.created_by !== user.id) return json({ error: "Forbidden" }, 403);
        let parentId = f.parent_id;
        if (parentId) {
          const { data: parent } = await admin.from("drive_folders").select("deleted_at").eq("id", parentId).maybeSingle();
          if (!parent || parent.deleted_at) parentId = null;
        }
        // Restore folder + its (still-trashed) descendants and files
        const allIds: string[] = [folderId];
        let frontier = [folderId];
        while (frontier.length) {
          const { data: kids } = await admin
            .from("drive_folders").select("id").in("parent_id", frontier).not("deleted_at", "is", null);
          const kidIds = (kids || []).map((k: any) => k.id);
          if (!kidIds.length) break;
          allIds.push(...kidIds);
          frontier = kidIds;
        }
        await admin.from("drive_folders").update({ deleted_at: null, deleted_by: null }).in("id", allIds);
        await admin.from("drive_folders").update({ parent_id: parentId }).eq("id", folderId);
        await admin.from("drive_files").update({ deleted_at: null, deleted_by: null }).in("folder_id", allIds).not("deleted_at", "is", null);
        return json({ ok: true });
      }

      case "permanent_delete_file": {
        const { fileId } = payload;
        const { data: f } = await admin.from("drive_files").select("*").eq("id", fileId).maybeSingle();
        if (!f) return json({ error: "Not found" }, 404);
        if (f.agency_id !== agencyId) return json({ error: "Forbidden" }, 403);
        if (role !== "admin" && f.uploaded_by !== user.id) return json({ error: "Forbidden" }, 403);

        // Best-effort Bunny delete
        try {
          if (f.file_url?.includes("b-cdn.net")) {
            const u = new URL(f.file_url);
            const path = u.pathname.replace(/^\//, "");
            const r = await fetch(`https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${path}`, {
              method: "DELETE",
              headers: { AccessKey: BUNNY_API_KEY },
            });
            if (!r.ok && r.status !== 404) console.warn("Bunny delete non-OK", r.status);
          }
        } catch (e) { console.warn("Bunny delete failed", e); }

        await admin.from("drive_files").delete().eq("id", fileId);
        return json({ ok: true });
      }

      case "permanent_delete_folder": {
        const { folderId } = payload;
        const { data: f } = await admin.from("drive_folders").select("agency_id, created_by, kind").eq("id", folderId).maybeSingle();
        if (!f) return json({ error: "Not found" }, 404);
        if (f.kind === "project_root" || f.kind === "client_root" || f.kind === "container_root") return json({ error: "Cannot delete system folder" }, 400);
        if (f.agency_id !== agencyId) return json({ error: "Forbidden" }, 403);
        if (role !== "admin" && f.created_by !== user.id) return json({ error: "Forbidden" }, 403);

        // Walk full subtree (incl. already-trashed descendants)
        const allIds: string[] = [folderId];
        let frontier = [folderId];
        while (frontier.length) {
          const { data: kids } = await admin.from("drive_folders").select("id").in("parent_id", frontier);
          const kidIds = (kids || []).map((k: any) => k.id);
          if (!kidIds.length) break;
          allIds.push(...kidIds);
          frontier = kidIds;
        }
        const { data: filesIn } = await admin.from("drive_files").select("id, file_url").in("folder_id", allIds);
        for (const file of filesIn || []) {
          try {
            if (file.file_url?.includes("b-cdn.net")) {
              const u = new URL(file.file_url);
              const path = u.pathname.replace(/^\//, "");
              await fetch(`https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${path}`, {
                method: "DELETE",
                headers: { AccessKey: BUNNY_API_KEY },
              });
            }
          } catch (e) { console.warn("Bunny delete failed", e); }
        }
        if (filesIn?.length) await admin.from("drive_files").delete().in("id", filesIn.map((x: any) => x.id));
        await admin.from("drive_folders").delete().in("id", allIds);
        return json({ ok: true });
      }

      // ---------- BUNNY orphan cleanup (called by client when an upload is canceled) ----------
      case "cleanup_orphan": {
        const { cdnUrl } = payload;
        if (!cdnUrl || typeof cdnUrl !== "string") return json({ error: "cdnUrl required" }, 400);
        if (!cdnUrl.includes("b-cdn.net")) return json({ ok: true });
        try {
          const u = new URL(cdnUrl);
          const path = u.pathname.replace(/^\//, "");
          // Confine to this agency's prefix
          if (!path.startsWith(`agency/${agencyId}/`)) return json({ error: "Forbidden" }, 403);
          await fetch(`https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${path}`, {
            method: "DELETE",
            headers: { AccessKey: BUNNY_API_KEY },
          });
        } catch (e) { console.warn("orphan cleanup failed", e); }
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

      // ---------- BACKFILL: Client → Project (container) → Video hierarchy ----------
      case "sync_project_folders": {
        const { data: projects } = await admin
          .from("projects")
          .select("id, title, client_id, managed_client_id, container_id")
          .eq("agency_id", agencyId);

        const { data: containers } = await admin
          .from("project_containers")
          .select("id, title, client_id, managed_client_id")
          .eq("agency_id", agencyId);
        const containerById = new Map<string, { id: string; title: string; client_id: string | null; managed_client_id: string | null }>();
        for (const c of containers || []) containerById.set(c.id, c as any);

        // Resolve real client display names
        const clientIdSet = new Set<string>();
        for (const p of projects || []) if (p.client_id) clientIdSet.add(p.client_id);
        for (const c of containers || []) if (c.client_id) clientIdSet.add(c.client_id);
        const names = new Map<string, string>();
        if (clientIdSet.size) {
          const { data: profs } = await admin
            .from("profiles")
            .select("id, full_name, email")
            .in("id", Array.from(clientIdSet));
          for (const p of profs || []) names.set(p.id, p.full_name || p.email || "Client");
        }

        // Resolve managed client display names
        const managedIdSet = new Set<string>();
        for (const p of projects || []) if (p.managed_client_id) managedIdSet.add(p.managed_client_id);
        for (const c of containers || []) if (c.managed_client_id) managedIdSet.add(c.managed_client_id);
        const managedNames = new Map<string, string>();
        if (managedIdSet.size) {
          const { data: mcs } = await admin
            .from("managed_clients")
            .select("id, full_name, company, email")
            .in("id", Array.from(managedIdSet));
          for (const m of mcs || []) managedNames.set(m.id, (m as any).full_name || (m as any).company || (m as any).email || "Client");
        }

        async function ensureClientRoot(clientId: string) {
          const { data: existing } = await admin
            .from("drive_folders")
            .select("id")
            .eq("agency_id", agencyId)
            .eq("client_id", clientId)
            .eq("kind", "client_root")
            .maybeSingle();
          if (existing) return existing.id as string;
          const { data: ins } = await admin
            .from("drive_folders")
            .insert({
              agency_id: agencyId,
              parent_id: null,
              name: names.get(clientId) || "Client",
              kind: "client_root",
              client_id: clientId,
              created_by: user.id,
            })
            .select("id").single();
          return ins!.id as string;
        }

        async function ensureManagedClientRoot(managedId: string) {
          const desiredName = managedNames.get(managedId) || "Client";
          const { data: existing } = await admin
            .from("drive_folders")
            .select("id, name")
            .eq("agency_id", agencyId)
            .eq("managed_client_id", managedId)
            .eq("kind", "client_root")
            .maybeSingle();
          if (existing) {
            if (existing.name !== desiredName) {
              await admin.from("drive_folders").update({ name: desiredName }).eq("id", existing.id);
            }
            return existing.id as string;
          }
          const { data: ins } = await admin
            .from("drive_folders")
            .insert({
              agency_id: agencyId,
              parent_id: null,
              name: desiredName,
              kind: "client_root",
              managed_client_id: managedId,
              created_by: user.id,
            })
            .select("id").single();
          return ins!.id as string;
        }

        async function ensureContainerRoot(containerId: string, parentId: string, title: string) {
          const { data: existing } = await admin
            .from("drive_folders")
            .select("id, parent_id, name")
            .eq("agency_id", agencyId)
            .eq("container_id", containerId)
            .eq("kind", "container_root")
            .maybeSingle();
          if (existing) {
            if (existing.parent_id !== parentId) {
              await admin.from("drive_folders").update({ parent_id: parentId }).eq("id", existing.id);
            }
            return existing.id as string;
          }
          const { data: ins } = await admin
            .from("drive_folders")
            .insert({
              agency_id: agencyId,
              parent_id: parentId,
              name: title || "Project",
              kind: "container_root",
              container_id: containerId,
              created_by: user.id,
            })
            .select("id").single();
          return ins!.id as string;
        }

        for (const p of projects || []) {
          // Resolve target client (container wins, fall back to project)
          const ctn = p.container_id ? containerById.get(p.container_id) : null;
          const clientId = ctn?.client_id || p.client_id;
          const managedClientId = ctn?.managed_client_id || p.managed_client_id;

          let targetParentId: string | null = null;
          if (clientId) {
            const clientRootId = await ensureClientRoot(clientId);
            targetParentId = clientRootId;
            if (ctn) {
              targetParentId = await ensureContainerRoot(ctn.id, clientRootId, ctn.title);
            }
          } else if (managedClientId) {
            const clientRootId = await ensureManagedClientRoot(managedClientId);
            targetParentId = clientRootId;
            if (ctn) {
              targetParentId = await ensureContainerRoot(ctn.id, clientRootId, ctn.title);
            }
          }

          // Ensure project_root (= Video folder) sits under correct parent
          const { data: existing } = await admin
            .from("drive_folders")
            .select("id, parent_id, name")
            .eq("agency_id", agencyId)
            .eq("project_id", p.id)
            .eq("kind", "project_root")
            .maybeSingle();
          if (!existing) {
            await admin.from("drive_folders").insert({
              agency_id: agencyId,
              parent_id: targetParentId,
              name: p.title || "Untitled video",
              kind: "project_root",
              project_id: p.id,
              created_by: user.id,
            });
          } else if (existing.parent_id !== targetParentId) {
            await admin.from("drive_folders").update({ parent_id: targetParentId }).eq("id", existing.id);
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
