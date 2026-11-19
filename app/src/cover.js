// Neon Coast cover engine — draws a multi-panel GTA-style poster on a 2D canvas.
// No Rockstar artwork, logo or font is used: every shape here is drawn by hand.
'use strict';

const COVER_GRADES = {
  vice: {
    skyTop: '#2b1055', skyMid: '#ff2e63', skyBot: '#ff9a3d',
    sun: '#ffd319', sunGlow: 'rgba(255, 211, 25, 0.55)',
    photoTint: 'rgba(255, 80, 40, 0.10)', frame: '#ffffff', band: '#12081f',
    titleFrom: '#ffdd33', titleTo: '#ff2e63', sub: '#ffe9f3', palm: '#160a26'
  },
  neon: {
    skyTop: '#0b0620', skyMid: '#302b63', skyBot: '#ff00aa',
    sun: '#00f0ff', sunGlow: 'rgba(0, 240, 255, 0.50)',
    photoTint: 'rgba(255, 0, 170, 0.12)', frame: '#eafcff', band: '#070312',
    titleFrom: '#7df9ff', titleTo: '#ff00aa', sub: '#d8fbff', palm: '#08021a'
  },
  gold: {
    skyTop: '#3d1e05', skyMid: '#f7971e', skyBot: '#ffe259',
    sun: '#fff6bf', sunGlow: 'rgba(255, 226, 89, 0.55)',
    photoTint: 'rgba(255, 180, 40, 0.12)', frame: '#fff8e7', band: '#1d0f02',
    titleFrom: '#fff3b0', titleTo: '#ff7e5f', sub: '#fff1cf', palm: '#241203'
  },
  noir: {
    skyTop: '#161616', skyMid: '#4a4a4a', skyBot: '#9a9a9a',
    sun: '#f2f2f2', sunGlow: 'rgba(255, 255, 255, 0.40)',
    photoTint: 'rgba(0, 0, 0, 0.08)', frame: '#f5f5f5', band: '#0a0a0a',
    titleFrom: '#ffffff', titleTo: '#cfcfcf', sub: '#e8e8e8', palm: '#111111'
  }
};

const COVER_LAYOUTS = ['hero', 'grid', 'solo'];
const COVER_SIZES = [
  { label: '1080 x 1080', w: 1080, h: 1080 },
  { label: '1080 x 1350', w: 1080, h: 1350 },
  { label: '1920 x 1080', w: 1920, h: 1080 }
];

/** Small seeded RNG so the grain is identical on every render. */
function coverRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Panel rectangles for a layout, as fractions of the cover. Sky sits above, caption below. */
function coverLayoutRects(layout, W, H) {
  const top = H * 0.155;
  const bottom = H * 0.835;
  const areaH = bottom - top;
  const gap = Math.max(6, W * 0.012);
  const x0 = W * 0.025;
  const x1 = W * 0.975;
  const w = x1 - x0;
  if (layout === 'grid') {
    const cw = (w - gap) / 2;
    const ch = (areaH - gap) / 2;
    return [
      { x: x0, y: top, w: cw, h: ch },
      { x: x0 + cw + gap, y: top, w: cw, h: ch },
      { x: x0, y: top + ch + gap, w: cw, h: ch },
      { x: x0 + cw + gap, y: top + ch + gap, w: cw, h: ch }
    ];
  }
  if (layout === 'solo') {
    return [{ x: x0, y: top, w: w, h: areaH }];
  }
  // hero: one big panel left, three stacked panels right.
  const bigW = w * 0.60;
  const smallX = x0 + bigW + gap;
  const smallW = w - bigW - gap;
  const sh = (areaH - gap * 2) / 3;
  return [
    { x: x0, y: top, w: bigW, h: areaH },
    { x: smallX, y: top, w: smallW, h: sh },
    { x: smallX, y: top + sh + gap, w: smallW, h: sh },
    { x: smallX, y: top + (sh + gap) * 2, w: smallW, h: sh }
  ];
}

/** A palm silhouette: curved trunk and five drooping fronds. */
function drawPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, s * 0.045);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + s * 0.06, y - s * 0.55, x + s * 0.16, y - s * 0.95);
  ctx.stroke();
  const topX = x + s * 0.16;
  const topY = y - s * 0.95;
  ctx.lineWidth = Math.max(1.5, s * 0.03);
  for (let i = 0; i < 5; i++) {
    const a = (-0.25 - i * 0.28) * Math.PI;
    const ex = topX + Math.cos(a) * s * 0.62;
    const ey = topY + Math.sin(a) * s * 0.34 + s * 0.22;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(a) * s * 0.34, topY + s * 0.05, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

/** Sunset sky: gradient, slatted synthwave sun, palm silhouettes along the base. */
function drawCoverSky(ctx, W, H, grade) {
  const skyH = H * 0.155;
  const grad = ctx.createLinearGradient(0, 0, 0, skyH);
  grad.addColorStop(0, grade.skyTop);
  grad.addColorStop(0.55, grade.skyMid);
  grad.addColorStop(1, grade.skyBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, skyH);
  // Sun with glow and slats.
  const sunR = Math.min(W, H) * 0.085;
  const sunX = W * 0.5;
  const sunY = skyH * 0.92;
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.4);
  glow.addColorStop(0, grade.sunGlow);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - sunR * 2.4, sunY - sunR * 2.4, sunR * 4.8, sunR * 4.8);
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = grade.sun;
  ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
  ctx.fillStyle = grade.skyMid;
  let slatY = sunY + sunR * 0.08;
  let slatH = Math.max(2, sunR * 0.045);
  while (slatY < sunY + sunR) {
    ctx.fillRect(sunX - sunR, slatY, sunR * 2, slatH);
    slatY += slatH + Math.max(3, sunR * 0.10);
    slatH *= 1.5;
  }
  ctx.restore();
  // Palms along the sky base, left and right.
  const palmS = Math.min(W, H) * 0.075;
  drawPalm(ctx, W * 0.06, skyH, palmS, grade.palm);
  drawPalm(ctx, W * 0.13, skyH + 2, palmS * 0.7, grade.palm);
  drawPalm(ctx, W * 0.94, skyH, palmS, grade.palm);
  drawPalm(ctx, W * 0.87, skyH + 2, palmS * 0.7, grade.palm);
}

/** Cover-fit source placement for a photo inside a panel, with pan and zoom. */
function coverFit(img, rect, panel) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const zoom = panel.zoom || 1;
  const scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = rect.x + (rect.w - dw) / 2 + (panel.ox || 0) * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + (panel.oy || 0) * rect.h;
  return { dx: dx, dy: dy, dw: dw, dh: dh };
}

/** One framed panel: white frame, photo, grade tint. */
function drawCoverPanel(ctx, img, rect, panel, grade, gradeName) {
  const frame = Math.max(4, Math.min(rect.w, rect.h) * 0.035);
  ctx.fillStyle = grade.frame;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const inner = { x: rect.x + frame, y: rect.y + frame, w: rect.w - frame * 2, h: rect.h - frame * 2 };
  ctx.save();
  ctx.beginPath();
  ctx.rect(inner.x, inner.y, inner.w, inner.h);
  ctx.clip();
  if (img) {
    if (gradeName === 'noir') ctx.filter = 'grayscale(1) contrast(1.15) brightness(1.03)';
    const fit = coverFit(img, inner, panel);
    ctx.drawImage(img, fit.dx, fit.dy, fit.dw, fit.dh);
    ctx.filter = 'none';
    ctx.fillStyle = grade.photoTint;
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  } else {
    const g = ctx.createLinearGradient(inner.x, inner.y, inner.x + inner.w, inner.y + inner.h);
    g.addColorStop(0, grade.skyMid);
    g.addColorStop(1, grade.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  }
  ctx.restore();
}

/** Bold GTA-style caption band at the bottom of the cover. */
function drawCoverCaption(ctx, W, H, grade, title, subtitle) {
  const bandY = H * 0.835;
  const bandH = H - bandY;
  ctx.fillStyle = grade.band;
  ctx.fillRect(0, bandY, W, bandH);
  const stripe = ctx.createLinearGradient(0, bandY, W, bandY);
  stripe.addColorStop(0, grade.titleFrom);
  stripe.addColorStop(0.5, grade.titleTo);
  stripe.addColorStop(1, grade.titleFrom);
  ctx.fillStyle = stripe;
  ctx.fillRect(0, bandY, W, Math.max(3, H * 0.006));
  const text = (title || 'NEON COAST').toUpperCase();
  let size = W * 0.105;
  const setFont = (s) => { ctx.font = 'italic 900 ' + s + 'px "Arial Black", "Helvetica Neue", Arial, sans-serif'; };
  setFont(size);
  while (ctx.measureText(text).width > W * 0.94 && size > 12) {
    size *= 0.92;
    setFont(size);
  }
  const titleGrad = ctx.createLinearGradient(W * 0.03, 0, W * 0.97, 0);
  titleGrad.addColorStop(0, grade.titleFrom);
  titleGrad.addColorStop(0.55, grade.titleTo);
  titleGrad.addColorStop(1, grade.titleFrom);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.shadowColor = grade.titleTo;
  ctx.shadowBlur = size * 0.22;
  ctx.fillStyle = titleGrad;
  ctx.fillText(text, W * 0.03, bandY + bandH * 0.42);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.strokeText(text, W * 0.03, bandY + bandH * 0.42);
  if (subtitle) {
    const sub = subtitle.toUpperCase();
    const subSize = Math.max(12, W * 0.026);
    ctx.font = '700 ' + subSize + 'px "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = grade.sub;
    // Letter-spaced by hand so the tracking holds in every browser.
    const tracking = subSize * 0.34;
    let sx = W * 0.032;
    const sy = bandY + bandH * 0.82;
    for (const ch of sub) {
      ctx.fillText(ch, sx, sy);
      sx += ctx.measureText(ch).width + tracking;
    }
  }
}

/** Film grain + vignette for a finished poster look. */
function drawCoverFinish(ctx, W, H, seed) {
  const rng = coverRng(seed || 20261120);
  ctx.save();
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < Math.floor((W * H) / 900); i++) {
    const x = rng() * W;
    const y = rng() * H;
    ctx.fillStyle = rng() > 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  ctx.restore();
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.30)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

/**
 * Draw the whole cover. state: { layout, grade, title, subtitle, photos, panels }
 * photos: array of HTMLImageElement (or null); panels: array of { photo, ox, oy, zoom }.
 */
function drawCover(ctx, W, H, state) {
  const gradeName = COVER_GRADES[state.grade] ? state.grade : 'vice';
  const grade = COVER_GRADES[gradeName];
  const layout = COVER_LAYOUTS.includes(state.layout) ? state.layout : 'hero';
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = grade.band;
  ctx.fillRect(0, 0, W, H);
  drawCoverSky(ctx, W, H, grade);
  const rects = coverLayoutRects(layout, W, H);
  for (let i = 0; i < rects.length; i++) {
    const panel = (state.panels && state.panels[i]) || { photo: 0, ox: 0, oy: 0, zoom: 1 };
    const img = state.photos ? state.photos[panel.photo] : null;
    drawCoverPanel(ctx, img || null, rects[i], panel, grade, gradeName);
  }
  drawCoverCaption(ctx, W, H, grade, state.title, state.subtitle);
  drawCoverFinish(ctx, W, H, 20261120);
}

/** Render a cover to a fresh canvas at the requested size. */
function renderCoverCanvas(W, H, state) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  drawCover(ctx, W, H, state);
  return canvas;
}
