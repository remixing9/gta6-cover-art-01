// Tests for the Neon Palm cover engine (app/src/cover.js, app/src/grades.js).
// Pure geometry, layout and colour-grade math — no browser needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { coverSize, layoutPanels, panelSourceRect, wrapCaption } from '../app/src/cover.js';
import { GRADES, gradeLUT } from '../app/src/grades.js';

function overlaps(a, b) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

test('coverSize maps the three post sizes', () => {
  assert.deepEqual(coverSize('square'), { w: 1080, h: 1080 });
  assert.deepEqual(coverSize('portrait'), { w: 1080, h: 1350 });
  assert.deepEqual(coverSize('wide'), { w: 1920, h: 1080 });
  assert.throws(() => coverSize('banner'), /unknown size/);
});

test('grid4 layout: four panels, no overlap, hero is biggest', () => {
  const panels = layoutPanels('grid4', 1080, 1080);
  assert.equal(panels.length, 4);
  for (const p of panels) {
    assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 1080 && p.y + p.h <= 1080);
    assert.ok(p.w > 0 && p.h > 0);
  }
  for (let i = 0; i < panels.length; i++)
    for (let j = i + 1; j < panels.length; j++)
      assert.equal(overlaps(panels[i], panels[j]), 0);
  const hero = panels[0];
  assert.ok(panels.every((p) => p.w * p.h <= hero.w * hero.h));
});

test('hero-strip layout: hero on top, three panels in a strip', () => {
  const panels = layoutPanels('hero-strip', 1920, 1080);
  assert.equal(panels.length, 4);
  assert.equal(panels[0].y, 0);
  assert.equal(panels[0].w, 1920);
  assert.ok(panels[1].y >= panels[0].y + panels[0].h);
  assert.ok(panels[1].h === panels[2].h && panels[2].h === panels[3].h);
  for (let i = 0; i < panels.length; i++)
    for (let j = i + 1; j < panels.length; j++)
      assert.equal(overlaps(panels[i], panels[j]), 0);
});

test('fullbleed layout: one panel covering the whole cover', () => {
  const panels = layoutPanels('fullbleed', 1080, 1350);
  assert.equal(panels.length, 1);
  assert.deepEqual(panels[0], { x: 0, y: 0, w: 1080, h: 1350, rot: 0 });
});

test('tilted layout: three rotated snapshot panels inside the cover', () => {
  const panels = layoutPanels('tilted', 1080, 1080);
  assert.equal(panels.length, 3);
  assert.ok(panels.every((p) => p.rot !== 0));
  for (const p of panels) {
    assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 1080 && p.y + p.h <= 1080);
  }
  assert.throws(() => layoutPanels('nope', 100, 100), /unknown layout/);
});

test('panelSourceRect cover-fits a wide photo into a square panel', () => {
  // 2000x1000 photo into a 500x500 panel at zoom 1: scale 0.5, source 1000x1000 centred.
  const r = panelSourceRect(2000, 1000, 500, 500, 1, 0, 0);
  assert.deepEqual(r, { sx: 500, sy: 0, sw: 1000, sh: 1000 });
  // Zoom 2 halves the visible window, still centred.
  const z = panelSourceRect(2000, 1000, 500, 500, 2, 0, 0);
  assert.deepEqual(z, { sx: 750, sy: 250, sw: 500, sh: 500 });
  // Panning hard right clamps the window to the photo edge.
  const p = panelSourceRect(2000, 1000, 500, 500, 1, 1, 0);
  assert.equal(p.sx, 1000);
  assert.equal(p.sy, 0);
});

test('wrapCaption breaks lines on word boundaries', () => {
  const measure = (s) => s.length * 10;
  assert.deepEqual(wrapCaption('Neon Palm Nights', 100, measure), ['Neon Palm', 'Nights']);
  assert.deepEqual(wrapCaption('Vice', 100, measure), ['Vice']);
  assert.deepEqual(wrapCaption('', 100, measure), []);
  // A single word wider than the line stays on its own line, unbroken.
  assert.deepEqual(wrapCaption('Supercalifragilistic', 100, measure), ['Supercalifragilistic']);
});

test('every grade builds a 256-step RGB lookup table', () => {
  for (const id of ['sunset', 'neon', 'vice', 'noir']) {
    const grade = GRADES[id];
    assert.ok(grade, `grade ${id} exists`);
    assert.ok(grade.stops.length >= 2);
    const lut = gradeLUT(grade);
    assert.equal(lut.length, 256 * 3);
    // First and last entries match the first and last stops.
    assert.deepEqual([lut[0], lut[1], lut[2]], grade.stops[0].color);
    const last = grade.stops[grade.stops.length - 1].color;
    assert.deepEqual([lut[765], lut[766], lut[767]], last);
  }
});

test('sunset grade gets brighter towards its gold end', () => {
  const lut = gradeLUT(GRADES.sunset);
  const lum = (i) => 0.299 * lut[i * 3] + 0.587 * lut[i * 3 + 1] + 0.114 * lut[i * 3 + 2];
  assert.ok(lum(255) > lum(0));
});
