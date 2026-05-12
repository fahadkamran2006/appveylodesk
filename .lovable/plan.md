
# Drive-style Storage Rebuild

Turn the Storage page into a true Google-Drive-like file manager: browsable folders, custom user folders, previews, grid/list views, and public share links that let outsiders download from or upload into a folder without an account.

## 1. Data model (new tables)

```text
drive_folders
  id, agency_id, parent_id (nullable, self-FK), name,
  created_by, owner_role, kind ('custom' | 'project_root'),
  project_id (nullable — links to existing project for unification),
  created_at, updated_at
```

- A virtual root per agency holds: each project as a `project_root` folder + any `custom` folders.
- `project_root` folders are auto-synced from existing `projects` (read-only name/icon).
- Custom folders can be nested.

```text
drive_files            -- new files uploaded directly into Drive
  id, agency_id, folder_id, file_name, file_url, file_size,
  mime_type, uploaded_by (nullable for anon), uploader_label,
  source ('user' | 'public_link'), share_link_id (nullable),
  created_at
```

Existing project `deliverables` keep working as-is and surface inside their `project_root` folder via a UNION view `drive_items_v` (id, kind: 'folder'|'file', folder_id, name, size, mime, created_at, source_table).

```text
drive_share_links
  id, agency_id, folder_id, created_by, token (uuid, indexed),
  permission ('view' | 'download' | 'upload' | 'full'),
  password_hash (nullable), expires_at (nullable),
  max_upload_bytes (per-link cap), max_files (nullable),
  used_bytes, used_files,
  is_revoked, created_at

drive_share_uploads     -- audit of anon uploads
  id, share_link_id, file_id, uploader_name, uploader_email (optional),
  ip_hash, created_at
```

RLS:
- `drive_folders`/`drive_files`: agency members SELECT; admins ALL; editors/clients can INSERT/UPDATE/DELETE inside folders they created OR project folders they have access to.
- `drive_share_links`: only admins + the editor who created it can manage; SELECT public is denied (resolved server-side via edge function).

## 2. Edge functions

- `drive-share-resolve` (no JWT) — input: token + optional password. Returns folder metadata, file list (signed URLs), and capabilities. Validates expiry/revocation.
- `drive-share-upload` (no JWT) — TUS/presigned init for anonymous uploads. Enforces:
  - link permission includes `upload`
  - per-link `max_upload_bytes` / `max_files` cap
  - **agency quota** via `check_storage_limit(agency_id, file_size)` — reuses existing function
  - Writes to Bunny under `agency/{agency_id}/drive/{folder_id}/...`, then inserts `drive_files` row with `source='public_link'`.
- `drive-ops` — authenticated CRUD for folders, move, rename, delete (cascades to Bunny via existing `delete-asset` patterns), and signed-URL generation for previews.

Reuse existing `UploadContext` + TUS flow for in-app uploads; pass `folder_id` instead of (or alongside) `project_id`.

## 3. Frontend

### New `/storage` (all roles)

```text
┌──────────────────────────────────────────────────┐
│ Breadcrumb: My Drive / Clients / Acme / Raw      │
│ [+ New ▾] [Upload] [Share]      [Grid|List] [⌕] │
├──────────────┬───────────────────────────────────┤
│ Sidebar      │  Folder grid / list               │
│ • My Drive   │  ┌────┐ ┌────┐ ┌────┐             │
│ • Shared     │  │📁  │ │📁  │ │🎬  │             │
│ • Recent     │  └────┘ └────┘ └────┘             │
│ • Trash      │                                   │
│ • Storage    │                                   │
└──────────────┴───────────────────────────────────┘
```

Components (new):
- `src/pages/storage/DrivePage.tsx` — replaces current `StoragePage` body, route stays `/storage`.
- `src/components/drive/DriveSidebar.tsx`, `DriveBreadcrumb.tsx`, `DriveToolbar.tsx`.
- `src/components/drive/FolderGrid.tsx` + `FolderList.tsx` (shared item card/row).
- `src/components/drive/NewFolderModal.tsx`, `ShareLinkModal.tsx` (permission, password, expiry, size cap), `SharedLinksManager.tsx`.
- `src/components/drive/FilePreview.tsx` — extends existing `FilePreviewModal` with image/video/PDF/audio/text preview + next/prev navigation.
- `src/hooks/useDrive.tsx` — list folder, create/rename/move/delete, share-link CRUD.
- View mode persisted in `localStorage` (`drive:viewMode`).

### Public share page

- `src/pages/share/SharePage.tsx` at `/s/:token` (no auth).
- Optional password gate.
- Shows folder contents with the same grid/list UI in read-only mode.
- If `permission` includes `upload`: dropzone + name/email prompt, uses TUS via `drive-share-upload`.
- Brand-aware (uses `BrandingContext` agency logo).

### Grid/List toggle everywhere

Extract a reusable `<FileListView mode="grid|list" items=... />` and adopt it in:
- `src/components/projects/FileManager.tsx` (project file lists)
- `src/pages/review/InternalReview.tsx` & `PublicReview.tsx` asset rails
- `DrivePage` and `SharePage`

A small `useViewMode(key)` hook stores preference per surface.

## 4. UX details

- Drag-and-drop into any folder; multi-select with shift/ctrl.
- Right-click / kebab menu: Open, Preview, Download, Share, Rename, Move, Delete.
- "Share" on a folder opens `ShareLinkModal` → copies `https://app/s/<token>` and shows existing links list with revoke.
- Upload progress reuses `GlobalUploadTray`.
- Empty state encourages "New folder" / "Upload" / "Get share link".

## 5. Quotas & safety

- Anonymous uploads: enforce per-link cap **and** agency quota at the edge before issuing TUS URL; reject early with clear error.
- Hash IP + rate-limit anon uploads per token (e.g., 50/hour).
- `drive_share_links.password_hash` uses bcrypt in edge function.
- Auto-expire links (cron via existing pg_cron pattern or check at resolve time).

## 6. Migration / rollout

1. Migration: create the four new tables, RLS policies, indexes, and a `drive_items_v` view that unions folders + `drive_files` + `deliverables` (mapped into their project's root folder).
2. Backfill: for every project, create a `drive_folders` row with `kind='project_root'`, `project_id=projects.id`. Optionally group by client into a `Clients/<client>` folder tree.
3. Ship edge functions, then frontend `DrivePage` behind the existing `/storage` route; old grouped view replaced in the same release.
4. Add `/s/:token` public route to `App.tsx` router.
5. Roll out grid/list view component to FileManager + review pages last (purely visual).

## 7. Out of scope (for this pass)

- Real "Trash" with restore (soft-delete possible later).
- Folder-level granular per-member ACLs beyond agency role (admins/editors/clients see what they can today, plus their own custom folders).
- Office-doc inline editing.

---

**Net result:** one familiar Drive-like surface for admins, editors, and clients; outsiders can be invited via a single link to download files or drop files into a folder, with quotas enforced — no account required.
