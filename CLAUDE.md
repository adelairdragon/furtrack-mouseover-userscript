# FurTrack Hover Preview Userscript

## Purpose
Tampermonkey userscript for `furtrack.com` that shows a hover tooltip over `.index-image` thumbnail squares. Primary use case: moderating the `/pending` queue — see the full (uncropped) image and verify tags without clicking into each post.

**Deliverable:** `furtrack-preview.user.js` — paste into Tampermonkey to install.

---

## Site Quirks

- `furtrack.com` redirects to `www.furtrack.com` — both must be in `@match`.
- The site is a React SPA; content is rendered dynamically. The script uses a `MutationObserver` to attach to new `.index-image` elements as they appear.
- Auth: JWT stored in `localStorage.getItem('userToken')`, sent as `Authorization: Bearer {token}`. The `/view/post/{id}` endpoint (authed) returns more data than `/get/p/{id}` (public).

---

## API

**Base URL:** `https://solar.furtrack.com` (prod) / `https://solar-beta.furtrack.com` (beta)

| Endpoint | Auth | Returns |
|---|---|---|
| `GET /view/post/{postId}` | Required | Full post data + tags + comments |
| `GET /get/p/{postId}` | None | Same structure, fewer fields |

**Response shape:**
```json
{
  "post": {
    "postId": 1942972,
    "postType": 1,
    "postStatus": 0,
    "submitUserId": 896,
    "submitUsername": "Adelair",
    "submitTimestamp": "2026-05-28T02:35:44.000Z",
    "taken": "2026-05-23T16:52:53.000Z",
    "metaWidth": 5702,
    "metaHeight": 3806,
    "metaFiletype": "jpg",
    "metaFingerprint": "bbe70ca1cbe4dc733612b3b6dd1e8d1d",
    "metaServer": 0,
    "exif": {
      "cameraBrand": "NIKON CORPORATION",
      "cameraModel": "NIKON D750",
      "cameraLens": "...",
      "focal": 26,
      "shutter": 0.0333,
      "fstop": 4.5,
      "iso": 2800
    }
  },
  "tags": [
    { "tagName": "3:adelair", "tagCount": 6884, "tagMetadata": null }
  ]
}
```

`postType`: 1 = image, 2 = embed, 11 = Twitter/X, >20 = video  
`postStatus`: 0 = pending, 1 = approved, -1 = rejected, -2 = deleted

---

## Image URLs

| Use | Pattern |
|---|---|
| Thumbnail (square-cropped) | `https://orca2.furtrack.com/thumb/{postId}.jpg` |
| Gallery / mid-res (shown in tooltip) | `https://orca2.furtrack.com/gallery/{submitUserId}/{postId}-{metaFingerprint}.jpg` |
| Full-res | `https://orca2.furtrack.com/full/{submitUserId}/{postId}-{checksum}.{filetype}` (checksum requires JS hash — see `exec.js`) |

The gallery URL is the right choice for the tooltip: uncropped, reasonable size, no checksum needed.

---

## Tag Format

Tags arrive as `{ tagName: "typeId:name", tagCount: N }`.

| Type ID | Category |
|---|---|
| 0 | General |
| 1 | Character |
| 2 | Maker |
| 3 | Photographer |
| 5 | Event |
| 6 | Species |
| 9 | Private |

Underscores in tag names represent spaces.

---

## Userscript Architecture

### Speed
- Fetch starts **immediately** on `mouseenter` (no delay).
- Fetch promises are cached by postId — repeat hovers cost nothing.
- A 120ms minimum delay prevents flash on quick mouse passes (`Promise.all([fetch, delay])`).
- Image is pre-sized from `metaWidth`/`metaHeight` before it loads — no layout shift.

### Hover tracking
Each hover is assigned a `currentHoverId`. Async continuations check this ID before doing anything — stale hovers bail out silently.

### Tooltip layout
Two-column flex layout:
- **Left**: image at computed display size (scaled to fit viewport, never upscaled)
- **Right** (210px fixed): meta rows + EXIF chips + scrollable tag list

### Positioning
- Prefers right of cursor; flips left if it would clip the right edge.
- Hard-clamped to 8px from every viewport edge — never goes off-screen.

### DOM attachment
`MutationObserver` watches for new `.index-image` elements and attaches `mouseenter`/`mouseleave` listeners. Elements get `data-ftp-attached` to avoid double-attachment.

---

## Reference Files

`furtrack-client-master/src/` — dump of the site's React frontend.

| File | What's useful |
|---|---|
| `common/assets.js` | `thumbnailUrl`, `galleryUrl`, `fullR2UrlPrefix` |
| `exec.js` | `endpoint()` (API base URL logic), `openFullUrl` (full-res URL + checksum) |
| `common/parseTags.js` | Tag type IDs, parse helpers |
| `components/IndexImage.js` | How thumbnails are rendered; confirms `.index-image` class |
| `components/ModalPost.js` | What data the modal displays; API call at line 234 |
| `containers/Moderate.js` | The `/pending` page — uses `IndexImage` |
| `index.js` | Route definitions; confirms `/pending` → `Moderate` |
