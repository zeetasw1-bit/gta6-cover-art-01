// Vice Cover Studio — editor wiring.
//
// Loads the user's photos, keeps the editor state, repaints the live
// preview on every change, and exports the finished cover as a PNG.
// A `?shot=` query sets up a fixed scene for screenshots (./shots.js).
import {
  drawCover,
  renderCover,
  freshState,
  panelCount,
  panelAt,
  panelRects,
  LAYOUTS,
  GRADES,
  SIZES,
} from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const statusEl = $('status');
const thumbsEl = $('thumbs');

const state = freshState();
let selectedPanel = 0;
let userPhotos = [];
let dragging = false;
let dragLast = null;

const SAMPLES = ['vice-street', 'neon-pier', 'boulevard', 'pier'];

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function say(message) {
  statusEl.textContent = message;
}

/** Keeps the panel list the right length when the layout changes. */
function syncPanels() {
  const n = panelCount(state.layout);
  while (state.panels.length < n) state.panels.push({ img: null, zoom: 1, px: 0, py: 0 });
  state.panels.length = n;
  if (selectedPanel >= n) selectedPanel = 0;
}

function redraw() {
  canvas.width = state.width;
  canvas.height = state.height;
  drawCover(canvas, state);
  updatePanelChips();
  updateZoomLabel();
}

function updatePanelChips() {
  const chips = document.querySelectorAll('[data-panel]');
  chips.forEach((chip) => {
    const i = Number(chip.dataset.panel);
    chip.classList.toggle('active', i === selectedPanel);
    chip.disabled = i >= state.panels.length;
    chip.textContent = state.panels[i] && state.panels[i].img ? `Panel ${i + 1} ✓` : `Panel ${i + 1}`;
  });
}

function updateZoomLabel() {
  const panel = state.panels[selectedPanel];
  $('zoom').value = panel ? panel.zoom : 1;
  $('zoom-label').textContent = `${(panel ? panel.zoom : 1).toFixed(1)}x`;
  $('caption-size').value = state.captionSize;
  $('caption-size-label').textContent = `${Math.round(state.captionSize * 100)}%`;
}

function assignPhoto(img, index) {
  const target = index == null ? selectedPanel : index;
  if (!state.panels[target]) return;
  state.panels[target].img = img;
  state.panels[target].zoom = 1;
  state.panels[target].px = 0;
  state.panels[target].py = 0;
  redraw();
}

function addThumb(img, name) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'thumb';
  button.title = name;
  const preview = document.createElement('img');
  preview.src = img.src;
  preview.alt = name;
  button.appendChild(preview);
  button.addEventListener('click', () => {
    assignPhoto(img, selectedPanel);
    say(`${name} placed on panel ${selectedPanel + 1}.`);
  });
  thumbsEl.appendChild(button);
}

async function loadUserFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      userPhotos.push({ img, name: file.name });
      addThumb(img, file.name);
    } catch {
      say(`Could not read ${file.name}.`);
    }
  }
  if (userPhotos.length && !state.panels.some((p) => p.img)) {
    assignPhoto(userPhotos[0].img, 0);
    say('Photo loaded — pick a layout, then Export PNG.');
  }
  redraw();
}

async function loadSample(name) {
  const img = await loadImage(`samples/${name}.jpg`);
  return img;
}

async function trySample() {
  const name = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
  try {
    const img = await loadSample(name);
    assignPhoto(img, selectedPanel);
    say(`Sample ${name} on panel ${selectedPanel + 1}.`);
  } catch {
    say('Sample photo failed to load.');
  }
}

function setLayout(layout) {
  if (!LAYOUTS.includes(layout)) return;
  state.layout = layout;
  syncPanels();
  document.querySelectorAll('[data-layout]').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === layout);
  });
  redraw();
}

function setSize(width, height) {
  state.width = width;
  state.height = height;
  document.querySelectorAll('[data-size]').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.sizeW) === width && Number(b.dataset.sizeH) === height);
  });
  $('export').textContent = `Export PNG ${width} x ${height}`;
  redraw();
}

function setGrade(grade) {
  if (!GRADES.includes(grade)) return;
  state.grade = grade;
  document.querySelectorAll('[data-grade]').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === grade);
  });
  redraw();
}

function exportPng() {
  const out = renderCover(state);
  out.toBlob((blob) => {
    if (!blob) {
      say('Export failed — try again.');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cover-${state.width}x${state.height}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    say(`Saved cover-${state.width}x${state.height}.png — share it anywhere.`);
  }, 'image/png');
}

// --- Control wiring -------------------------------------------------------

$('photo').addEventListener('change', (e) => {
  loadUserFiles(e.target.files);
  e.target.value = '';
});
$('sample').addEventListener('click', trySample);
$('fill-all').addEventListener('click', () => {
  const panel = state.panels[selectedPanel];
  if (!panel || !panel.img) {
    say('Put a photo on the selected panel first.');
    return;
  }
  state.panels.forEach((p) => {
    p.img = panel.img;
    p.zoom = 1;
    p.px = 0;
    p.py = 0;
  });
  redraw();
  say('One photo now fills every panel.');
});
$('clear-panel').addEventListener('click', () => {
  const panel = state.panels[selectedPanel];
  if (!panel) return;
  panel.img = null;
  panel.zoom = 1;
  panel.px = 0;
  panel.py = 0;
  redraw();
  say(`Panel ${selectedPanel + 1} cleared.`);
});

document.querySelectorAll('[data-panel]').forEach((chip) => {
  chip.addEventListener('click', () => {
    selectedPanel = Number(chip.dataset.panel);
    redraw();
  });
});
document.querySelectorAll('[data-layout]').forEach((b) => {
  b.addEventListener('click', () => setLayout(b.dataset.layout));
});
document.querySelectorAll('[data-size]').forEach((b) => {
  b.addEventListener('click', () => setSize(Number(b.dataset.sizeW), Number(b.dataset.sizeH)));
});
document.querySelectorAll('[data-grade]').forEach((b) => {
  b.addEventListener('click', () => setGrade(b.dataset.grade));
});

$('zoom').addEventListener('input', (e) => {
  const panel = state.panels[selectedPanel];
  if (!panel) return;
  panel.zoom = Number(e.target.value);
  panel.px = Math.max(-1, Math.min(1, panel.px));
  panel.py = Math.max(-1, Math.min(1, panel.py));
  redraw();
});
$('caption').addEventListener('input', (e) => {
  state.caption = e.target.value;
  redraw();
});
$('sub').addEventListener('input', (e) => {
  state.sub = e.target.value;
  redraw();
});
$('caption-size').addEventListener('input', (e) => {
  state.captionSize = Number(e.target.value);
  redraw();
});
document.querySelectorAll('[name="caption-pos"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    state.captionPos = radio.value;
    redraw();
  });
});
['vignette', 'grain', 'glow'].forEach((key) => {
  $(key).addEventListener('change', (e) => {
    state[key] = e.target.checked;
    redraw();
  });
});
$('export').addEventListener('click', exportPng);

// Drag on the preview pans the photo inside the clicked panel.
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * state.width,
    y: ((e.clientY - rect.top) / rect.height) * state.height,
  };
}
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const hit = panelAt(state, p.x, p.y);
  if (hit >= 0) {
    selectedPanel = hit;
    dragging = true;
    dragLast = p;
    canvas.setPointerCapture(e.pointerId);
    redraw();
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging || !dragLast) return;
  const p = canvasPoint(e);
  const panel = state.panels[selectedPanel];
  if (!panel || !panel.img) return;
  const rects = panelRects(state.layout, state.width, state.height);
  const rect = rects[selectedPanel];
  const base = Math.max(rect.w / panel.img.naturalWidth, rect.h / panel.img.naturalHeight);
  const scale = base * Math.max(1, panel.zoom);
  const slackX = Math.max(1, (panel.img.naturalWidth * scale - rect.w) / 2);
  const slackY = Math.max(1, (panel.img.naturalHeight * scale - rect.h) / 2);
  panel.px = Math.max(-1, Math.min(1, panel.px + (p.x - dragLast.x) / slackX));
  panel.py = Math.max(-1, Math.min(1, panel.py + (p.y - dragLast.y) / slackY));
  dragLast = p;
  redraw();
});
canvas.addEventListener('pointerup', () => {
  dragging = false;
  dragLast = null;
});

// --- Screenshot scenes ----------------------------------------------------
// The shot API hands shots.js the hooks it needs; the editor stays the
// single owner of state and drawing.
const shotApi = {
  loadSample,
  applyShot({ layout, size, grade, caption, sub, photo }) {
    if (layout) setLayout(layout);
    if (size) setSize(size.width, size.height);
    if (grade) setGrade(grade);
    if (caption !== undefined) {
      state.caption = caption;
      $('caption').value = caption;
    }
    if (sub !== undefined) {
      state.sub = sub;
      $('sub').value = sub;
    }
    if (photo) {
      return loadSample(photo).then((img) => {
        state.panels.forEach((p) => {
          p.img = img;
          p.zoom = 1;
          p.px = 0;
          p.py = 0;
        });
        redraw();
      });
    }
    redraw();
    return Promise.resolve();
  },
  redraw,
  state,
};

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, shotApi).catch((err) => {
    say(`Shot scene failed: ${err.message}`);
  });
} else {
  document.fonts.load('100px Anton').then(redraw).catch(() => redraw());
  redraw();
  say('Add a photo, pick a layout, then Export PNG.');
}
