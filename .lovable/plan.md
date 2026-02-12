

# Download Manager

## The Problem

When you click download, the app fetches the entire video through the backend function, buffers it completely in browser memory (`response.blob()`), and only **then** triggers the browser's download dialog. For a 500MB video, this means waiting minutes with no visible progress before the download "starts."

## The Solution

Build a **Download Manager** that mirrors the existing Upload Tray -- a persistent, minimizable panel in the bottom-right corner that shows real-time download progress with speed, ETA, and cancel support.

The key technical change: instead of `response.blob()` (which buffers everything), we read the response as a **stream** chunk-by-chunk, tracking bytes received in real time.

## What You Will See

- When you click Download on any file, it immediately appears in a **Download Tray** at the bottom-right (just like the upload tray).
- Each download shows: file name, progress bar, speed (MB/s), and estimated time remaining.
- You can **cancel** individual downloads mid-stream.
- When complete, the file auto-saves to your computer.
- The tray is minimizable and shows a badge count of active downloads.
- Both Bunny Stream videos (proxied through the backend) and regular CDN files go through the same manager.

## Technical Details

### 1. Create Download Context (`src/contexts/DownloadContext.tsx`)

A React Context (mirroring `UploadContext`) that manages a queue of downloads:

```text
QueuedDownload {
  id, fileName, fileSize,
  status: 'downloading' | 'completed' | 'failed' | 'cancelled',
  progress (0-100), speed (bytes/sec), remainingTime,
  abortController (for cancellation)
}
```

Core logic:
- `startDownload(deliverableId, fileName, fileUrl)` -- determines if it is a Bunny Stream video or CDN file, then fetches using `ReadableStream` reader to track progress chunk-by-chunk.
- Uses `Content-Length` header from the response to calculate percentage.
- Assembles chunks into a `Blob` only at the end, then triggers `<a download>`.
- `cancelDownload(id)` -- calls `abortController.abort()` to stop mid-stream.
- `clearCompleted()` -- removes finished items from the tray.

### 2. Create Download Tray UI (`src/components/download/GlobalDownloadTray.tsx`)

A fixed-position panel matching the style of the existing `GlobalUploadTray`:
- Appears only when there are active or recent downloads.
- Minimizable to a small pill showing count.
- Each item shows file icon, name, progress bar, speed, ETA, and cancel/clear buttons.
- Completed items show a green checkmark.
- Failed items show retry button.

### 3. Wire Up Download Tray in App Layout

Add `<DownloadProvider>` wrapping the app in `src/App.tsx` and render `<GlobalDownloadTray />` alongside the existing `<GlobalUploadTray />`.

### 4. Update All Download Triggers

Replace the current `response.blob()` pattern in these files with calls to `downloadContext.startDownload()`:
- `src/components/ui/file-preview-modal.tsx` -- the preview modal download button
- `src/components/projects/FileManager.tsx` -- the file list download button
- `src/pages/storage/StoragePage.tsx` -- the storage page download button

Each call simply adds the download to the queue and the context handles the rest. The download button immediately shows feedback (item appears in tray) instead of waiting silently.

### 5. Streaming Read Pattern (the core fix)

```text
const response = await fetch(url, { signal: abortController.signal });
const contentLength = +response.headers.get('Content-Length');
const reader = response.body.getReader();
const chunks = [];
let received = 0;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  chunks.push(value);
  received += value.length;
  // Update progress, speed, ETA in real time
}

const blob = new Blob(chunks);
// Trigger browser download via <a> tag
```

This means the progress bar updates in real time as data arrives, rather than sitting at 0% until the entire file is buffered.

