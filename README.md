[![make.fun bounty](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/remixing9/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/remixing9/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

# Neon Palm Cover Studio

An offline web app that turns your photo and a caption into GTA-style cover
art — the multi-panel poster look, bold condensed lettering, a Vice City
sunset or neon colour grade — and exports it as a PNG to share. Built for
the [Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01) bounty
on [make.fun](https://make.fun).

Your photos never leave your machine: everything runs in the browser from
these static files, with no network request.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

Node 22 or later, no install, no build step.

## How it works

1. **Add your photos** — or load the three sample scenes.
2. **Pick a layout** — Four Corners, Hero & Strip, Full Bleed, or Tilted Snaps.
3. **Pick a colour grade** — Sunset, Neon, Vice, or Noir. Each grade is a
   gradient map applied to the photos on a canvas.
4. **Pick a post size** — 1080 × 1080, 1080 × 1350, or 1920 × 1080.
5. **Write the caption** — a big Anton title, a Pacifico script subtitle,
   and a small-caps tag.
6. **Crop and position** — click a panel to select it, drag the photo inside
   it, or use the zoom and pan sliders. One photo can fill every panel, or
   each panel can hold a different one.
7. **Export PNG** — the cover renders at full post size and downloads.

The live preview is the real cover renderer (`app/src/cover.js`), so what
you see is what the PNG holds: white gutters and black keylines, a gradient
title with an outline, film grain and a vignette.

## Files

- `main.ts` — the entry program: copies `app/` and `screenshots/` to
  `/output` and writes `dossier.json` with the vendored make.fun library.
- `app/index.html`, `app/style.css` — the editor.
- `app/src/cover.js` — layouts, photo fitting, caption wrapping, the canvas
  renderer. Pure functions are tested in `test/cover.test.mjs`
  (`node --test test/cover.test.mjs`).
- `app/src/grades.js` — the four gradient-map colour grades.
- `app/src/main.js` — editor wiring: photos, controls, drag-to-pan, export.
- `app/src/shots.js` — `?shot=cover` and `?shot=editor` modes, used to take
  the entry's own screenshots.
- `app/fonts/` — Anton and Pacifico, both under the SIL Open Font License.
- `app/samples/` — three illustrated sample scenes, drawn by the app's maker
  (no real people, no game artwork).
- `screenshots/` — the app with a photo loaded, and covers it exported.
- `vendor/makefun-app.ts` — make.fun's dossier library, unchanged from the kit.

## Originality

Everything here is the maker's own: the layouts, the grades, the lettering
treatment and the sample art. No Rockstar Games logo, wordmark, official
artwork, character or font is used anywhere.

## License

MIT — see [LICENSE](LICENSE).
