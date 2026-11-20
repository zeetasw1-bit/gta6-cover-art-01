// Vice Cover Studio — cover renderer.
//
// Pure canvas drawing: given a state object it paints one poster cover
// (multi-panel layout, photo per panel, colour grade, caption lettering)
// onto any canvas. No network, no DOM reads besides the canvas itself,
// so the editor and the ?shot= screenshot scenes share this exact code.

export const LAYOUTS = ['grid', 'strip', 'hero'];
export const GRADES = ['sunset', 'neon', 'noir'];
export const SIZES = [
  { label: '1080 x 1080', width: 1080, height: 1080 },
  { label: '1080 x 1350', width: 1080, height: 1350 },
  { label: '1920 x 1080', width: 1920, height: 1080 },
];

/** How many photo panels each layout holds. */
export function panelCount(layout) {
  if (layout === 'grid') return 3;
  if (layout === 'strip') return 4;
  return 1;
}

/** A fresh, empty panel: no photo yet, neutral zoom and pan. */
export function emptyPanel() {
  return { img: null, zoom: 1, px: 0, py: 0 };
}

/** A fresh state object for a new cover. */
export function freshState() {
  return {
    layout: 'grid',
    width: 1080,
    height: 1080,
    panels: [emptyPanel(), emptyPanel(), emptyPanel()],
    caption: 'SUNSET HEIST',
    sub: 'SUNSET BAY',
    captionSize: 1,
    captionPos: 'bottom',
    grade: 'sunset',
    vignette: true,
    grain: true,
    glow: false,
  };
}

/**
 * Panel rectangles for a layout, as fractions of the inner area.
 * Grid: big hero left (~60%), two stacked right.
 * Strip: three vertical panels over one wide strip.
 * Hero: one full-bleed photo.
 */
export function panelRects(layout, w, h) {
  const frame = Math.round(Math.min(w, h) * 0.016);
  const gut = Math.round(Math.min(w, h) * 0.007);
  const x0 = frame;
  const y0 = frame;
  const iw = w - frame * 2;
  const ih = h - frame * 2;
  if (layout === 'grid') {
    const heroW = Math.round(iw * 0.6) - gut;
    const sideX = x0 + heroW + gut * 2;
    const sideW = iw - heroW - gut * 2;
    const halfH = Math.round(ih / 2) - gut;
    return [
      { x: x0, y: y0, w: heroW, h: ih },
      { x: sideX, y: y0, w: sideW, h: halfH },
      { x: sideX, y: y0 + halfH + gut * 2, w: sideW, h: ih - halfH - gut * 2 },
    ];
  }
  if (layout === 'strip') {
    const stripH = Math.round(ih * 0.28) - gut;
    const topH = ih - stripH - gut * 2;
    const colW = Math.round(iw / 3) - gut;
    return [
      { x: x0, y: y0, w: colW, h: topH },
      { x: x0 + colW + gut * 2, y: y0, w: colW, h: topH },
      { x: x0 + colW * 2 + gut * 4, y: y0, w: iw - colW * 2 - gut * 4, h: topH },
      { x: x0, y: y0 + topH + gut * 2, w: iw, h: stripH },
    ];
  }
  return [{ x: x0, y: y0, w: iw, h: ih }];
}

/** Which panel (if any) holds the point (x, y) in canvas pixels. */
export function panelAt(state, x, y) {
  const rects = panelRects(state.layout, state.width, state.height);
  for (let i = rects.length - 1; i >= 0; i -= 1) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

function drawPhotoIn(ctx, img, rect, panel, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (grade === 'noir') ctx.filter = 'grayscale(0.9) contrast(1.18) sepia(0.18)';
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * Math.max(1, panel.zoom || 1);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const slackX = Math.max(0, (dw - rect.w) / 2);
  const slackY = Math.max(0, (dh - rect.h) / 2);
  const dx = rect.x + (rect.w - dw) / 2 + (panel.px || 0) * slackX;
  const dy = rect.y + (rect.h - dh) / 2 + (panel.py || 0) * slackY;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.filter = 'none';
  ctx.restore();
}

function drawPlaceholder(ctx, rect, index) {
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  grad.addColorStop(0, '#3a2340');
  grad.addColorStop(1, '#1c1226');
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, rect.w * 0.004);
  ctx.setLineDash([rect.w * 0.02, rect.w * 0.02]);
  ctx.strokeRect(rect.x + 6, rect.y + 6, rect.w - 12, rect.h - 12);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const size = Math.max(14, Math.min(rect.w, rect.h) * 0.11);
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`PHOTO ${index + 1}`, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

/** Warm sunset wash, cool neon wash, or a dark warm veil for noir. */
function paintGrade(ctx, w, h, grade) {
  let wash;
  if (grade === 'neon') {
    wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, 'rgba(110, 50, 255, 0.16)');
    wash.addColorStop(0.55, 'rgba(40, 120, 255, 0.08)');
    wash.addColorStop(1, 'rgba(0, 225, 200, 0.20)');
  } else if (grade === 'noir') {
    wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, 'rgba(60, 35, 20, 0.05)');
    wash.addColorStop(1, 'rgba(20, 10, 5, 0.28)');
  } else {
    wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, 'rgba(255, 150, 60, 0.10)');
    wash.addColorStop(0.55, 'rgba(255, 90, 60, 0.10)');
    wash.addColorStop(1, 'rgba(205, 35, 120, 0.30)');
  }
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
}

function paintVignette(ctx, w, h) {
  const r = Math.hypot(w, h) / 2;
  const vig = ctx.createRadialGradient(w / 2, h / 2, r * 0.35, w / 2, h / 2, r * 0.95);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

/** Tiny seeded random so the grain looks the same on every export. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let grainTile = null;
function paintGrain(ctx, w, h) {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = 140;
    grainTile.height = 140;
    const g = grainTile.getContext('2d');
    const img = g.createImageData(140, 140);
    const rnd = mulberry32(20261121);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(rnd() * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(grainTile, 'repeat');
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function fitFont(ctx, text, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  while (size > 16 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  }
  return size;
}

function paintCaption(ctx, w, h, state) {
  const text = (state.caption || '').trim().toUpperCase();
  const sub = (state.sub || '').trim().toUpperCase();
  if (!text && !sub) return;
  const base = state.layout === 'hero' ? h * 0.15 : h * 0.105;
  const size = base * (state.captionSize || 1);
  const bottom = state.captionPos !== 'top';
  const margin = h * 0.055;
  const glowColor =
    state.grade === 'neon' ? '#39f5d8' : state.grade === 'noir' ? '#ffd9a0' : '#ff5e8a';

  // A soft dark band behind the lettering keeps it readable on any photo.
  const bandH = h * 0.24;
  const band = ctx.createLinearGradient(0, bottom ? h - bandH : 0, 0, bottom ? h : bandH);
  band.addColorStop(0, 'rgba(0,0,0,0)');
  band.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = band;
  ctx.fillRect(0, bottom ? h - bandH : 0, w, bandH);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const maxW = w * 0.92;
  let mainY;
  if (text) {
    const fitted = fitFont(ctx, text, maxW, size);
    mainY = bottom ? h - margin - (sub ? h * 0.045 : 0) : margin + fitted;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, fitted * 0.16);
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = state.glow ? glowColor : 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = state.glow ? fitted * 0.45 : fitted * 0.12;
    ctx.shadowOffsetY = fitted * 0.04;
    ctx.strokeText(text, w / 2, mainY);
    ctx.fillText(text, w / 2, mainY);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  if (sub) {
    const subSize = Math.max(12, size * 0.24);
    ctx.font = `${subSize}px Anton, 'Arial Narrow', sans-serif`;
    try {
      ctx.letterSpacing = `${Math.round(subSize * 0.35)}px`;
    } catch {
      // letterSpacing is not everywhere; the sub-caption still draws fine.
    }
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, subSize * 0.14);
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = subSize * 0.25;
    // When there is no main caption, anchor the sub-caption on its own.
    const subY = bottom
      ? h - margin + subSize * 0.35
      : (mainY ?? margin + size) + subSize * 1.7;
    ctx.strokeText(sub, w / 2, subY);
    ctx.fillText(sub, w / 2, subY);
    ctx.shadowBlur = 0;
    try {
      ctx.letterSpacing = '0px';
    } catch {
      // ignore
    }
  }
}

/**
 * Paints `state` onto `canvas` (the canvas keeps its own width/height).
 * Photos are HTMLImageElements (or null for an empty panel).
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0c0c0e';
  ctx.fillRect(0, 0, w, h);
  const frame = Math.round(Math.min(w, h) * 0.016);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(frame, frame, w - frame * 2, h - frame * 2);
  const rects = panelRects(state.layout, w, h);
  rects.forEach((rect, i) => {
    const panel = state.panels[i] || emptyPanel();
    if (panel.img) drawPhotoIn(ctx, panel.img, rect, panel, state.grade);
    else drawPlaceholder(ctx, rect, i);
  });
  paintGrade(ctx, w, h, state.grade);
  if (state.vignette) paintVignette(ctx, w, h);
  if (state.grain) paintGrain(ctx, w, h);
  paintCaption(ctx, w, h, state);
}

/** Renders the cover at its export size on a fresh canvas. */
export function renderCover(state) {
  const canvas = document.createElement('canvas');
  canvas.width = state.width;
  canvas.height = state.height;
  drawCover(canvas, state);
  return canvas;
}
