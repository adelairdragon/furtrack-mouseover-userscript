// ==UserScript==
// @name         FurTrack Image Preview
// @namespace    https://furtrack.com/
// @version      2.0.1
// @description  Hover over a post thumbnail to see the full image and tags
// @author       Adelair
// @match        https://furtrack.com/*
// @match        https://www.furtrack.com/*
// @match        https://beta.furtrack.com/*
// @grant        none
// @icon         https://www.google.com/s2/favicons?sz=64&domain=furtrack.com
// ==/UserScript==

(function () {
  'use strict';

  const API_BASE = window.location.host === 'beta.furtrack.com'
    ? 'https://solar-beta.furtrack.com'
    : 'https://solar.furtrack.com';

  // Minimum ms before tooltip appears — prevents flash on quick mouse passes.
  // Fetch starts immediately on hover, so by this time data is usually ready.
  const MIN_DELAY_MS = 120;

  // Must match the CSS width set on #ftp-right
  const RIGHT_PANEL_W = 210;

  const TAG_CATEGORIES = [
    { type: 1, label: 'Character',    color: '#f5a0c8' },
    { type: 6, label: 'Species',      color: '#b89cf5' },
    { type: 0, label: 'General',      color: '#a8bcd0' },
    { type: 2, label: 'Maker',        color: '#70bef5' },
    { type: 3, label: 'Photographer', color: '#f5c070' },
    { type: 5, label: 'Event',        color: '#70f5b8' },
    { type: 9, label: 'Private',      color: '#787878' },
  ];

  // ── Data ──────────────────────────────────────────────────────────────────

  // Cache the fetch promises themselves so a second hover never waits at all
  const cache = new Map();
  const getToken = () => localStorage.getItem('userToken');

  const fetchPost = (postId) => {
    if (cache.has(postId)) return cache.get(postId);
    const token = getToken();
    const path = token ? `/view/post/${postId}` : `/get/p/${postId}`;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const p = fetch(API_BASE + path, { headers })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
    cache.set(postId, p);
    return p;
  };

  const galleryUrl = (post) =>
    `https://orca2.furtrack.com/gallery/${post.submitUserId}/${post.postId}-${post.metaFingerprint}.jpg`;

  const groupTags = (rawTags) => {
    const groups = {};
    TAG_CATEGORIES.forEach(c => { groups[c.type] = []; });
    rawTags.forEach(tag => {
      const parts  = tag.tagName.split(':');
      const typeId = parts.length > 1 ? +parts[0] : 0;
      const name   = parts.length > 1 ? parts[1] : tag.tagName;
      const count  = tag.tagCount ?? null;
      (groups[typeId] ?? groups[0]).push({ name, count });
    });
    return groups;
  };

  // ── Formatters ────────────────────────────────────────────────────────────

  const fmtDate = (iso) => {
    if (!iso) return null;
    const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  };

  const fmtShutter = (s) => {
    if (s == null || s === 0) return null;
    return s >= 1 ? `${s}s` : `1/${Math.round(1 / s)}s`;
  };

  const fmtCount = (n) => {
    if (n == null) return '';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  };

  // Scale image dimensions to fit within maxW × maxH, never upscale
  const scaledDims = (mw, mh, maxW, maxH) => {
    if (!mw || !mh) return null;
    const scale = Math.min(maxW / mw, maxH / mh, 1);
    return { w: Math.floor(mw * scale), h: Math.floor(mh * scale) };
  };

  // ── Styles ────────────────────────────────────────────────────────────────

  const injectStyles = () => {
    if (document.getElementById('ftp-styles')) return;
    const s = document.createElement('style');
    s.id = 'ftp-styles';
    s.textContent = `
      #ftp-tooltip {
        position: fixed;
        z-index: 99999;
        display: flex;
        align-items: stretch;
        background: #161616;
        border: 1px solid #383838;
        border-radius: 10px;
        box-shadow: 0 14px 52px rgba(0,0,0,0.9);
        overflow: hidden;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        font-size: 12px;
        line-height: 1.4;
      }

      /* ── Image column ── */
      #ftp-img-wrap {
        background: #0a0a0a;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      #ftp-img-wrap img { display: block; max-width: 100%; max-height: 100%; object-fit: contain; }

      /* ── Right panel ── */
      #ftp-right {
        width: ${RIGHT_PANEL_W}px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        border-left: 1px solid #282828;
        overflow: hidden;
      }

      /* Meta section */
      #ftp-meta {
        padding: 9px 11px 8px;
        border-bottom: 1px solid #222;
        flex-shrink: 0;
      }
      .ftp-meta-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 5px;
        margin-bottom: 2px;
      }
      .ftp-ml {
        color: #555;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        flex-shrink: 0;
      }
      .ftp-mv {
        color: #c8c8c8;
        font-size: 11px;
        text-align: right;
        min-width: 0;
        word-break: break-all;
      }
      .ftp-mv.warn { color: #f0882a; font-weight: 600; }
      .ftp-exif {
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
        margin-top: 6px;
      }
      .ftp-chip {
        background: #1e1e1e;
        border: 1px solid #2d2d2d;
        border-radius: 3px;
        padding: 1px 5px;
        font-size: 10px;
        color: #888;
        white-space: nowrap;
      }

      /* Tags section */
      #ftp-tags {
        flex: 1 1 0;
        overflow-y: auto;
        padding: 8px 11px 10px;
      }
      #ftp-tags::-webkit-scrollbar { width: 3px; }
      #ftp-tags::-webkit-scrollbar-thumb { background: #363636; border-radius: 2px; }
      .ftp-grp { margin-bottom: 7px; }
      .ftp-glabel {
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        margin-bottom: 3px;
        opacity: 0.9;
      }
      .ftp-trow {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 4px;
        line-height: 1.65;
      }
      .ftp-tname { color: #d0d0d0; min-width: 0; word-break: break-word; }
      .ftp-tcount { color: #484848; font-size: 10px; flex-shrink: 0; }
    `;
    document.head.appendChild(s);
  };

  // ── Build tooltip DOM ─────────────────────────────────────────────────────

  const buildTooltip = (data, imgSize) => {
    const { post, tags } = data;
    const groups = groupTags(tags);

    // Resolution + low-res warning
    const shortEdge = Math.min(post.metaWidth || 0, post.metaHeight || 0);
    const resTxt    = post.metaWidth && post.metaHeight
      ? `${post.metaWidth} × ${post.metaHeight}`
      : null;
    const resLow = shortEdge > 0 && shortEdge < 850;

    // Meta rows: [label, value, warn?]
    const metaRows = [
      post.submitUsername  && ['By',       post.submitUsername,          false],
      post.taken           && ['Taken',    fmtDate(post.taken),          false],
      post.submitTimestamp && ['Uploaded', fmtDate(post.submitTimestamp), false],
      resTxt               && ['Size',     resTxt,                        resLow],
    ].filter(Boolean);

    // EXIF chips
    const exif  = post.exif || {};
    const chips = [
      exif.cameraModel,
      fmtShutter(exif.shutter),
      exif.fstop != null && `f/${exif.fstop}`,
      exif.iso   != null && `ISO ${exif.iso}`,
      exif.focal != null && `${exif.focal}mm`,
    ].filter(Boolean);

    const metaHtml = (metaRows.length || chips.length) ? `
      <div id="ftp-meta">
        ${metaRows.map(([l, v, warn]) => `
          <div class="ftp-meta-row">
            <span class="ftp-ml">${l}</span>
            <span class="ftp-mv${warn ? ' warn' : ''}">${v}</span>
          </div>`).join('')}
        ${chips.length
          ? `<div class="ftp-exif">${chips.map(c => `<span class="ftp-chip">${c}</span>`).join('')}</div>`
          : ''}
      </div>` : '';

    // Tags
    const tagSections = TAG_CATEGORIES
      .filter(c => groups[c.type]?.length)
      .map(c => `
        <div class="ftp-grp">
          <div class="ftp-glabel" style="color:${c.color}">${c.label}</div>
          ${groups[c.type].map(({ name, count }) => `
            <div class="ftp-trow">
              <span class="ftp-tname">${name.replace(/_/g, ' ')}</span>
              ${count != null ? `<span class="ftp-tcount">${fmtCount(count)}</span>` : ''}
            </div>`).join('')}
        </div>`).join('');

    // Image column — pre-sized so layout is stable before image loads
    const isVideo = post.postType > 20;
    const imgHtml = !isVideo && imgSize
      ? `<div id="ftp-img-wrap" style="width:${imgSize.w}px;height:${imgSize.h}px">
           <img src="${galleryUrl(post)}" alt="" />
         </div>`
      : '';

    const el = document.createElement('div');
    el.id = 'ftp-tooltip';
    el.innerHTML = `
      ${imgHtml}
      <div id="ftp-right">
        ${metaHtml}
        <div id="ftp-tags">${tagSections || '<span style="color:#444">No tags</span>'}</div>
      </div>`;
    return el;
  };

  // ── Placement ─────────────────────────────────────────────────────────────

  let tooltip = null;
  const removeTooltip = () => { if (tooltip) { tooltip.remove(); tooltip = null; } };

  const placeTooltip = (el, cx, cy) => {
    // Insert off-screen to measure actual rendered size
    el.style.left = '-9999px';
    el.style.top  = '-9999px';
    document.body.appendChild(el);

    const gap = 18;
    const m   = 8;
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;
    const tw  = el.offsetWidth;
    const th  = el.offsetHeight;

    // Prefer right of cursor; flip left if it would clip
    let x = cx + gap;
    if (x + tw > vw - m) x = cx - tw - gap;
    // Hard clamp so we never go off either edge
    x = Math.max(m, Math.min(x, vw - tw - m));

    // Vertically center on cursor (weighted toward top), then clamp
    let y = cy - Math.round(th / 3);
    y = Math.max(m, Math.min(y, vh - th - m));

    el.style.left = x + 'px';
    el.style.top  = y + 'px';
  };

  // ── Event handling ────────────────────────────────────────────────────────

  // Each hover gets a unique ID; stale async continuations bail out early
  let currentHoverId = 0;
  let lastX = 0, lastY = 0;

  const onMouseMove = (e) => { lastX = e.clientX; lastY = e.clientY; };

  const onEnter = async (e) => {
    const hoverId = ++currentHoverId;
    const imgEl   = e.currentTarget.querySelector('img');
    if (!imgEl) return;
    const m = imgEl.src.match(/\/thumb\/(\d+)\.jpg/);
    if (!m) return;

    lastX = e.clientX;
    lastY = e.clientY;
    e.currentTarget.addEventListener('mousemove', onMouseMove);

    // Fetch starts NOW; MIN_DELAY_MS is just an anti-flash debounce.
    // Both must resolve before the tooltip appears — whichever finishes first
    // simply waits for the other.
    try {
      const [data] = await Promise.all([
        fetchPost(m[1]),
        new Promise(r => setTimeout(r, MIN_DELAY_MS)),
      ]);
      if (currentHoverId !== hoverId) return; // user left while waiting

      // Compute how large we can draw the image
      const margin   = 8;
      const vw       = window.innerWidth;
      const vh       = window.innerHeight;
      const maxTotal = Math.min(vw - margin * 2, 600);
      const maxImgW  = maxTotal - RIGHT_PANEL_W - 1; // 1px border
      const maxImgH  = Math.floor(vh * 0.45);
      const imgSize  = scaledDims(data.post.metaWidth, data.post.metaHeight, maxImgW, maxImgH);

      removeTooltip();
      tooltip = buildTooltip(data, imgSize);
      placeTooltip(tooltip, lastX, lastY);

    } catch (err) {
      if (currentHoverId === hoverId) console.warn('[ft-preview]', err);
    }
  };

  const onLeave = (e) => {
    currentHoverId++; // invalidates any in-flight async hover
    removeTooltip();
    e.currentTarget.removeEventListener('mousemove', onMouseMove);
  };

  // ── Attachment ────────────────────────────────────────────────────────────

  const ATTR = 'data-ftp-attached';
  const attachListeners = () => {
    document.querySelectorAll(`.index-image:not([${ATTR}])`).forEach(el => {
      el.setAttribute(ATTR, '1');
      el.addEventListener('mouseenter', onEnter);
      el.addEventListener('mouseleave', onLeave);
    });
  };

  injectStyles();

  new MutationObserver(() => {
    if (document.querySelector(`.index-image:not([${ATTR}])`)) attachListeners();
  }).observe(document.body, { childList: true, subtree: true });

  attachListeners();

})();
