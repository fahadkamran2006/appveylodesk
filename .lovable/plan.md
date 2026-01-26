
# Plan: Fix Bunny Stream Video Download Naming Issue

## Problem Summary
When users download Bunny Stream videos, the file is saved as "original" without an extension because:
1. Bunny stores the original file at `/{videoId}/original` (no `.mp4` extension)
2. The browser saves the file with the name from the URL path, not as a video file
3. Users must manually rename the file to add `.mp4` for their OS to recognize it

## Solution Overview
Create a **proxy download** through an edge function that fetches the file from Bunny's Storage API (which works) and serves it to the browser with the correct `Content-Disposition: attachment; filename="[Video_Title].mp4"` header, forcing the browser to save with the proper name.

## Implementation Steps

### Step 1: Add New Edge Function Action - `download_stream`
Add a new action to the existing `bunny-ops` edge function that:
1. Accepts a `deliverableId` parameter
2. Looks up the deliverable to get the `file_name` (video title) and `file_url`
3. Extracts the video ID from the Bunny Stream URL
4. Fetches the original file from Bunny Storage using the authenticated Storage API
5. Streams it back to the client with proper headers

**Technical Details:**
- URL Pattern: `https://storage.bunnycdn.com/{STREAM_LIBRARY_ID}/__videos/{videoId}/original`
- Authentication: Uses `BUNNY_STREAM_API_KEY` as the `AccessKey` header
- Response Headers:
  - `Content-Type: video/mp4`
  - `Content-Disposition: attachment; filename="[sanitized_file_name].mp4"`

### Step 2: Update Frontend Download Logic
Modify the `handleDownload` functions in two files:
1. `src/components/projects/FileManager.tsx`
2. `src/components/ui/file-preview-modal.tsx`

**New Logic:**
- For Bunny Stream videos, construct a URL to the edge function: 
  `${SUPABASE_URL}/functions/v1/bunny-ops?action=download_stream&deliverableId={id}`
- Open this URL in a new tab (or use an anchor with `download` attribute)
- The edge function will handle the authentication and return the file with proper headers

### Step 3: Filename Sanitization
Ensure the video title is properly sanitized for use as a filename:
- Remove invalid characters (`/ \ : * ? " < > |`)
- Ensure it ends with `.mp4` extension
- Use a fallback name if title is empty/invalid

---

## Technical Details

### Edge Function Changes (`supabase/functions/bunny-ops/index.ts`)

```text
New action: "download_stream"

Parameters:
- deliverableId: string (required)

Flow:
1. Authenticate user
2. Fetch deliverable from DB (get file_name, file_url, project_id)
3. Verify user has access to the project
4. Extract video ID from file_url
5. Build Storage API URL: https://storage.bunnycdn.com/{LIBRARY_ID}/__videos/{videoId}/original
6. Fetch from Bunny with AccessKey header
7. Stream response to client with:
   - Content-Type: video/mp4
   - Content-Disposition: attachment; filename="{sanitized_title}.mp4"
```

### Frontend Changes

**FileManager.tsx:**
```text
Update handleDownload callback:
- If Bunny Stream video, redirect to edge function URL with deliverableId
- Keep existing logic for non-stream files
```

**file-preview-modal.tsx:**
```text
Update handleDownload function:
- Need access to file.id (already available)
- If stream video, redirect to edge function download endpoint
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/bunny-ops/index.ts` | Add `download_stream` action with proxy download logic |
| `src/components/projects/FileManager.tsx` | Update `handleDownload` to use edge function for stream videos |
| `src/components/ui/file-preview-modal.tsx` | Update `handleDownload` to use edge function for stream videos |

---

## Edge Cases Handled

1. **Missing file_name**: Fall back to `video-{videoId}.mp4`
2. **Invalid characters in filename**: Sanitize to remove OS-incompatible characters
3. **Non-MP4 files**: Force `.mp4` extension since Bunny transcodes to MP4
4. **Large files**: Edge function streams the response rather than buffering entirely
5. **Authentication**: Requires valid user session to download

## Benefits
- Downloads work reliably using the proven Storage API path
- Files save with correct `.mp4` extension and recognizable title
- No manual renaming required by users
- Works across all browsers and operating systems
