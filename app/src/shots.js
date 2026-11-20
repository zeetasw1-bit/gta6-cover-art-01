// Fixed scenes for screenshots: ?shot=editor opens the editor with a sample
// photo and caption filled in; ?shot=cover shows the cover alone, filling
// the viewport. window.__shotReady is set once the scene has painted.

function sizeFrom(query) {
  const raw = query.get('size') || '1080x1080';
  const [w, h] = raw.split('x').map(Number);
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return { width: w, height: h };
  return { width: 1080, height: 1080 };
}

function gradeFrom(query) {
  const g = query.get('grade');
  return g === 'neon' || g === 'noir' ? g : 'sunset';
}

function layoutFrom(query) {
  const l = query.get('layout');
  return l === 'strip' || l === 'hero' ? l : 'grid';
}

async function whenPainted() {
  try {
    await document.fonts.load('100px Anton');
    await document.fonts.ready;
  } catch {
    // Anton is optional; the fallback still draws.
  }
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

/**
 * Runs one screenshot scene.
 * `api` is the editor's shot API from main.js: loadSample, applyShot,
 * redraw, state.
 */
export async function runShot(shot, query, api) {
  const photo = query.get('photo') || 'pier';
  const caption = query.get('caption') || 'Sunset Heist';
  const sub = query.get('sub') || 'Sunset Bay';
  await api.applyShot({
    layout: layoutFrom(query),
    size: sizeFrom(query),
    grade: gradeFrom(query),
    caption,
    sub,
    photo,
  });

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const canvas = document.getElementById('cover');
    const scale = Math.min(
      window.innerWidth / canvas.width,
      window.innerHeight / canvas.height,
    );
    canvas.style.width = `${Math.round(canvas.width * scale)}px`;
    canvas.style.height = `${Math.round(canvas.height * scale)}px`;
    api.redraw();
  }
  await whenPainted();
  api.redraw();
  await whenPainted();
  window.__shotReady = true;
}
