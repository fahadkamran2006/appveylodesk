

## Fix Client Projects Page to Enforce Strict 3-Tier Hierarchy

### Problem
The Client Dashboard (`/client/dashboard`) correctly enforces the hierarchy, but the Client Projects page (`/client/projects`) has leftover UI from the old workflow that lets clients create projects and submit proposals -- bypassing Admin-only project creation and the new video request approval flow.

### Changes

#### 1. Remove all "Create Project" UI from `/client/projects`

In `src/pages/client/Projects.tsx`:

- Remove the "New Project" button from the header (lines 267-270)
- Remove the dashed "Add Project" card from the grid (lines 351-363)
- Replace the empty state "Create Your First Project" button with the correct message: "Your admin will create projects for you. Once you have projects, you can request videos."
- Remove the import of `ClientCreateProjectModal` and its state/JSX entirely

#### 2. Replace `ClientProposalModal` with `ClientRequestVideoModal`

In `src/pages/client/Projects.tsx`:

- Replace the import of `ClientProposalModal` with `ClientRequestVideoModal`
- Change the "New Video" button (shown when inside a project board) to open `ClientRequestVideoModal` instead
- Pass the `preselectedContainerId` as a prop so the project dropdown is pre-filled when the client is already browsing a specific project
- Update `ClientRequestVideoModal` to accept and use an optional `preselectedContainerId` prop (auto-select the container in the dropdown)
- Remove `proposalModalOpen` state and the `ClientProposalModal` JSX

#### 3. Add `'request'` to the status config map

In `src/pages/client/Projects.tsx`:

- Add a `request` entry to the `statusConfig` object with a label like "Requested", an appropriate icon (e.g., `Send`), and a distinct badge style (e.g., orange/amber tones)

#### 4. (Optional cleanup) Delete `ClientCreateProjectModal` component

Since it is no longer needed by any page, the file `src/components/projects/ClientCreateProjectModal.tsx` can be removed to prevent future misuse.

### Technical Details

**Files modified:**
- `src/pages/client/Projects.tsx` -- Remove project creation UI; swap proposal modal for request modal; add `request` status styling
- `src/components/projects/ClientRequestVideoModal.tsx` -- Add optional `preselectedContainerId` prop to auto-select a container

**File deleted:**
- `src/components/projects/ClientCreateProjectModal.tsx`

**No database or RLS changes needed** -- the schema and policies are already correct. This is purely a frontend enforcement fix.

