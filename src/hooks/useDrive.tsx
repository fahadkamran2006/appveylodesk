import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DriveFolder {
  id: string;
  name: string;
  kind: "custom" | "project_root";
  parent_id: string | null;
  project_id: string | null;
  created_by: string;
  created_at: string;
}

export interface DriveFile {
  id: string;
  folder_id: string | null;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type?: string | null;
  source: string;
  uploaded_by?: string | null;
  uploader_label?: string | null;
  created_at: string;
}

export interface DriveCrumb { id: string; name: string }

async function call(action: string, payload: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("drive-ops", {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export function useDriveFolder(folderId: string | null) {
  return useQuery({
    queryKey: ["drive", "folder", folderId],
    queryFn: async () => {
      const data = await call("list_folder", { folderId });
      return data as { folders: DriveFolder[]; files: DriveFile[]; breadcrumb: DriveCrumb[] };
    },
    staleTime: 60_000,
  });
}

export function useDrive() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["drive"] });
  }, [qc]);

  const createFolder = useCallback(async (name: string, parentId: string | null) => {
    setBusy(true);
    try {
      await call("create_folder", { name, parentId });
      invalidate();
      toast({ title: "Folder created" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  }, [invalidate, toast]);

  const renameFolder = useCallback(async (folderId: string, name: string) => {
    try { await call("rename_folder", { folderId, name }); invalidate(); }
    catch (e: any) { toast({ title: "Rename failed", description: e.message, variant: "destructive" }); }
  }, [invalidate, toast]);

  const deleteFolder = useCallback(async (folderId: string) => {
    try { await call("delete_folder", { folderId }); invalidate(); toast({ title: "Folder deleted" }); }
    catch (e: any) { toast({ title: "Delete failed", description: e.message, variant: "destructive" }); }
  }, [invalidate, toast]);

  const deleteFile = useCallback(async (fileId: string) => {
    try { await call("delete_file", { fileId }); invalidate(); toast({ title: "File deleted" }); }
    catch (e: any) { toast({ title: "Delete failed", description: e.message, variant: "destructive" }); }
  }, [invalidate, toast]);

  const registerFile = useCallback(async (params: {
    folderId: string; fileName: string; fileUrl: string; fileSize: number; mimeType?: string;
  }) => {
    await call("register_file", params);
    invalidate();
  }, [invalidate]);

  const syncProjectFolders = useCallback(async () => {
    try { await call("sync_project_folders"); invalidate(); }
    catch (e: any) { console.error(e); }
  }, [invalidate]);

  const createShareLink = useCallback(async (params: {
    folderId?: string; fileId?: string;
    permission: "view" | "download" | "upload" | "full";
    password?: string; expiresAt?: string | null;
    maxUploadBytes?: number | null; maxFiles?: number | null;
  }) => {
    const data = await call("create_share_link", params);
    invalidate();
    return data.link;
  }, [invalidate]);

  const listShareLinks = useCallback(async (target?: { folderId?: string; fileId?: string } | string) => {
    const payload = typeof target === "string" ? { folderId: target } : (target || {});
    const data = await call("list_share_links", payload);
    return data.links;
  }, []);

  const revokeShareLink = useCallback(async (linkId: string) => {
    await call("revoke_share_link", { linkId });
    invalidate();
  }, [invalidate]);

  return {
    busy,
    createFolder, renameFolder, deleteFolder, deleteFile, registerFile,
    syncProjectFolders, createShareLink, listShareLinks, revokeShareLink,
  };
}
