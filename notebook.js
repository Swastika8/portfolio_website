const shell = document.querySelector('#notebook-shell');
const spread = document.querySelector('#notebook-spread');
const art = document.querySelector('#desk-art');
const pad = document.querySelector('#desk-pad');
const padToggle = document.querySelector('#pad-toggle');
const coffeeToggle = document.querySelector('#coffee-toggle');
const coffeeImage = coffeeToggle.querySelector('img');
const catToggle = document.querySelector('#cat-toggle');
const catToy = document.querySelector('#cat-toy');
const catStatus = document.querySelector('#cat-status');
const cat = document.querySelector('#cursor-cat');
const catSeat = document.querySelector('#cat-seat');
const catActionButtons = [catToy, catSeat];
const note = document.querySelector('#desk-note');
const canvas = document.querySelector('#desk-sketch');
const context = canvas.getContext('2d');
const typeButton = document.querySelector('#type-mode');
const drawButton = document.querySelector('#draw-mode');
const undoButton = document.querySelector('#undo-stroke');
const clearButton = document.querySelector('#clear-sketch');
const padHelp = document.querySelector('#pad-help');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const motionAllowed = matchMedia('(any-pointer: fine) and (prefers-reduced-motion: no-preference)');
const keys = { note: 'swastika-desk-note-v1', sketch: 'swastika-desk-sketch-v1', cat: 'swastika-desk-cat-v1' };
const maxStrokes = 80;
const maxPoints = 480;
const catSize = 72;
const catAtlases = {
  motion: { url: 'assets/notebook/cat-motion.webp' },
  tricks: { url: 'assets/notebook/cat-tricks.webp' },
  pet: { url: 'assets/notebook/cat-pet.webp' },
};
const catTricks = [
  { action: 'play', duration: 1000, atlas: 'motion', status: 'The cat pounces.' },
  { action: 'stretch', duration: 1440, atlas: 'tricks', status: 'The cat stretches.' },
  { action: 'groom', duration: 1640, atlas: 'tricks', status: 'The cat washes her face.' },
  { action: 'nap', duration: 2340, atlas: 'tricks', status: 'The cat curls up for a nap.' },
];
const catPetting = { action: 'pet', duration: 1520, atlas: 'pet', status: 'The cat closes her eyes and leans into your hand.' };

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function readStrokes() {
  try {
    const data = JSON.parse(read(keys.sketch) || '[]');
    if (!Array.isArray(data)) return [];
    return data.slice(0, maxStrokes).filter((stroke) => Array.isArray(stroke) && stroke.length && stroke.length <= maxPoints &&
      stroke.every((point) => Array.isArray(point) && point.length === 2 && point.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)));
  } catch {
    return [];
  }
}

let strokes = readStrokes();
let clearedStrokes = [];
let inProgress = null;
let following = read(keys.cat) !== 'off';
let mode = 'type';
let width = 0;
let height = 0;
let frame = 0;
let lastFrame = 0;
let catActionTimer = 0;
let catRestTimer = 0;
let catActionRequest;
let nextTrick = 0;
let targetX = 0;
let targetY = 0;
let catX = 0;
let catY = 0;

function saveNote(key, value) {
  padHelp.textContent = write(key, value) ? 'Notes stay in this browser.' : 'This browser could not save your notes for next time.';
}

function updateSketchButtons() {
  undoButton.disabled = !strokes.length && !clearedStrokes.length;
  clearButton.disabled = !strokes.length;
}

function paint(stroke) {
  const [x, y] = stroke[0];
  context.beginPath();
  if (stroke.length === 1) {
    context.arc(x * width, y * height, 1.25, 0, 2 * Math.PI);
    context.fill();
    return;
  }
  context.moveTo(x * width, y * height);
  for (const [pointX, pointY] of stroke.slice(1)) context.lineTo(pointX * width, pointY * height);
  context.stroke();
}

function drawSketch() {
  if (!context || canvas.hidden || pad.hidden) return;
  const box = canvas.getBoundingClientRect();
  width = box.width;
  height = box.height;
  if (!width || !height) return;
  const scale = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.strokeStyle = '#644a7a';
  context.fillStyle = '#644a7a';
  context.lineWidth = 2.5;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  strokes.forEach(paint);
  if (inProgress) paint(inProgress.points);
}

function saveSketch() {
  updateSketchButtons();
  saveNote(keys.sketch, JSON.stringify(strokes));
}

function setMode(next) {
  mode = next;
  const drawing = mode === 'draw';
  typeButton.setAttribute('aria-pressed', String(!drawing));
  drawButton.setAttribute('aria-pressed', String(drawing));
  note.hidden = drawing;
  canvas.hidden = !drawing;
  undoButton.hidden = !drawing;
  clearButton.hidden = !drawing;
  if (drawing) drawSketch();
}

function showPad(open) {
  art.hidden = open;
  pad.hidden = !open;
  padToggle.setAttribute('aria-expanded', String(open));
  if (open) {
    restCat();
    setMode(mode);
    (mode === 'type' ? note : drawButton).focus({ preventScroll: true });
    pad.scrollIntoView({ block: 'nearest' });
  } else {
    padToggle.focus({ preventScroll: true });
  }
}

function pointerPoint(event) {
  const box = canvas.getBoundingClientRect();
  const ratio = (value) => Math.round(Math.min(1, Math.max(0, value)) * 10000) / 10000;
  return [ratio((event.clientX - box.left) / box.width), ratio((event.clientY - box.top) / box.height)];
}

function finishStroke(event) {
  if (!inProgress || inProgress.id !== event.pointerId) return;
  strokes.push(inProgress.points);
  inProgress = null;
  clearedStrokes = [];
  saveSketch();
}

function stopChase() {
  cancelAnimationFrame(frame);
  clearTimeout(catRestTimer);
  frame = 0;
  lastFrame = 0;
}

function endCatAction() {
  clearTimeout(catActionTimer);
  catActionRequest = undefined;
  for (const button of catActionButtons) button.removeAttribute('aria-disabled');
  delete catSeat.dataset.action;
  delete catSeat.dataset.atlas;
}

function hideMovingCat() {
  stopChase();
  cat.dataset.action = 'idle';
  cat.hidden = true;
  delete shell.dataset.catWalking;
}

function restCat() {
  hideMovingCat();
  endCatAction();
}

function loadCatFrames(kind) {
  const atlas = catAtlases[kind];
  if (atlas.ready) return atlas.ready;

  const image = new Image();
  image.fetchPriority = 'low';
  image.src = atlas.url;
  atlas.ready = image.decode().then(() => {
    if (kind === 'motion') cat.dataset.frames = '';
    return true;
  }, () => {
    delete atlas.ready;
    return false;
  });
  return atlas.ready;
}

function syncCat() {
  catToggle.hidden = !motionAllowed.matches;
  catToggle.setAttribute('aria-pressed', String(following && motionAllowed.matches));
  if (following && motionAllowed.matches) loadCatFrames('motion');
  else restCat();
}

function placeCat() {
  cat.style.transform = 'translate3d(' + catX + 'px, ' + catY + 'px, 0)';
}

function keepOnPage(position, edge) {
  return Math.max(0, Math.min(position, edge - catSize));
}

function showCat(fallbackX, fallbackY, bounds) {
  if (!cat.hidden) return;
  const seat = catSeat.getBoundingClientRect();
  const seatVisible = seat.width > 0 && seat.top >= 0 && seat.bottom <= innerHeight;
  catX = keepOnPage(seatVisible ? seat.left - bounds.left : fallbackX, bounds.width);
  catY = keepOnPage(seatVisible ? seat.bottom - bounds.top - catSize : fallbackY, bounds.height);
  placeCat();
  cat.hidden = false;
  shell.dataset.catWalking = '';
}

function moveCat(time) {
  const elapsed = lastFrame ? Math.min(36, time - lastFrame) / 1000 : 1 / 60;
  lastFrame = time;
  const dx = targetX - catX;
  const dy = targetY - catY;
  const distance = Math.hypot(dx, dy);
  if (distance < 2) {
    cat.dataset.action = 'idle';
    stopChase();
    catRestTimer = setTimeout(hideMovingCat, 1600);
    return;
  }

  const running = distance > 78 || (cat.dataset.action === 'run' && distance > 46);
  const action = running ? 'run' : 'walk';
  if (cat.dataset.action !== action) cat.dataset.action = action;
  if (Math.abs(dx) > 3) {
    const facing = dx > 0 ? 'right' : 'left';
    if (cat.dataset.facing !== facing) cat.dataset.facing = facing;
  }
  const speed = running ? Math.max(330, Math.min(820, distance * 3.4)) : 145;
  const step = Math.min(distance, elapsed * speed) / distance;
  catX += dx * step;
  catY += dy * step;
  placeCat();
  frame = requestAnimationFrame(moveCat);
}

async function performCatAction(event) {
  if (catActionRequest || !pad.hidden) return;
  const trigger = event.currentTarget;
  const cycling = trigger === catToy;
  const request = Symbol();
  const trick = cycling ? catTricks[nextTrick] : catPetting;
  catActionRequest = request;
  for (const button of catActionButtons) button.setAttribute('aria-disabled', 'true');
  hideMovingCat();
  const loaded = await loadCatFrames(trick.atlas);
  if (catActionRequest !== request) return;
  if (!loaded) {
    endCatAction();
    if (cycling) nextTrick = 0;
    catStatus.textContent = 'The cat animation could not load. Try again.';
    return;
  }

  catSeat.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  if (!cycling && event.detail === 0) catSeat.focus({ preventScroll: true });
  catSeat.style.setProperty('--cat-duration', `${trick.duration}ms`);
  catSeat.dataset.atlas = trick.atlas;
  catSeat.dataset.action = trick.action;
  catStatus.textContent = trick.status;
  if (cycling) nextTrick = (nextTrick + 1) % catTricks.length;
  if (trick.action === 'play') loadCatFrames('tricks');
  catActionTimer = setTimeout(endCatAction, reducedMotion.matches ? 850 : trick.duration + 90);
}

art.dataset.ready = '';
padToggle.hidden = false;
coffeeToggle.hidden = false;
drawButton.hidden = !context;
note.value = read(keys.note) || '';
updateSketchButtons();
note.addEventListener('input', () => saveNote(keys.note, note.value));
padToggle.addEventListener('click', () => showPad(true));
coffeeToggle.addEventListener('click', () => {
  if (reducedMotion.matches) return;
  for (const animation of coffeeImage.getAnimations()) animation.cancel();
  coffeeImage.animate([
    { rotate: '0deg' },
    { rotate: '-30deg', offset: 0.3 },
    { rotate: '30deg', offset: 0.68 },
    { rotate: '0deg' },
  ], { duration: 720, easing: 'ease-in-out' });
});
document.querySelector('#close-pad').addEventListener('click', () => showPad(false));
pad.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') showPad(false);
});
typeButton.addEventListener('click', () => setMode('type'));
drawButton.addEventListener('click', () => setMode('draw'));

if (context) {
  new ResizeObserver(drawSketch).observe(canvas);
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || inProgress) return;
    if (strokes.length >= maxStrokes) {
      padHelp.textContent = 'Undo or clear a stroke to make more room.';
      return;
    }
    inProgress = { id: event.pointerId, points: [pointerPoint(event)] };
    canvas.setPointerCapture(event.pointerId);
    paint(inProgress.points);
    restCat();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!inProgress || inProgress.id !== event.pointerId || inProgress.points.length >= maxPoints) return;
    const point = pointerPoint(event);
    paint([inProgress.points.at(-1), point]);
    inProgress.points.push(point);
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, finishStroke);
  undoButton.addEventListener('click', () => {
    if (!strokes.length && clearedStrokes.length) {
      strokes = clearedStrokes;
      clearedStrokes = [];
    } else {
      strokes.pop();
    }
    drawSketch();
    saveSketch();
  });
  clearButton.addEventListener('click', () => {
    clearedStrokes = strokes;
    strokes = [];
    drawSketch();
    saveSketch();
  });
}

syncCat();
catSeat.disabled = false;
for (const button of catActionButtons) {
  button.hidden = false;
  button.addEventListener('click', performCatAction);
}
motionAllowed.addEventListener('change', syncCat);
catToggle.addEventListener('click', () => {
  following = !following;
  write(keys.cat, following ? 'on' : 'off');
  syncCat();
});
spread.addEventListener('pointermove', (event) => {
  if (!following || !motionAllowed.matches || event.pointerType === 'touch' || !pad.hidden) return;
  if (catActionRequest || catToy.contains(event.target) || catSeat.matches(':focus-visible')) return;
  if (catSeat.contains(event.target)) {
    if (!cat.hidden) hideMovingCat();
    return;
  }
  clearTimeout(catRestTimer);
  const bounds = spread.getBoundingClientRect();
  targetX = keepOnPage(event.clientX - bounds.left + 20, bounds.width);
  targetY = keepOnPage(event.clientY - bounds.top + 17, bounds.height);
  showCat(targetX, targetY, bounds);
  if (!frame) frame = requestAnimationFrame(moveCat);
}, { passive: true });
spread.addEventListener('pointerleave', () => {
  if (!catActionRequest) restCat();
});
window.addEventListener('resize', () => {
  if (!cat.hidden) restCat();
}, { passive: true });
window.addEventListener('blur', restCat);

