[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/apexs15/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/apexs15/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# Neon Coast — GTA 6 Cover Maker

Neon Coast turns your photos and a caption into GTA 6-style multi-panel cover art, offline in your browser. Pick a layout (hero + three panels, four-panel grid, or full-bleed), drop in your own photos — or the two free samples — drag each photo to crop and position it, write the caption in bold sunset lettering, pick a Vice City colour grade, and export a PNG in 1080 × 1080, 1080 × 1350 or 1920 × 1080.

Photos are read on your own machine and never uploaded. The app is static files under `app/` with no network requests: `app/index.html` opens in desktop Chrome, `app/src/cover.js` is the cover engine (multi-panel layouts, sunset sky, palm silhouettes, synthwave sun, bold caption lettering, colour grades, grain and vignette), and `app/src/editor.js` wires the editor (file input, drag-and-drop, panel select, drag-to-pan, scroll-to-zoom, export).

Original artwork made with this tool. Not affiliated with Rockstar Games; no Rockstar logo, artwork or font is used.

## Layouts and grades

- **Hero + 3** — one large panel on the left, three stacked panels on the right.
- **Four panels** — a 2 × 2 grid, each panel cropped and positioned on its own.
- **Full bleed** — a single photo across the whole poster.
- **Grades** — Vice Sunset, Neon Night, Golden Hour and Mono Noir recolour the sky, the sun, the photo tint and the caption.
- **Keys** — 1/2/3 switch layout, G cycles the grade.

## Try it

Serve `app/` with any static file server and open `index.html`, for example:

```
cd app && python3 -m http.server 8080
```

Then open http://localhost:8080 — the Boulevard sample is already loaded. Add your own photos, drag to position them, edit the caption, and hit Export PNG.

[make.fun](https://make.fun/bounty/gta6-cover-art-01)
