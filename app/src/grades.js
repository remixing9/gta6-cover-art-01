// Colour grades for the Neon Palm cover engine.
// A grade is a gradient map: a photo's luminance is remapped through these
// colour stops, which is what gives every cover its sunset or neon look.
// Stops are [r, g, b] at a position from 0 (shadows) to 1 (highlights).
export const GRADES = {
  sunset: {
    name: 'Sunset',
    stops: [
      { at: 0, color: [26, 11, 46] },
      { at: 0.35, color: [194, 39, 91] },
      { at: 0.7, color: [255, 122, 47] },
      { at: 1, color: [255, 209, 102] },
    ],
  },
  neon: {
    name: 'Neon',
    stops: [
      { at: 0, color: [5, 5, 16] },
      { at: 0.35, color: [91, 42, 134] },
      { at: 0.7, color: [255, 46, 136] },
      { at: 1, color: [57, 213, 255] },
    ],
  },
  vice: {
    name: 'Vice',
    stops: [
      { at: 0, color: [11, 16, 53] },
      { at: 0.35, color: [123, 47, 190] },
      { at: 0.7, color: [255, 94, 98] },
      { at: 1, color: [255, 233, 201] },
    ],
  },
  noir: {
    name: 'Noir',
    stops: [
      { at: 0, color: [8, 8, 12] },
      { at: 0.35, color: [70, 70, 80] },
      { at: 0.7, color: [160, 160, 170] },
      { at: 1, color: [245, 245, 250] },
    ],
  },
};

// Sample one grade's stops at a position t in [0, 1] (linear interpolation).
export function sampleGrade(grade, t) {
  const stops = grade.stops;
  if (t <= stops[0].at) return stops[0].color.slice();
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i].at) {
      const a = stops[i - 1];
      const b = stops[i];
      const f = (t - a.at) / (b.at - a.at);
      return [
        Math.round(a.color[0] + (b.color[0] - a.color[0]) * f),
        Math.round(a.color[1] + (b.color[1] - a.color[1]) * f),
        Math.round(a.color[2] + (b.color[2] - a.color[2]) * f),
      ];
    }
  }
  return stops[stops.length - 1].color.slice();
}

// Build a 256-entry RGB lookup table for a grade: entry i maps the input
// luminance i to the grade's colour at i / 255.
export function gradeLUT(grade) {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = sampleGrade(grade, i / 255);
    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = b;
  }
  return lut;
}

// Apply a grade's lookup table to raw RGBA pixels in place.
export function applyLUTToPixels(data, lut) {
  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    const j = lum * 3;
    data[i] = lut[j];
    data[i + 1] = lut[j + 1];
    data[i + 2] = lut[j + 2];
  }
}
