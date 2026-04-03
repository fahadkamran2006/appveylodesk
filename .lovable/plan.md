

# Quality Check Pipeline + Video Locking System

## Overview

This feature introduces a **Quality Check (QC) stage** in the Kanban workflow and a **per-deliverable lock mechanism** that controls client download access. Here is the full flow:

1. Editor uploads a deliverable → video lands in **"Quality Check"** status (not visible to clients)
2. Admin reviews the video in QC
3. Admin moves video from QC → **"Delivered"** with a toggle to **lock** the video
4. If locked, admin can immediately create and link an invoice to that video
5. Client can **view** locked videos but **cannot download** them until the linked invoice is paid

## Database Changes

### 1. Add `quality_check` to the `project_status` enum
A new Kanban column for internal QC review.

```sql
ALTER TYPE public.project_status ADD VALUE 'quality_check' BEFORE 'done';
```

### 2. Add `is_locked` and `linked_invoice_id` columns to `deliverables` table
Per-file lock status and invoice linkage.

```sql
ALTER TABLE public.deliverables
  ADD COLUMN is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN linked_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;
```

### 3. Update RLS policies on `deliverables`
- Clients can SELECT deliverables only when the parent project status is NOT `quality_check`
- Existing admin/editor policies remain unchanged (full access)

## Frontend Changes

### 1. Kanban Board — Add "Quality Check" column
**File:** `src/pages/admin/Projects.tsx` and `src/components/projects/KanbanColumn.tsx`
- Add `quality_check` to the `COLUMNS` array (between "Review" and "Delivered")
- Add styling for the new column (blue/indigo theme)
- Update `ProjectStatus` type union

### 2. Auto-route editor uploads to Quality Check
**File:** `src/hooks/useStorage.tsx` or upload flow
- When an editor uploads a deliverable to a project, if the project is in `in_progress`, automatically transition it to `quality_check`
- Only admin can move projects out of `quality_check` → `done`

### 3. Client project visibility — Hide QC projects
**Files:** `src/pages/client/Projects.tsx`
- Filter out projects with `status = 'quality_check'` from client views
- Clients should not see videos until admin moves them to "Delivered"

### 4. Deliver + Lock Modal (Admin only)
**File:** New `src/components/projects/DeliverVideoModal.tsx`
- Triggered when admin drags/moves a video from Quality Check → Delivered
- Contains:
  - Toggle: "Lock video (require payment before download)"
  - If lock is ON: option to create a new invoice or link an existing unpaid invoice
  - Inline invoice creation form (amount, due date, notes) — reuses existing invoice creation logic
- On confirm: updates project status to `done`, sets `is_locked` on deliverables, creates/links invoice

### 5. Download gating per deliverable
**File:** `src/components/projects/FileManager.tsx`
- Replace the previous project-level `useDownloadGate` approach with per-deliverable `is_locked` check
- For clients: if `deliverable.is_locked === true`, show a lock icon instead of download, with tooltip "Payment required"
- Admin can unlock individual files from the ProjectDetailSheet

### 6. ProjectDetailSheet — Lock management
**File:** `src/components/projects/ProjectDetailSheet.tsx`
- Admin sees lock/unlock toggle per deliverable in the file list
- Shows linked invoice status badge (Paid/Unpaid) next to locked files
- When invoice is paid, auto-unlock the linked deliverables (via DB trigger or client-side check)

### 7. Auto-unlock on invoice payment
**Migration:** Create a database trigger on `invoices` table
- When `status` changes to `paid`, set `is_locked = false` on all deliverables where `linked_invoice_id` matches

## Technical Details

- The `quality_check` status is admin/editor-only — RLS on `projects` will filter it out for client role queries
- The drag-and-drop handler in `handleDragEnd` will intercept QC → Done transitions to show the DeliverVideoModal
- Invoice linking uses the existing `invoices` table with `project_id` — the new `linked_invoice_id` on deliverables provides granular per-file linkage
- The auto-unlock trigger ensures files become downloadable immediately when payment is confirmed

## Files to Create
1. `src/components/projects/DeliverVideoModal.tsx` — Modal for admin to deliver + lock + invoice

## Files to Edit
1. `src/components/projects/KanbanColumn.tsx` — Add QC column type + styling
2. `src/pages/admin/Projects.tsx` — Add QC column, intercept drag to show modal
3. `src/pages/client/Projects.tsx` — Filter out QC status
4. `src/components/projects/FileManager.tsx` — Per-deliverable lock UI
5. `src/components/projects/ProjectDetailSheet.tsx` — Lock management UI
6. `src/hooks/useStorage.tsx` — Pass lock state through deliverable type
7. Database migration — Enum update, columns, trigger, RLS

