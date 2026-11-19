// Screenshot modes for Neon Palm Cover Studio, driven by the URL.
//   ?shot=cover&photo=boulevard&caption=Neon%20Palm&layout=grid4&grade=sunset&size=wide
//     draws one exported cover full-frame, for the cover screenshots.
//   ?shot=editor&photo=boulevard&caption=Boulevard%20Queen
//     shows the editor with a sample photo loaded, for the editor screenshot.
// These are the maker's own screenshots: the app draws them itself.
import { drawCover } from './cover.js';

// Apply the shot parameters (caption, layout, grade, size) onto the state.
export function applyShotParams(params, state) {
  const layout = params.get('layout');
  if (layout) state.layout = layout;
  const grade = params.get('grade');
  if (grade) state.grade = grade;
  const size = params.get('size');
  if (size) state.size = size;
  const caption = params.get('caption');
  if (caption !== null) state.title = caption;
  const subtitle = params.get('subtitle');
  if (subtitle !== null) state.subtitle = subtitle;
  const tag = params.get('tag');
  if (tag !== null) state.tag = tag;
}

// Full-frame cover mode: hide the editor chrome, load the sample photos,
// point every panel at the requested photo and draw the cover once.
export async function runShotMode(params, api) {
  const { state, photos, render, loadSamplePhotos, canvas } = api;
  applyShotParams(params, state);
  await loadSamplePhotos();
  const wanted = params.get('photo');
  if (wanted) {
    // Match by file stem, so ?photo=pier finds pier.jpg.
    const index = photos.findIndex((p) => p.name.replace(/\.[^.]+$/, '') === wanted);
    if (index >= 0) state.panels.forEach((p) => { p.photo = index; });
  }
  document.body.classList.add('shot-cover');
  drawCover(canvas, state, photos.map((p) => p.img));
  window.__shotReady = true;
  return render;
}
