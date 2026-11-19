// Neon Coast cover engine: draws GTA-poster-style multi-panel covers on a 2D canvas.
// Every photo is an Image the editor loaded from the user's own machine; nothing
// is uploaded and nothing is fetched over the network.

export const EXPORT_SIZES = [
  { id: "1080x1080", label: "Square · 1080 × 1080", w: 1080, h: 1080 },
  { id: "1080x1350", label: "Portrait · 1080 × 1350", w: 1080, h: 1350 },
  { id: "1920x1080", label: "Wide · 1920 × 1080", w: 1920, h: 1080 },
];

export const LAYOUTS = [
  { id: "hero", label: "Hero + three panels" },
  { id: "grid", label: "Four-panel grid" },
  { id: "solo", label: "Full-bleed single photo" },
];

export const GRADES = [
  { id: "vice", label: "Vice Sunset" },
  { id: "neon", label: "Neon Night" },
  { id: "gold", label: "Golden Hour" },
  { id: "noir", label: "Mono Noir" },
];

// Deterministic pseudo-random stream, so a cover renders the same way every time.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Panel rectangles for a layout, as fractions of the canvas, plus the caption band.
// The top 9% stays open sky (sun and palms show there); the caption band always
// sits at the bottom; panels fill the rest.
export function layoutPanels(layoutId, w, h) {
  const bandH = Math.round(h * 0.2);
  const top = h - bandH;
  const skyH = Math.round(h * 0.09);
  const gap = Math.max(6, Math.round(w * 0.008));
  const frame = Math.max(4, Math.round(w * 0.005));
  const portrait = h > w * 1.08;
  const square = !portrait && h < w * 1.08 && w < h * 1.08;
  const areaTop = skyH;
  const areaH = top - skyH;
  if (layoutId === "grid") {
    const halfW = (w - gap * 3) / 2;
    const halfH = (areaH - gap * 3) / 2;
    return {
      panels: [
        { x: gap, y: areaTop + gap, w: halfW, h: halfH },
        { x: gap * 2 + halfW, y: areaTop + gap, w: halfW, h: halfH },
        { x: gap, y: areaTop + gap * 2 + halfH, w: halfW, h: halfH },
        { x: gap * 2 + halfW, y: areaTop + gap * 2 + halfH, w: halfW, h: halfH },
      ],
      caption: { x: 0, y: top, w, h: bandH },
      frame,
      skyH,
    };
  }
  if (layoutId === "solo") {
    return {
      panels: [{ x: gap, y: areaTop + gap, w: w - gap * 2, h: areaH - gap * 2 }],
      caption: { x: 0, y: top, w, h: bandH },
      frame,
      skyH,
    };
  }
  // hero: one big panel plus three small ones.
  if (portrait) {
    const heroH = Math.round(areaH * 0.56);
    const smallW = (w - gap * 4) / 3;
    const smallH = areaH - heroH - gap * 3;
    return {
      panels: [
        { x: gap, y: areaTop + gap, w: w - gap * 2, h: heroH },
        { x: gap, y: areaTop + heroH + gap * 2, w: smallW, h: smallH },
        { x: gap * 2 + smallW, y: areaTop + heroH + gap * 2, w: smallW, h: smallH },
        { x: gap * 3 + smallW * 2, y: areaTop + heroH + gap * 2, w: smallW, h: smallH },
      ],
      caption: { x: 0, y: top, w, h: bandH },
      frame,
      skyH,
    };
  }
  const heroW = Math.round(w * (square ? 0.6 : 0.55));
  const smallW = w - heroW - gap * 3;
  const smallH = (areaH - gap * 4) / 3;
  return {
    panels: [
      { x: gap, y: areaTop + gap, w: heroW, h: areaH - gap * 2 },
      { x: heroW + gap * 2, y: areaTop + gap, w: smallW, h: smallH },
      { x: heroW + gap * 2, y: areaTop + gap * 2 + smallH, w: smallW, h: smallH },
      { x: heroW + gap * 2, y: areaTop + gap * 3 + smallH * 2, w: smallW, h: smallH },
    ],
    caption: { x: 0, y: top, w, h: bandH },
    frame,
    skyH,
  };
}

// Which panel, if any, holds the point (px, py) in canvas pixels.
export function panelAt(layoutId, w, h, px, py) {
  const { panels } = layoutPanels(layoutId, w, h);
  for (let i = panels.length - 1; i >= 0; i--) {
    const r = panels[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
  }
  return -1;
}

// Draw one photo into a panel rect: cover-fit, then the panel's zoom and pan.
// The pan is clamped so the photo always covers the panel.
function drawPhotoInto(ctx, img, rect, panel, gradeId) {
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * (panel.zoom || 1);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const maxDx = Math.max(0, (dw - rect.w) / 2);
  const maxDy = Math.max(0, (dh - rect.h) / 2);
  const dx = Math.max(-maxDx, Math.min(maxDx, panel.dx || 0));
  const dy = Math.max(-maxDy, Math.min(maxDy, panel.dy || 0));
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (gradeId === "noir") ctx.filter = "grayscale(1) contrast(1.18) brightness(1.04)";
  else ctx.filter = "saturate(1.22) contrast(1.06)";
  ctx.drawImage(img, rect.x + (rect.w - dw) / 2 + dx, rect.y + (rect.h - dh) / 2 + dy, dw, dh);
  ctx.restore();
}

// Synthwave sun: a disc with horizontal slits cut out of its lower half.
// Drawn on a scratch canvas first, so the slits stay transparent and the sky
// behind the sun shows through them.
function drawSun(ctx, cx, cy, r) {
  const scratch = document.createElement("canvas");
  scratch.width = Math.ceil(r * 2 + 4);
  scratch.height = Math.ceil(r * 2 + 4);
  const s = scratch.getContext("2d");
  const grad = s.createLinearGradient(0, 0, 0, r * 2);
  grad.addColorStop(0, "#ffd166");
  grad.addColorStop(0.55, "#ff7b54");
  grad.addColorStop(1, "#ff2e88");
  s.beginPath();
  s.arc(r + 2, r + 2, r, 0, Math.PI * 2);
  s.fillStyle = grad;
  s.fill();
  s.globalCompositeOperation = "destination-out";
  let y = r + 2 + r * 0.05;
  let slit = r * 0.06;
  while (y < r * 2 + 2) {
    s.fillRect(0, y, r * 2 + 4, slit);
    y += slit + r * 0.16;
    slit *= 1.5;
  }
  ctx.drawImage(scratch, cx - r - 2, cy - r - 2);
}

// One stylised palm silhouette: a leaning trunk and six arcing fronds.
function drawPalm(ctx, x, y, s, lean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(lean);
  ctx.strokeStyle = "#160a2e";
  ctx.fillStyle = "#160a2e";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(10, -60, 4, -110);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 6 - (i * Math.PI) / 7.5;
    const len = 52 - Math.abs(i - 2.5) * 7;
    ctx.beginPath();
    ctx.moveTo(4, -110);
    ctx.quadraticCurveTo(
      4 + Math.cos(a) * len * 0.6,
      -110 + Math.sin(a) * len * 0.5 - 14,
      4 + Math.cos(a) * len,
      -110 + Math.sin(a) * len + 16
    );
    ctx.stroke();
  }
  ctx.restore();
}

// Bold GTA-style lettering: heavy italic sans, white fill, dark outline, neon shadow.
function drawCaption(ctx, rect, title, subtitle, w) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  const band = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y);
  band.addColorStop(0, "#1b0b33");
  band.addColorStop(0.5, "#2a0f45");
  band.addColorStop(1, "#160a2e");
  ctx.fillStyle = band;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = "#ff2e88";
  ctx.fillRect(rect.x, rect.y, rect.w, Math.max(3, rect.h * 0.03));
  const pad = rect.w * 0.045;
  const titleText = (title || "UNTITLED").toUpperCase();
  let size = rect.h * 0.52;
  ctx.textBaseline = "middle";
  const fit = () => {
    ctx.font = `italic 900 ${size}px "Arial Black", Arial, sans-serif`;
    return ctx.measureText(titleText).width <= rect.w - pad * 2;
  };
  while (size > 12 && !fit()) size -= 2;
  ctx.font = `italic 900 ${size}px "Arial Black", Arial, sans-serif`;
  ctx.shadowColor = "#ff2e88";
  ctx.shadowBlur = size * 0.16;
  ctx.shadowOffsetY = size * 0.04;
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.strokeStyle = "#120826";
  ctx.lineJoin = "round";
  const titleY = rect.y + rect.h * 0.42;
  ctx.strokeText(titleText, rect.x + pad, titleY);
  const titleGrad = ctx.createLinearGradient(rect.x, titleY - size * 0.5, rect.x, titleY + size * 0.5);
  titleGrad.addColorStop(0, "#ffffff");
  titleGrad.addColorStop(1, "#ffd166");
  ctx.fillStyle = titleGrad;
  ctx.fillText(titleText, rect.x + pad, titleY);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  const sub = (subtitle || "").toUpperCase();
  if (sub) {
    const subSize = Math.max(11, rect.h * 0.16);
    ctx.font = `700 ${subSize}px Arial, sans-serif`;
    try {
      ctx.letterSpacing = `${Math.max(2, subSize * 0.28)}px`;
    } catch (e) {
      /* letterSpacing is Chrome-only; spacing is cosmetic */
    }
    ctx.fillStyle = "#ffb3d1";
    ctx.fillText(sub, rect.x + pad, rect.y + rect.h * 0.82);
  }
  ctx.restore();
}

// Sunset / neon colour grade over the finished cover, plus vignette and grain.
function applyGrade(ctx, w, h, gradeId) {
  if (gradeId === "noir") {
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    if (gradeId === "neon") {
      sky.addColorStop(0, "rgba(255,46,136,0.28)");
      sky.addColorStop(0.55, "rgba(120,40,200,0.16)");
      sky.addColorStop(1, "rgba(0,229,255,0.22)");
    } else if (gradeId === "gold") {
      sky.addColorStop(0, "rgba(255,190,80,0.30)");
      sky.addColorStop(0.6, "rgba(255,120,60,0.18)");
      sky.addColorStop(1, "rgba(120,40,10,0.20)");
    } else {
      sky.addColorStop(0, "rgba(255,46,136,0.26)");
      sky.addColorStop(0.5, "rgba(255,123,84,0.20)");
      sky.addColorStop(1, "rgba(255,209,102,0.16)");
    }
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.72);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(10,4,28,0.34)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
  const rand = mulberry32(20261119);
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = "#ffffff";
  const dots = Math.floor((w * h) / 900);
  for (let i = 0; i < dots; i++) {
    const x = rand() * w;
    const y = rand() * h;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.restore();
}

// Draw the whole cover. state: { size, layout, grade, title, subtitle, photos, panels }
// photos: Image list; panels[i]: { photo, zoom, dx, dy } in canvas pixels at export size.
export function drawCover(ctx, state) {
  const { w, h } = state.size;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#2b1055");
  sky.addColorStop(0.45, "#7597de");
  sky.addColorStop(0.62, "#ff7b54");
  sky.addColorStop(0.8, "#ff2e88");
  sky.addColorStop(1, "#1b0b33");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const { panels, caption, frame, skyH } = layoutPanels(state.layout, w, h);
  drawSun(ctx, w * 0.82, skyH * 0.55, skyH * 0.45);
  drawPalm(ctx, w * 0.035, skyH * 1.02, Math.min(w, h) / 2600, 0.12);
  drawPalm(ctx, w * 0.965, skyH * 1.02, Math.min(w, h) / 3000, -0.14);
  panels.forEach((rect, i) => {
    const panel = state.panels[i] || { photo: 0, zoom: 1, dx: 0, dy: 0 };
    const img = state.photos[panel.photo];
    ctx.save();
    ctx.fillStyle = "#f5f0ff";
    ctx.fillRect(rect.x - frame, rect.y - frame, rect.w + frame * 2, rect.h + frame * 2);
    if (img && img.naturalWidth > 0) {
      drawPhotoInto(ctx, img, rect, panel, state.grade);
    } else {
      const empty = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
      empty.addColorStop(0, "#3a1c5c");
      empty.addColorStop(1, "#120826");
      ctx.fillStyle = empty;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = `700 ${Math.max(14, rect.w * 0.045)}px Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ADD A PHOTO", rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.textAlign = "left";
    }
    ctx.restore();
  });
  drawCaption(ctx, caption, state.title, state.subtitle, w);
  applyGrade(ctx, w, h, state.grade);
}
