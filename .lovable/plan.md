

# Fix Downloads: Images Immediately + Video Storage Proxy

## Overview

This plan fixes two issues:
1. **Image/PDF downloads broken** - Regular files are incorrectly detected as Stream videos due to overly liberal GUID matching
2. **Video downloads failing with 403** - Token Authentication on the Pull Zone is blocking downloads; we'll bypass this using the Bunny Storage API directly

## What Will Change

### Part 1: Fix Image Downloads (Stricter Detection)

The current `extractBunnyStreamVideoId` function matches ANY GUID in a URL. This means regular files like `https://veylodesk.b-cdn.net/abc-123-def/image.jpg` get treated as Stream videos if the path contains a GUID-like pattern.

**Fix**: Create a new strict detection function that only identifies true Bunny Stream videos by checking for:
- Host contains `vz-` prefix (Stream Pull Zone pattern)
- Path contains `/playlist.m3u8`
- OR URL is from `iframe.mediadelivery.net`

Regular CDN files on `veylodesk.b-cdn.net` will use direct `window.open()` download (no Token Auth needed there).

### Part 2: Video Downloads via Storage API Proxy

Instead of trying to sign Pull Zone URLs, we'll fetch directly from Bunny's Storage API which uses a simpler API key authentication:

```text
Storage URL: https://storage.bunnycdn.com/vz-b78eeeb2-7b9/{VIDEO_ID}/original
AccessKey: a32ab757-90c7-41b3-868dbd75ccf2-95cc-40d0
```

The edge function will:
1. Fetch the video from Storage API with the access key
2. Stream it back to the browser with `Content-Disposition: attachment; filename="[Title].mp4"`

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/bunnyStream.ts` | Add `isDefinitelyBunnyStreamUrl()` function for strict Stream detection |
| `src/components/projects/FileManager.tsx` | Use strict check; regular files use direct `window.open()` |
| `src/components/ui/file-preview-modal.tsx` | Use strict check for download routing |
| `supabase/functions/bunny-ops/index.ts` | Replace download logic with Storage API proxy |

---

## Technical Details

### 1. New Detection Function (`bunnyStream.ts`)

```text
isDefinitelyBunnyStreamUrl(url):
  - Returns TRUE if:
    - URL host starts with "vz-" AND includes ".b-cdn.net" AND path includes "playlist.m3u8"
    - OR URL includes "iframe.mediadelivery.net"
  - Returns FALSE for everything else (including regular CDN files)
```

### 2. FileManager.tsx Download Logic

```text
handleDownload(deliverable):
  |
  +--> Is file_url a definite Bunny Stream URL? (new strict check)
  |      |
  |      YES --> Call download_stream edge function
  |
  |      NO --> Direct window.open(file_url) - works immediately
```

### 3. Edge Function Storage API Proxy

The `download_stream` action will be simplified to:

```text
1. Get deliverable from database (file_url, file_name)
2. Extract video ID from file_url
3. Fetch from: https://storage.bunnycdn.com/vz-b78eeeb2-7b9/{videoId}/original
   Headers: { AccessKey: "a32ab757-90c7-41b3-868dbd75ccf2-95cc-40d0" }
4. Stream response with:
   - Content-Type: video/mp4
   - Content-Disposition: attachment; filename="{sanitized_filename}.mp4"
```

### 4. New Secret Required

A new Supabase secret will store the Stream Storage API key:
- Name: `BUNNY_STREAM_STORAGE_KEY`
- Value: `a32ab757-90c7-41b3-868dbd75ccf2-95cc-40d0`

---

## Expected Results

After implementation:
- **Images/PDFs**: Download immediately via direct browser navigation (no auth needed)
- **Videos**: Download via Storage API proxy with correct `.mp4` filename
- **No more 403 errors**: Storage API uses simple API key auth, not Token Authentication

---

## Implementation Sequence

1. Add the `BUNNY_STREAM_STORAGE_KEY` secret to Supabase
2. Update `src/lib/bunnyStream.ts` with stricter detection
3. Update `FileManager.tsx` to route correctly
4. Update `file-preview-modal.tsx` to match
5. Simplify `bunny-ops` to use Storage API for video downloads

