

# Fix Constant Reloading + Download Button Issues

## Overview

This plan addresses two issues:
1. **UX: Constant reloading** - App fetches data every time window gains focus
2. **Download buttons may fail** - Both image 403s and ensuring video downloads use the proxy

## Issue 1: Stop Constant Reloading

### Current State
In `App.tsx` (line 49), the QueryClient is created with no configuration:
```typescript
const queryClient = new QueryClient();
```

By default, React Query refetches all queries when the window regains focus, which causes spinners and data refreshes every time the user switches tabs.

### Solution
Configure QueryClient with `refetchOnWindowFocus: false`:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});
```

---

## Issue 2: Download Buttons Analysis

### Current FileManager.tsx Logic (Already Implemented)
Looking at lines 126-187 of `FileManager.tsx`, the download logic is:
1. Check if URL is a Bunny Stream video using `isDefinitelyBunnyStreamUrl()`
2. If Stream video: Call `bunny-ops` edge function with `action: download_stream`
3. If not Stream: Use `window.open(file_url, '_blank')`

### Current Detection Logic
The `isDefinitelyBunnyStreamUrl()` function (lines 18-48 in `bunnyStream.ts`) correctly identifies:
- **Stream videos**: URLs starting with `vz-` and containing `playlist.m3u8` (e.g., `https://vz-582147.b-cdn.net/{guid}/playlist.m3u8`)
- **Regular CDN files**: URLs on `veylodesk.b-cdn.net` are correctly NOT matched

### Database Verification
Queried the database and confirmed:
- Videos have URLs like: `https://vz-582147.b-cdn.net/{guid}/playlist.m3u8`
- Images have URLs like: `https://veylodesk.b-cdn.net/{projectId}/{filename}`

The detection logic correctly differentiates these.

### Potential Image 403 Issue
If images on `veylodesk.b-cdn.net` are failing with 403:
- This could be a Bunny CDN configuration issue (Hotlink Protection or Geo-blocking)
- Or browser popup blocking
- The code itself appears correct

### Recommended Enhancement
To ensure downloads work reliably, change `window.open()` to use the anchor tag download method which provides better cross-browser support:

```typescript
// Instead of: window.open(deliverable.file_url, '_blank');
// Use:
const a = document.createElement('a');
a.href = deliverable.file_url;
a.download = deliverable.file_name;
a.target = '_blank';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
```

This triggers the browser's native download behavior rather than opening a new tab.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add `refetchOnWindowFocus: false` to QueryClient configuration |
| `src/components/projects/FileManager.tsx` | Replace `window.open()` for regular files with anchor download method |

---

## Technical Details

### App.tsx Changes

**Before (line 49):**
```typescript
const queryClient = new QueryClient();
```

**After:**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});
```

### FileManager.tsx Changes

**Replace lines 184-186** (regular CDN file download):
```typescript
// For regular CDN files (images, PDFs, etc.), use anchor download method
// This works better than window.open for triggering actual downloads
const a = document.createElement('a');
a.href = deliverable.file_url;
a.download = deliverable.file_name;
a.target = '_blank';
a.rel = 'noopener noreferrer';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
```

This approach:
- Uses the `download` attribute to suggest the filename
- Falls back to opening in new tab if CORS prevents download
- Works more reliably across browsers than `window.open()`

---

## Expected Results

After implementation:
- **No more constant reloading**: App won't refetch data on window focus
- **Reliable video downloads**: Already working via Storage API proxy
- **Better image downloads**: Anchor method is more reliable than `window.open()`

