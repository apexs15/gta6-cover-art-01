// Neon Coast editor — wires the cover engine to the page: photos, panels, caption, export.
'use strict';

const editorState = {
  layout: 'hero',
  grade: 'vice',
  title: 'SUNSET HEIST',
  subtitle: 'VICE CITY NIGHTS',
  photos: [],
  photoNames: [],
  panels: [
    { photo: 0, ox: 0, oy: 0, zoom: 1 },
    { photo: 1, ox: 0, oy: 0, zoom: 1 },
    { photo: 0, ox: 0, oy: 0, zoom: 1 },
    { photo: 1, ox: 0, oy: 0, zoom: 1 }
  ],
  selected: 0,
  sizeIndex: 0
};

const SAMPLE_PHOTOS = ['boulevard', 'pier'];

function $(id) { return document.getElementById(id); }

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + url));
    img.src = url;
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('could not read ' + file.name));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('could not read ' + file.name));
    reader.readAsDataURL(file);
  });
}

async function addPhoto(img, name) {
  editorState.photos.push(img);
  editorState.photoNames.push(name || ('photo ' + editorState.photos.length));
  refreshPhotoButtons();
}

async function loadSamples() {
  for (const name of SAMPLE_PHOTOS) {
    try {
      const img = await loadImageFromUrl('samples/' + name + '.jpg');
      await addPhoto(img, name);
    } catch (e) {
      console.warn(e.message);
    }
  }
}

function previewCanvas() { return $('cover-preview'); }

function redraw() {
  const canvas = previewCanvas();
  if (!canvas) return;
  const size = COVER_SIZES[editorState.sizeIndex] || COVER_SIZES[0];
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  drawCover(ctx, size.w, size.h, editorState);
  highlightSelected(canvas);
}

function highlightSelected(canvas) {
  const box = $('panel-hint');
  if (!box) return;
  const rects = coverLayoutRects(editorState.layout, canvas.width, canvas.height);
  const r = rects[editorState.selected] || rects[0];
  const scaleX = canvas.clientWidth / canvas.width;
  const scaleY = canvas.clientHeight / canvas.height;
  box.style.display = 'block';
  box.style.left = (r.x * scaleX) + 'px';
  box.style.top = (r.y * scaleY) + 'px';
  box.style.width = (r.w * scaleX) + 'px';
  box.style.height = (r.h * scaleY) + 'px';
}

function panelAt(clientX, clientY) {
  const canvas = previewCanvas();
  const bounds = canvas.getBoundingClientRect();
  const px = (clientX - bounds.left) * (canvas.width / bounds.width);
  const py = (clientY - bounds.top) * (canvas.height / bounds.height);
  const rects = coverLayoutRects(editorState.layout, canvas.width, canvas.height);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
  }
  return -1;
}

function refreshPhotoButtons() {
  const wrap = $('photo-pick');
  if (!wrap) return;
  wrap.innerHTML = '';
  editorState.photos.forEach((img, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pick';
    btn.textContent = editorState.photoNames[i] || ('photo ' + (i + 1));
    btn.addEventListener('click', () => {
      editorState.panels[editorState.selected].photo = i;
      redraw();
      syncZoomSlider();
    });
    wrap.appendChild(btn);
  });
  const all = document.createElement('button');
  all.type = 'button';
  all.className = 'pick wide';
  all.textContent = 'Use this photo in every panel';
  all.addEventListener('click', () => {
    const idx = editorState.panels[editorState.selected].photo;
    editorState.panels.forEach((p) => { p.photo = idx; });
    redraw();
  });
  wrap.appendChild(all);
}

function syncZoomSlider() {
  const slider = $('zoom');
  if (!slider) return;
  slider.value = String(Math.round((editorState.panels[editorState.selected].zoom || 1) * 100));
}

function bindControls() {
  document.querySelectorAll('[data-layout]').forEach((btn) => {
    btn.addEventListener('click', () => {
      editorState.layout = btn.getAttribute('data-layout');
      document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('active', b === btn));
      editorState.selected = 0;
      redraw();
    });
  });
  document.querySelectorAll('[data-grade]').forEach((btn) => {
    btn.addEventListener('click', () => {
      editorState.grade = btn.getAttribute('data-grade');
      document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('active', b === btn));
      redraw();
    });
  });
  const title = $('caption-title');
  if (title) title.addEventListener('input', () => { editorState.title = title.value; redraw(); });
  const sub = $('caption-sub');
  if (sub) sub.addEventListener('input', () => { editorState.subtitle = sub.value; redraw(); });
  const size = $('export-size');
  if (size) size.addEventListener('change', () => { editorState.sizeIndex = Number(size.value); redraw(); });
  const zoom = $('zoom');
  if (zoom) zoom.addEventListener('input', () => {
    editorState.panels[editorState.selected].zoom = Number(zoom.value) / 100;
    redraw();
  });
  const reset = $('reset-panel');
  if (reset) reset.addEventListener('click', () => {
    editorState.panels[editorState.selected] = { photo: editorState.panels[editorState.selected].photo, ox: 0, oy: 0, zoom: 1 };
    syncZoomSlider();
    redraw();
  });
  const file = $('photo-file');
  if (file) file.addEventListener('change', async () => {
    for (const f of Array.from(file.files || [])) {
      try {
        const img = await loadImageFromFile(f);
        await addPhoto(img, f.name);
        editorState.panels[editorState.selected].photo = editorState.photos.length - 1;
      } catch (e) { console.warn(e.message); }
    }
    file.value = '';
    redraw();
  });
  const drop = $('drop-zone');
  if (drop) {
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', async (e) => {
      e.preventDefault();
      drop.classList.remove('over');
      const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.indexOf('image/') === 0);
      for (const f of files) {
        try {
          const img = await loadImageFromFile(f);
          await addPhoto(img, f.name);
          editorState.panels[editorState.selected].photo = editorState.photos.length - 1;
        } catch (err) { console.warn(err.message); }
      }
      redraw();
    });
  }
  const canvas = previewCanvas();
  if (canvas) {
    let dragging = null;
    canvas.addEventListener('pointerdown', (e) => {
      const hit = panelAt(e.clientX, e.clientY);
      if (hit < 0) return;
      editorState.selected = hit;
      dragging = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      syncZoomSlider();
      redraw();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const bounds = canvas.getBoundingClientRect();
      const rects = coverLayoutRects(editorState.layout, canvas.width, canvas.height);
      const r = rects[editorState.selected];
      const panel = editorState.panels[editorState.selected];
      panel.ox += ((e.clientX - dragging.x) / bounds.width) * (canvas.width / r.w);
      panel.oy += ((e.clientY - dragging.y) / bounds.height) * (canvas.height / r.h);
      panel.ox = Math.max(-0.6, Math.min(0.6, panel.ox));
      panel.oy = Math.max(-0.6, Math.min(0.6, panel.oy));
      dragging = { x: e.clientX, y: e.clientY };
      redraw();
    });
    const endDrag = () => { dragging = null; };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const hit = panelAt(e.clientX, e.clientY);
      if (hit < 0) return;
      editorState.selected = hit;
      const panel = editorState.panels[hit];
      panel.zoom = Math.max(1, Math.min(4, (panel.zoom || 1) * (1 - e.deltaY * 0.001)));
      syncZoomSlider();
      redraw();
    }, { passive: false });
  }
  const exportBtn = $('export-png');
  if (exportBtn) exportBtn.addEventListener('click', async () => {
    const size = COVER_SIZES[editorState.sizeIndex] || COVER_SIZES[0];
    const out = renderCoverCanvas(size.w, size.h, editorState);
    out.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'neon-coast-' + size.w + 'x' + size.h + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, 'image/png');
  });
}

function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === '1' || e.key === '2' || e.key === '3') {
      const layout = COVER_LAYOUTS[Number(e.key) - 1];
      editorState.layout = layout;
      document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-layout') === layout));
      editorState.selected = 0;
      redraw();
    }
    if (e.key === 'g' || e.key === 'G') {
      const names = Object.keys(COVER_GRADES);
      const next = names[(names.indexOf(editorState.grade) + 1) % names.length];
      editorState.grade = next;
      document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-grade') === next));
      redraw();
    }
  });
}

function readShotParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get('shot') || '',
    photo: q.get('photo') || 'boulevard',
    caption: q.get('caption') || '',
    layout: q.get('layout') || '',
    grade: q.get('grade') || ''
  };
}

async function boot() {
  bindControls();
  bindKeyboard();
  await loadSamples();
  const params = readShotParams();
  if (params.caption) {
    editorState.title = decodeURIComponent(params.caption);
    const title = $('caption-title');
    if (title) title.value = editorState.title;
  }
  if (params.layout && COVER_LAYOUTS.includes(params.layout)) editorState.layout = params.layout;
  if (params.grade && COVER_GRADES[params.grade]) editorState.grade = params.grade;
  if (params.shot === 'cover') {
    document.body.classList.add('shot-cover');
    const canvas = previewCanvas();
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const wanted = SAMPLE_PHOTOS.indexOf(params.photo);
    const img = editorState.photos[wanted >= 0 ? wanted : 0] || editorState.photos[0] || null;
    const state = Object.assign({}, editorState, { photos: img ? [img, img, img, img] : [] });
    const ctx = canvas.getContext('2d');
    drawCover(ctx, canvas.width, canvas.height, state);
    window.__shotReady = true;
    return;
  }
  redraw();
  syncZoomSlider();
  window.__shotReady = true;
}

document.addEventListener('DOMContentLoaded', boot);
