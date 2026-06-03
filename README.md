# FurTrack Better Image Previews

A userscript for [FurTrack](https://furtrack.com) that creates rich mouseover previews (showing the uncropped image, tags, and relevant EXIF data) while you are in batch select mode.

---

## Install

1. Install your userscript manager of choice (I use [Tampermonkey](https://www.tampermonkey.net/)) as a browser addon.
2. Click **[Install Script](http://github.com/adelairdragon/furtrack-mouseover-userscript/releases/latest/download/furtrack-preview.user.js)**. Tampermonkey will open up a new tab that asks you to install the script
3. Click **Install**.
4. Bada bing.

The script auto-updates from this repo.

---

## Usage

### Smarter Previews

The preview is **off by default**. To enable it:

1. Go to any page with thumbnails (e.g. [`event:anthrocon`](https://www.furtrack.com/index/event:anthrocon)).
2. Enable Select mode.
3. A **✨ Fancy Previews ✨** button appears in the batch action/select row.
4. Click it to toggle previews on/off. The setting persists across page loads.

Once enabled, hover over any thumbnail to see the tooltip.

### Other Options

The **⚙️ Settings** button includes a few cool options:

* **Drag Select** - Use the left mouse button to drag-select multiple photos at a time.
* **Mark Mode** - If you're looking to make a note for later whether to act on certain photos, you can add a few symbols: ✅, ❌, ❓, 🏷️, 🐺. You can choose which symbols to cycle through. This is useful in a few situations: 
* * You're in bulk tagging mode and are making a first tagging pass, but want to mark other photos to tag differently.
* * You're a mod and are looking to approve some photos but deny other ones.