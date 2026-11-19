// Neon Palm Cover Studio — editor wiring.
// Loads photos, binds every control to the cover state, renders the live
// preview and exports the finished cover as a PNG. Screenshot modes
// (?shot=cover / ?shot=editor) are handled by shots.js.
import { DEFAULT_STATE, LAYOUTS, SIZES, drawCover, exportCoverPNG, layoutPanels } from './cover.js';
import { GRADES } from './grades.js';
import { runShotMode, applyShotParams } from './shots.js';

const $ = (id) => document.getElementById(id);
const state = structuredClone(DEFAULT_STATE);
const photos = []; // { img, url, name }
let pickedPhoto = 0;
let selectedPanel = 0;
let renderQueued = false;

const LAYOUT_NAMES = {
  'grid4': 'Four Corners',
  'hero-strip': 'Hero & Strip',
  'fullbleed': 'Full Bleed',
  'tilted': 'Tilted Snaps',
};
const SIZE_NAMES = { square: '1080 × 1080', portrait: '1080 × 1350', wide: '1920 × 1080' };

function photoImages() {
  return photos.map((p) => p.img);
}

function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    drawCover($('previewCanvas'), state, photoImages());
  });
}

function setStatus(text) {
  $('status').textContent = text;
}

function buildSegments() {
  const build = (rowId, entries, current, onPick) => {
    const row = $(rowId);
    row.innerHTML = '';
    for (const [id, label] of entries) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.classList.toggle('active', id === current);
      btn.addEventListener('click', () => {
        onPick(id);
        row.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        requestRender();
      });
      row.appendChild(btn);
    }
  };
  build('layoutRow', LAYOUTS.map((id) => [id, LAYOUT_NAMES[id]]), state.layout, (id) => {
    state.layout = id;
    syncPanelControls();
  });
  build('gradeRow', Object.entries(GRADES).map(([id, g]) => [id, g.name]), state.grade, (id) => {
    state.grade = id;
  });
  build('sizeRow', Object.entries(SIZE_NAMES), state.size, (id) => {
    state.size = id;
  });
}

function refreshPhotoStrip() {
  const strip = $('photoStrip');
  strip.innerHTML = '';
  photos.forEach((p, i) => {
    const thumb = document.createElement('img');
    thumb.src = p.url;
    thumb.alt = p.name;
    thumb.title = p.name;
    thumb.classList.toggle('picked', i === pickedPhoto);
    thumb.addEventListener('click', () => {
      pickedPhoto = i;
      refreshPhotoStrip();
      setStatus(`Photo ${i + 1} picked — click a panel to place it.`);
    });
    strip.appendChild(thumb);
  });
}

function addPhoto(img, url, name) {
  photos.push({ img, url, name });
  if (photos.length === 1) {
    state.panels.forEach((p) => { p.photo = 0; });
  }
  pickedPhoto = photos.length - 1;
  refreshPhotoStrip();
  requestRender();
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url, name: file.name });
    img.onerror = () => reject(new Error(`could not read ${file.name}`));
    img.src = url;
  });
}

async function loadSamplePhotos() {
  const names = ['boulevard.jpg', 'pier.jpg', 'neon.jpg'];
  for (const name of names) {
    if (photos.some((p) => p.name === name)) continue;
    const img = new Image();
    img.src = `./samples/${name}`;
    try {
      await img.decode();
    } catch {
      continue;
    }
    addPhoto(img, `./samples/${name}`, name);
  }
  setStatus(photos.length ? 'Sample photos loaded.' : 'No sample photos found.');
}

function syncPanelControls() {
  const panel = state.panels[selectedPanel] || state.panels[0];
  $('panelLabel').textContent = String(selectedPanel + 1);
  $('zoomInput').value = String(panel.zoom);
  $('panXInput').value = String(panel.panX);
  $('panYInput').value = String(panel.panY);
  $('zoomVal').textContent = `${panel.zoom.toFixed(2)}×`;
  $('panXVal').textContent = String(panel.panX.toFixed(2));
  $('panYVal').textContent = String(panel.panY.toFixed(2));
}

function bindPanelControls() {
  const panel = () => state.panels[selectedPanel] || state.panels[0];
  $('zoomInput').addEventListener('input', (e) => {
    panel().zoom = Number(e.target.value);
    syncPanelControls();
    requestRender();
  });
  $('panXInput').addEventListener('input', (e) => {
    panel().panX = Number(e.target.value);
    syncPanelControls();
    requestRender();
  });
  $('panYInput').addEventListener('input', (e) => {
    panel().panY = Number(e.target.value);
    syncPanelControls();
    requestRender();
  });
  $('fillAllBtn').addEventListener('click', () => {
    const photo = panel().photo;
    state.panels.forEach((p) => { p.photo = photo; });
    setStatus('That photo now fills every panel.');
    requestRender();
  });
}

function canvasPoint(event) {
  const canvas = $('previewCanvas');
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function panelAt(x, y) {
  const panels = layoutPanels(state.layout, $('previewCanvas').width, $('previewCanvas').height);
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return i;
  }
  return -1;
}

function bindPreview() {
  const canvas = $('previewCanvas');
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const { x, y } = canvasPoint(e);
    const i = panelAt(x, y);
    if (i < 0) return;
    selectedPanel = i;
    const panel = state.panels[i];
    if (photos.length > 0) panel.photo = pickedPhoto;
    syncPanelControls();
    drag = { x, y, panX: panel.panX, panY: panel.panY, moved: false };
    canvas.setPointerCapture(e.pointerId);
    requestRender();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const { x, y } = canvasPoint(e);
    const panel = state.panels[selectedPanel];
    const rect = layoutPanels(state.layout, canvas.width, canvas.height)[selectedPanel];
    const dx = (x - drag.x) / rect.w;
    const dy = (y - drag.y) / rect.h;
    if (Math.abs(dx) + Math.abs(dy) > 0.004) drag.moved = true;
    panel.panX = Math.max(-1, Math.min(1, drag.panX - dx * 2));
    panel.panY = Math.max(-1, Math.min(1, drag.panY - dy * 2));
    syncPanelControls();
    requestRender();
  });
  canvas.addEventListener('pointerup', () => {
    drag = null;
  });
}

async function exportPNG() {
  setStatus('Rendering your cover…');
  try {
    const blob = await exportCoverPNG(state, photoImages());
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neon-palm-cover-${state.size}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setStatus(`Exported ${a.download} (${(blob.size / 1024).toFixed(0)} KiB).`);
  } catch (err) {
    setStatus(`Export failed: ${err.message}`);
  }
}

async function loadFonts() {
  const faces = [
    new FontFace('Anton', 'url(./fonts/Anton-Regular.ttf)'),
    new FontFace('Pacifico', 'url(./fonts/Pacifico-Regular.ttf)'),
  ];
  for (const face of faces) {
    try {
      await face.load();
      document.fonts.add(face);
    } catch {
      // Fall back to system fonts; the cover still renders.
    }
  }
}

async function init() {
  const params = new URLSearchParams(location.search);
  await loadFonts();
  // Full-frame cover mode is for the maker's screenshots: no editor chrome.
  if (params.get('shot') === 'cover') {
    await runShotMode(params, {
      state,
      photos,
      addPhoto,
      render: requestRender,
      setStatus,
      loadSamplePhotos,
      canvas: $('previewCanvas'),
    });
    return;
  }
  buildSegments();
  bindPanelControls();
  bindPreview();
  $('photoInput').addEventListener('change', async (e) => {
    for (const file of e.target.files) {
      try {
        const loaded = await loadImageFile(file);
        addPhoto(loaded.img, loaded.url, loaded.name);
      } catch (err) {
        setStatus(err.message);
      }
    }
    e.target.value = '';
  });
  $('sampleBtn').addEventListener('click', loadSamplePhotos);
  $('titleInput').addEventListener('input', (e) => { state.title = e.target.value; requestRender(); });
  $('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; requestRender(); });
  $('tagInput').addEventListener('input', (e) => { state.tag = e.target.value; requestRender(); });
  $('grainInput').addEventListener('change', (e) => { state.grain = e.target.checked; requestRender(); });
  $('vignetteInput').addEventListener('change', (e) => { state.vignette = e.target.checked; requestRender(); });
  $('exportBtn').addEventListener('click', exportPNG);
  syncPanelControls();
  await loadSamplePhotos();
  // Editor screenshot mode: the editor, with a sample photo and a caption
  // chosen by the URL, so the shot shows the app at work.
  if (params.get('shot') === 'editor') {
    applyShotParams(params, state);
    buildSegments();
    syncPanelControls();
  }
  requestRender();
}

init();
