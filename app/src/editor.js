// Neon Coast editor: wires the cover engine to the page. Photos are read with
// FileReader on this machine and never leave it; the app makes no network request.
import { EXPORT_SIZES, LAYOUTS, GRADES, layoutPanels, panelAt, drawCover } from "./cover.js";

const $ = (id) => document.getElementById(id);
const preview = $("preview");
const pctx = preview.getContext("2d");
const params = new URLSearchParams(location.search);
const shotMode = params.get("shot") || "";

const state = {
  size: EXPORT_SIZES[0],
  layout: "hero",
  grade: "vice",
  title: "Neon Coast",
  subtitle: "Vice City Nights",
  photos: [],
  panels: [],
  selected: 0,
};

function defaultPanels() {
  const count = state.layout === "solo" ? 1 : 4;
  const pics = [0, 1, 0, 1];
  const panels = [];
  for (let i = 0; i < count; i++) {
    panels.push({ photo: pics[i] % Math.max(1, state.photos.length), zoom: 1, dx: 0, dy: 0 });
  }
  return panels;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadSample(name) {
  const img = await loadImage(`samples/${name}.jpg`);
  img.dataset.name = `${name}.jpg`;
  return img;
}

function renderPreview() {
  const { w, h } = state.size;
  preview.width = w;
  preview.height = h;
  const drawState = {
    size: state.size,
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    photos: state.photos,
    panels: state.panels,
  };
  drawCover(pctx, drawState);
  highlightSelected();
}

function highlightSelected() {
  if (shotMode === "cover") return;
  const { panels } = layoutPanels(state.layout, state.size.w, state.size.h);
  const rect = panels[state.selected];
  if (!rect) return;
  pctx.save();
  pctx.strokeStyle = "#00e5ff";
  pctx.lineWidth = Math.max(3, state.size.w * 0.004);
  pctx.setLineDash([18, 10]);
  pctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  pctx.restore();
}

function refreshPanelList() {
  const list = $("panelList");
  list.innerHTML = "";
  const names = ["Hero panel", "Panel 2", "Panel 3", "Panel 4"];
  state.panels.forEach((panel, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "panel-btn" + (i === state.selected ? " active" : "");
    const photo = state.photos[panel.photo];
    btn.textContent = `${names[i]} — ${photo ? photo.dataset.name || "Photo " + (panel.photo + 1) : "empty"}`;
    btn.addEventListener("click", () => {
      state.selected = i;
      syncControls();
      renderPreview();
    });
    list.appendChild(btn);
  });
}

function syncControls() {
  updateDocTitle();
  $("layoutSel").value = state.layout;
  $("gradeSel").value = state.grade;
  $("sizeSel").value = state.size.id;
  $("titleInput").value = state.title;
  $("subtitleInput").value = state.subtitle;
  const panel = state.panels[state.selected];
  if (panel) $("zoomRange").value = String(Math.round((panel.zoom || 1) * 100));
  $("photoCount").textContent = `${state.photos.length} photo${state.photos.length === 1 ? "" : "s"} loaded`;
  refreshPanelList();
}

function addPhotos(files) {
  const images = [...files].filter((f) => f.type.startsWith("image/"));
  if (!images.length) return;
  let pending = images.length;
  images.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      loadImage(reader.result)
        .then((img) => {
          img.dataset.name = file.name;
          state.photos.push(img);
          if (state.panels.length === 0) state.panels = defaultPanels();
          if (--pending === 0) {
            syncControls();
            renderPreview();
          }
        })
        .catch(() => {
          if (--pending === 0) {
            syncControls();
            renderPreview();
          }
        });
    };
    reader.readAsDataURL(file);
  });
}

function exportCover(sizeId) {
  const size = EXPORT_SIZES.find((s) => s.id === sizeId) || state.size;
  const canvas = document.createElement("canvas");
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext("2d");
  drawCover(ctx, {
    size,
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    photos: state.photos,
    panels: state.panels,
  });
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

// Test hook: the live editor state, so a Playwright check can read back the
// layout, grade, size and panel transforms after driving the UI.
window.__editorState = state;
window.__coverSizes = EXPORT_SIZES.map((s) => s.id);

function updateDocTitle() {
  document.title = `${state.title || "Neon Coast"} — Cover Maker`;
}

async function downloadExport() {
  const blob = await exportCover(state.size.id);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `neon-coast-${state.size.id}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Test and screenshot hook: export the current cover as a PNG data URL.
window.__exportPng = async function exportPng(sizeId) {
  const blob = await exportCover(sizeId || state.size.id);
  if (!blob) return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
};

// ---- pointer interaction on the preview: click selects a panel, drag pans its
// photo, wheel zooms it. Coordinates are converted from display to canvas pixels.
let drag = null;
function canvasPoint(ev) {
  const r = preview.getBoundingClientRect();
  return {
    x: ((ev.clientX - r.left) / r.width) * preview.width,
    y: ((ev.clientY - r.top) / r.height) * preview.height,
  };
}
preview.addEventListener("pointerdown", (ev) => {
  const p = canvasPoint(ev);
  const hit = panelAt(state.layout, state.size.w, state.size.h, p.x, p.y);
  if (hit < 0) return;
  state.selected = hit;
  const panel = state.panels[hit];
  drag = { x: p.x, y: p.y, dx: panel.dx || 0, dy: panel.dy || 0 };
  preview.setPointerCapture(ev.pointerId);
  syncControls();
  renderPreview();
});
preview.addEventListener("pointermove", (ev) => {
  if (!drag) return;
  const p = canvasPoint(ev);
  const panel = state.panels[state.selected];
  if (!panel) return;
  panel.dx = drag.dx + (p.x - drag.x);
  panel.dy = drag.dy + (p.y - drag.y);
  renderPreview();
});
preview.addEventListener("pointerup", () => {
  drag = null;
});
preview.addEventListener("wheel", (ev) => {
  ev.preventDefault();
  const panel = state.panels[state.selected];
  if (!panel) return;
  const factor = ev.deltaY < 0 ? 1.08 : 1 / 1.08;
  panel.zoom = Math.max(1, Math.min(4, (panel.zoom || 1) * factor));
  $("zoomRange").value = String(Math.round(panel.zoom * 100));
  renderPreview();
}, { passive: false });

// ---- controls
$("fileInput").addEventListener("change", (ev) => {
  addPhotos(ev.target.files);
  ev.target.value = "";
});
$("sampleBoulevard").addEventListener("click", async () => {
  state.photos.push(await loadSample("boulevard"));
  state.panels = defaultPanels();
  syncControls();
  renderPreview();
});
$("samplePier").addEventListener("click", async () => {
  state.photos.push(await loadSample("pier"));
  state.panels = defaultPanels();
  syncControls();
  renderPreview();
});
$("layoutSel").addEventListener("change", (ev) => {
  state.layout = ev.target.value;
  state.panels = defaultPanels();
  state.selected = 0;
  syncControls();
  renderPreview();
});
$("gradeSel").addEventListener("change", (ev) => {
  state.grade = ev.target.value;
  renderPreview();
});
$("sizeSel").addEventListener("change", (ev) => {
  state.size = EXPORT_SIZES.find((s) => s.id === ev.target.value) || EXPORT_SIZES[0];
  renderPreview();
});
$("titleInput").addEventListener("input", (ev) => {
  state.title = ev.target.value;
  renderPreview();
});
$("subtitleInput").addEventListener("input", (ev) => {
  state.subtitle = ev.target.value;
  renderPreview();
});
$("zoomRange").addEventListener("input", (ev) => {
  const panel = state.panels[state.selected];
  if (!panel) return;
  panel.zoom = Number(ev.target.value) / 100;
  renderPreview();
});
$("centerBtn").addEventListener("click", () => {
  const panel = state.panels[state.selected];
  if (!panel) return;
  panel.dx = 0;
  panel.dy = 0;
  panel.zoom = 1;
  syncControls();
  renderPreview();
});
$("exportBtn").addEventListener("click", downloadExport);
$("fillBtn").addEventListener("click", () => {
  const panel = state.panels[state.selected];
  if (!panel || !state.photos.length) return;
  panel.photo = (panel.photo + 1) % state.photos.length;
  syncControls();
  renderPreview();
});
window.addEventListener("dragover", (ev) => ev.preventDefault());
window.addEventListener("drop", (ev) => {
  ev.preventDefault();
  if (ev.dataTransfer && ev.dataTransfer.files.length) addPhotos(ev.dataTransfer.files);
});

// ---- boot: fill the layout selects, load the free samples, honour ?shot=.
function fillSelect(sel, items) {
  items.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.label;
    sel.appendChild(opt);
  });
}
fillSelect($("layoutSel"), LAYOUTS);
fillSelect($("gradeSel"), GRADES);
fillSelect($("sizeSel"), EXPORT_SIZES);
if (params.get("caption")) state.title = params.get("caption");
if (params.get("subtitle")) state.subtitle = params.get("subtitle");
if (params.get("layout")) state.layout = params.get("layout");
if (params.get("grade")) state.grade = params.get("grade");
if (params.get("size")) {
  state.size = EXPORT_SIZES.find((s) => s.id === params.get("size")) || EXPORT_SIZES[0];
}
const wantedPhoto = params.get("photo") || "boulevard";

async function boot() {
  try {
    const first = await loadSample(wantedPhoto);
    state.photos.push(first);
    const second = await loadSample(wantedPhoto === "pier" ? "boulevard" : "pier");
    state.photos.push(second);
  } catch (e) {
    state.photos = [];
  }
  state.panels = defaultPanels();
  if (shotMode === "cover") {
    document.body.classList.add("shot-cover");
    state.size = EXPORT_SIZES.find((s) => s.id === (params.get("size") || "1080x1080")) || EXPORT_SIZES[0];
  }
  syncControls();
  renderPreview();
  window.__shotReady = true;
}
boot();
