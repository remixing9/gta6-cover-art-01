// Neon Palm cover engine: layouts, photo fitting, caption wrapping and the
// canvas renderer that draws a GTA-style multi-panel cover from photos.
// Pure functions (coverSize, layoutPanels, panelSourceRect, wrapCaption) are
// tested in test/cover.test.mjs; drawCover needs a browser canvas.
import { GRADES, gradeLUT, applyLUTToPixels } from './grades.js';

export const SIZES = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  wide: { w: 1920, h: 1080 },
};

export const LAYOUTS = ['grid4', 'hero-strip', 'fullbleed', 'tilted'];

export const DEFAULT_STATE = {
  size: 'square',
  layout: 'grid4',
  grade: 'sunset',
  title: 'Neon Palm',
  subtitle: 'chasing the sunset',
  tag: 'VICE NIGHTS • 2026',
  grain: true,
  vignette: true,
  panels: [
    { photo: 0, zoom: 1, panX: 0, panY: 0 },
    { photo: 0, zoom: 1, panX: 0, panY: 0 },
    { photo: 0, zoom: 1, panX: 0, panY: 0 },
    { photo: 0, zoom: 1, panX: 0, panY: 0 },
  ],
};

export function coverSize(sizeId) {
  const size = SIZES[sizeId];
  if (!size) throw new Error(`unknown size: ${sizeId}`);
  return { w: size.w, h: size.h };
}

// Panel rectangles for a layout, in cover pixels. Panels never overlap
// (except the tilted snapshots, which overlap by design); gutters are drawn
// by insetting each panel when it is painted.
export function layoutPanels(layoutId, w, h) {
  switch (layoutId) {
    case 'grid4': {
      // Shared edges, so rounding can never overlap two panels by a pixel.
      const x1 = Math.round(w * 0.64);
      const y1 = Math.round(h * 0.64);
      const y2 = Math.round(h * 0.32);
      return [
        { x: 0, y: 0, w: x1, h: y1, rot: 0 },
        { x: x1, y: 0, w: w - x1, h: y2, rot: 0 },
        { x: x1, y: y2, w: w - x1, h: y1 - y2, rot: 0 },
        { x: 0, y: y1, w, h: h - y1, rot: 0 },
      ];
    }
    case 'hero-strip': {
      const y1 = Math.round(h * 0.7);
      const x1 = Math.round(w / 3);
      const x2 = Math.round((w * 2) / 3);
      return [
        { x: 0, y: 0, w, h: y1, rot: 0 },
        { x: 0, y: y1, w: x1, h: h - y1, rot: 0 },
        { x: x1, y: y1, w: x2 - x1, h: h - y1, rot: 0 },
        { x: x2, y: y1, w: w - x2, h: h - y1, rot: 0 },
      ];
    }
    case 'fullbleed':
      return [{ x: 0, y: 0, w, h, rot: 0 }];
    case 'tilted':
      return [
        { x: Math.round(w * 0.06), y: Math.round(h * 0.05), w: Math.round(w * 0.52), h: Math.round(h * 0.52), rot: -6 },
        { x: Math.round(w * 0.44), y: Math.round(h * 0.1), w: Math.round(w * 0.5), h: Math.round(h * 0.44), rot: 5 },
        { x: Math.round(w * 0.2), y: Math.round(h * 0.48), w: Math.round(w * 0.6), h: Math.round(h * 0.44), rot: -3 },
      ];
    default:
      throw new Error(`unknown layout: ${layoutId}`);
  }
}

// Cover-fit a photo into a panel with zoom and pan. Returns the source
// rectangle to draw from the photo. panX / panY run from -1 to 1 and move
// the visible window across the photo; the window is clamped to the photo.
export function panelSourceRect(photoW, photoH, panelW, panelH, zoom, panX, panY) {
  const scale = Math.max(panelW / photoW, panelH / photoH) * Math.max(zoom, 0.2);
  const sw = Math.min(photoW, panelW / scale);
  const sh = Math.min(photoH, panelH / scale);
  const cx = photoW / 2 + (panX * (photoW - sw)) / 2;
  const cy = photoH / 2 + (panY * (photoH - sh)) / 2;
  return {
    sx: Math.round(Math.max(0, Math.min(photoW - sw, cx - sw / 2))),
    sy: Math.round(Math.max(0, Math.min(photoH - sh, cy - sh / 2))),
    sw: Math.round(sw),
    sh: Math.round(sh),
  };
}

// Greedy word wrap. measure(word) returns the word's width in the same
// units as maxWidth. A word wider than the line stays whole on its own line.
export function wrapCaption(text, maxWidth, measure) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const next = `${line} ${words[i]}`;
    if (measure(next) <= maxWidth) {
      line = next;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

// --- drawing ---------------------------------------------------------------

function drawPhotoInto(ctx, photo, rect, panel, gutter) {
  const inset = gutter / 2;
  const x = rect.x + inset;
  const y = rect.y + inset;
  const w = rect.w - gutter;
  const h = rect.h - gutter;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (photo && photo.width > 0 && photo.height > 0) {
    const src = panelSourceRect(photo.width, photo.height, w, h, panel.zoom, panel.panX, panel.panY);
    ctx.drawImage(photo, src.sx, src.sy, src.sw, src.sh, x, y, w, h);
  } else {
    // No photo yet: a designed placeholder, sunset sky with a sun disc.
    const sky = ctx.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, '#2b1055');
    sky.addColorStop(0.55, '#c2275b');
    sky.addColorStop(1, '#ff9a3d');
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(x + w * 0.5, y + h * 0.42, Math.min(w, h) * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,6,18,0.55)';
    ctx.fillRect(x, y + h * 0.72, w, h * 0.28);
  }
  ctx.restore();
  // Black keyline around the panel.
  ctx.strokeStyle = 'rgba(12,4,10,0.9)';
  ctx.lineWidth = Math.max(2, rect.w * 0.003);
  ctx.strokeRect(x, y, w, h);
}

function drawTiltedPanel(ctx, photo, rect, panel, gutter) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rect.rot * Math.PI) / 180);
  ctx.translate(-cx, -cy);
  // White snapshot border, then the photo inside it.
  ctx.fillStyle = '#fdf8ef';
  ctx.fillRect(rect.x - gutter, rect.y - gutter, rect.w + gutter * 2, rect.h + gutter * 2);
  ctx.strokeStyle = 'rgba(12,4,10,0.85)';
  ctx.lineWidth = Math.max(2, rect.w * 0.003);
  ctx.strokeRect(rect.x - gutter, rect.y - gutter, rect.w + gutter * 2, rect.h + gutter * 2);
  drawPhotoInto(ctx, photo, rect, panel, 0);
  ctx.restore();
}

function applyGrade(ctx, w, h, gradeId) {
  const grade = GRADES[gradeId] || GRADES.sunset;
  const image = ctx.getImageData(0, 0, w, h);
  applyLUTToPixels(image.data, gradeLUT(grade));
  ctx.putImageData(image, 0, 0);
}

let noisePattern = null;
function drawGrain(ctx, w, h) {
  if (!noisePattern) {
    const tile = document.createElement('canvas');
    tile.width = 128;
    tile.height = 128;
    const tctx = tile.getContext('2d');
    const img = tctx.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    tctx.putImageData(img, 0, 0);
    noisePattern = ctx.createPattern(tile, 'repeat');
  }
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = noisePattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(8,2,8,0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function fitTitleLines(ctx, title, maxWidth, maxSize) {
  // Largest Anton size (down to a floor) whose wrapped title fits in at most
  // two lines inside maxWidth.
  for (let size = maxSize; size >= maxSize * 0.42; size -= 4) {
    ctx.font = `${size}px Anton, sans-serif`;
    const lines = wrapCaption(title, maxWidth, (s) => ctx.measureText(s).width);
    if (lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= maxWidth)) {
      return { size, lines };
    }
  }
  ctx.font = `${Math.round(maxSize * 0.42)}px Anton, sans-serif`;
  return { size: Math.round(maxSize * 0.42), lines: wrapCaption(title, maxWidth, (s) => ctx.measureText(s).width) };
}

function drawTitleBlock(ctx, state, w, h) {
  const title = (state.title || '').trim() || 'Neon Palm';
  const subtitle = (state.subtitle || '').trim();
  const tag = (state.tag || '').trim();
  const pad = Math.round(w * 0.045);
  const maxW = w - pad * 2;

  // The title lives in the bottom band (the scrim zone for the panel
  // layouts, the lower third for the tilted snapshots). Cap its size so the
  // title AND the subtitle below it both fit inside the cover: the block is
  // at most two title lines plus the script subtitle.
  const zoneH = state.layout === 'tilted' ? h * 0.3 : h * 0.34;
  const maxSize = Math.min(Math.round(w * 0.15), Math.round((zoneH - pad) / 2.5));

  // Dark scrim so the lettering reads over any photo.
  if (state.layout !== 'tilted') {
    const scrimH = Math.round(h * 0.34);
    const scrim = ctx.createLinearGradient(0, h - scrimH, 0, h);
    scrim.addColorStop(0, 'rgba(10,3,10,0)');
    scrim.addColorStop(1, 'rgba(10,3,10,0.78)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, h - scrimH, w, scrimH);
  }

  const { size, lines } = fitTitleLines(ctx, title, maxW, maxSize);
  const lineHeight = size * 0.98;
  const subSize = subtitle ? Math.round(size * 0.34) : 0;
  // Baseline of the last title line: leave room for the subtitle under it.
  const baselineY = h - pad - (subtitle ? Math.round(subSize * 1.15) : 0);
  const align = state.layout === 'tilted' ? 'center' : 'left';
  const titleTop = baselineY - lineHeight * lines.length;
  const grad = ctx.createLinearGradient(0, titleTop, 0, baselineY);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.62, '#ffe9a8');
  grad.addColorStop(1, '#ffb347');
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = Math.round(size * 0.08);
  ctx.shadowOffsetY = Math.round(size * 0.03);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#160a12';
  ctx.lineWidth = Math.max(3, size / 16);
  ctx.fillStyle = grad;
  lines.forEach((line, i) => {
    const x = align === 'center' ? w / 2 : pad;
    const y = baselineY - lineHeight * (lines.length - 1 - i);
    ctx.strokeText(line.toUpperCase(), x, y);
    ctx.fillText(line.toUpperCase(), x, y);
  });
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Script subtitle, tilted a touch, in neon pink.
  if (subtitle) {
    ctx.save();
    ctx.translate(align === 'center' ? w / 2 : pad, baselineY + subSize * 0.9);
    ctx.rotate(-0.045);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.textAlign = align === 'center' ? 'center' : 'left';
    ctx.fillStyle = '#ff5da2';
    ctx.shadowColor = 'rgba(255,46,136,0.65)';
    ctx.shadowBlur = Math.round(subSize * 0.35);
    ctx.fillText(subtitle, 0, 0);
    ctx.restore();
  }

  // Small-caps tag in a dark pill, top-right.
  if (tag) {
    const tagSize = Math.max(14, Math.round(w * 0.02));
    ctx.font = `${tagSize}px Anton, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(tagSize * 0.18)}px`;
    const tw = ctx.measureText(tag.toUpperCase()).width;
    const th = tagSize * 1.9;
    const tx = w - pad - tw - th * 0.7;
    const ty = pad;
    ctx.fillStyle = 'rgba(10,4,12,0.72)';
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw + th * 0.7, th, th / 2);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tag.toUpperCase(), tx + th * 0.35, ty + th / 2 + 1);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.textBaseline = 'alphabetic';
  }
}

function drawSunburst(ctx, w, h) {
  // Faint rays fanning from a point above the title, full-bleed only.
  const cx = w * 0.5;
  const cy = h * 0.62;
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.13;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a - 0.06) * w, cy + Math.sin(a - 0.06) * w);
    ctx.lineTo(cx + Math.cos(a + 0.06) * w, cy + Math.sin(a + 0.06) * w);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Draw a finished cover into canvas at the state's export size.
export function drawCover(canvas, state, photos) {
  const { w, h } = coverSize(state.size);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const panels = layoutPanels(state.layout, w, h);
  const gutter = Math.round(w * 0.009);

  ctx.fillStyle = '#fdf8ef';
  ctx.fillRect(0, 0, w, h);
  panels.forEach((rect, i) => {
    const panel = state.panels[i] || { photo: 0, zoom: 1, panX: 0, panY: 0 };
    const photo = panel.photo >= 0 ? photos[panel.photo] : null;
    if (rect.rot) drawTiltedPanel(ctx, photo, rect, panel, gutter);
    else drawPhotoInto(ctx, photo, rect, panel, gutter);
  });

  applyGrade(ctx, w, h, state.grade);
  if (state.layout === 'fullbleed') drawSunburst(ctx, w, h);
  drawTitleBlock(ctx, state, w, h);
  if (state.grain) drawGrain(ctx, w, h);
  if (state.vignette) drawVignette(ctx, w, h);
  return canvas;
}

// Render a cover to a fresh canvas (browser only).
export function renderCover(state, photos) {
  const canvas = document.createElement('canvas');
  return drawCover(canvas, state, photos);
}

// Render a cover to a PNG blob at export size (browser only).
export function exportCoverPNG(state, photos) {
  return new Promise((resolve, reject) => {
    const canvas = renderCover(state, photos);
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))), 'image/png');
  });
}
