

# Timestamps in Review Section with Bunny.net Video Player

## Current State

The system already has most of the infrastructure in place:

1. **Public Review page** (`PublicReview.tsx`) already captures `currentTime` from the Bunny iframe via `postMessage` polling and displays clickable timestamp badges on comments (lines 498-504). The `seekTo` method on `VideoPlayer` already sends `setCurrentTime` postMessage to the Bunny iframe (lines 194-208).

2. **Internal Comment Panel** (`CommentPanel.tsx`) does NOT show timestamps at all and does NOT support click-to-seek.

3. **`useVideoComments` hook** stores `timestamp_seconds` but `addComment` always hardcodes it to `0` (line 101).

## What Needs to Change

### 1. Fix `addComment` to accept a timestamp parameter
In `useVideoComments.tsx`, change the `addComment` function signature to accept an optional `timestampSeconds` parameter instead of hardcoding `0`.

### 2. Add timestamps to the internal CommentPanel
Update `CommentPanel.tsx` to:
- Accept an `onSeekToTimestamp` callback prop
- Display clickable timestamp badges on comments that have `timestamp_seconds > 0` (same style as PublicReview)
- When clicked, call `onSeekToTimestamp(seconds)` which the parent wires to `videoPlayerRef.current.seekTo()`

### 3. Wire timestamp capture in comment submission
Update `CommentPanel` to accept a `currentTimestamp` prop (the current video time). Pass it to `onAddComment` so the timestamp is saved with each comment.

### 4. Update all parent components that use CommentPanel
Wire the `VideoPlayerHandle.seekTo` and `VideoPlayerHandle.getCurrentTime` through to the CommentPanel in wherever the internal review UI is rendered. This includes `ProjectDetailSheet.tsx` or any other component that renders `CommentPanel` alongside `VideoPlayer`.

### 5. Public Review page — already working
The public review page already has timestamp capture, display, and click-to-seek working via the Bunny iframe `postMessage` API. No changes needed there.

## How Bunny.net Iframe Seeking Works (already implemented)
The `VideoPlayer` component communicates with the Bunny Stream iframe via the Player.js `postMessage` protocol:
- **Get time**: polls `{ method: 'getCurrentTime' }` every 200ms
- **Seek**: sends `{ method: 'setCurrentTime', value: seconds }` 
- This works without custom HLS — it uses Bunny's built-in embed player

## Files to Edit
- `src/hooks/useVideoComments.tsx` — Accept timestamp parameter in `addComment`
- `src/components/video/CommentPanel.tsx` — Add timestamp display, click-to-seek, and current time indicator
- `src/components/projects/ProjectDetailSheet.tsx` — Wire video player ref to comment panel for seek and timestamp capture

