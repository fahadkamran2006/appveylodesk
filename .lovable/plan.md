

## Fix Three Issues: Editor Compensation Update, Duplicate Button, and Project Deletion

### Issue 1: Editor Compensation Update Fails Silently

**Root Cause:** The `profiles` table has an RLS policy that only allows users to update their own profile (`auth.uid() = id`). When an Admin tries to change an editor from "freelance" to "salaried," the update silently fails (0 rows affected) but the code doesn't check for that, so it shows "Editor updated" even though nothing changed.

**Fix:** Add a new RLS policy allowing admins to update profiles of users within their agency.

**Database migration:**
```sql
CREATE POLICY "Admins can update profiles in their agency"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM user_roles ur_admin
    JOIN user_roles ur_target ON ur_target.agency_id = ur_admin.agency_id
    WHERE ur_admin.user_id = auth.uid()
    AND ur_admin.role = 'admin'::app_role
    AND ur_target.user_id = profiles.id
  )
);
```

Additionally, update `EditEditorModal.tsx` to verify that the update actually affected a row by checking the response data, so errors are surfaced properly.

---

### Issue 2: Duplicate "New Project" Buttons

**Root Cause:** The `ClientProjectsGrid` component has its own "+ New Project" button in the header (line 53) AND a dashed "Add Project" card at the end of the grid (line 116). On top of that, the parent `Projects.tsx` page also renders a "+ New Project" button in its own header bar (line 534). This results in up to three create-project triggers visible at once.

**Fix:** Remove the "+ New Project" button from the top-right header bar in `Projects.tsx` (lines 533-541) when in the `isClientProjectsView` state. The `ClientProjectsGrid` component already provides adequate create-project entry points (the header button and the dashed card). This eliminates the duplicate without losing any functionality.

---

### Issue 3: Add Project Container Deletion (with Cascade)

**Root Cause:** There is currently no way to delete a project container (folder). The `ProjectDetailSheet` only handles deleting individual videos. When an admin wants to remove an entire project folder and all its videos + files, there is no UI or logic for it.

**Fix:**
1. Add a "Delete Project" button (with trash icon) to each project container card in `ClientProjectsGrid.tsx`.
2. Show a confirmation dialog warning that all videos and their files inside will be permanently deleted.
3. Implement cascade deletion logic:
   - For each video (from `projects` table) inside the container, call the `delete-asset` edge function to remove physical files from storage.
   - Delete all video records (`projects` table rows) linked to the container.
   - Delete the container record from `project_containers`.
4. Refresh the data after successful deletion.

---

### Technical Summary

| File | Change |
|------|--------|
| **New migration** | Add RLS policy for admin profile updates |
| `src/components/admin/EditEditorModal.tsx` | Add row-count check after update |
| `src/pages/admin/Projects.tsx` | Remove duplicate "New Project" button from header when in client view; add container deletion handler |
| `src/components/projects/ClientProjectsGrid.tsx` | Add delete button + confirmation dialog for project containers |

