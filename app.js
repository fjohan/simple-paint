const $ = id => document.getElementById(id);
const painting = $('painting');
const original = $('original');
const painter = new Painter(painting);
const styleNames = { oil: 'Oil paint', 'textured-oil': 'Textured oil', watercolor: 'Watercolor', impressionist: 'Impressionist', skagen: 'Skagen · Krøyer', 'textured-skagen': 'Textured Skagen' };
const descriptions = {
  oil: 'Rich color. Tangible texture. A timeless feel.',
  'textured-oil': 'Sculpted bristles. Broken edges. Paint you can feel.',
  watercolor: 'Soft washes. Gentle edges. A lighter touch.',
  impressionist: 'Lively strokes. Vibrant color. A new impression.',
  skagen: 'Pearl light. Blue-violet shadows. Quiet coastal color.',
  'textured-skagen': 'Coastal light. Soft bristles. A little more paint.'
};
let source = null;
let imageName = 'alpine-afternoon';
let busy = false;
let hasPainting = false;
let loadGeneration = 0;
let paintGeneration = 0;
let toastTimer;
let lastSettings = null;
let activeView = 'painting';

function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 6000);
}

function setView(view) {
  activeView = view;
  painting.hidden = view !== 'painting';
  original.hidden = view !== 'original';
  $('painting-view').classList.toggle('active', view === 'painting');
  $('original-view').classList.toggle('active', view === 'original');
  $('painting-view').setAttribute('aria-pressed', String(view === 'painting'));
  $('original-view').setAttribute('aria-pressed', String(view === 'original'));
  $('artwork').classList.toggle('show-original', view === 'original');
  if (view === 'original') $('brush-cursor').hidden = true;
}

function fitArtwork() {
  const space = $('canvas-space');
  const css = getComputedStyle(space);
  const maxWidth = space.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
  const maxHeight = space.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom);
  const border = parseFloat(getComputedStyle($('artwork')).borderLeftWidth) * 2;
  const ratio = source ? source.width / source.height : 4 / 3;
  const width = Math.max(1, Math.min(maxWidth - border, (maxHeight - border) * ratio));
  $('artwork').style.width = `${width + border}px`;
  $('artwork').style.height = `${width / ratio + border}px`;
}
new ResizeObserver(fitArtwork).observe($('canvas-space'));

function settings() {
  return {
    style: document.querySelector('input[name="style"]:checked').value,
    detail: Number($('detail').value),
    duration: Number(document.querySelector('input[name="duration"]:checked').value)
  };
}

function setBusy(value) {
  busy = value;
  $('canvas-space').setAttribute('aria-busy', String(value));
  $('paint-button').disabled = value || !source;
  $('replay-button').disabled = value || !source;
  $('download-button').disabled = value || !hasPainting;
  $('paint-button').querySelector('span').textContent = value ? 'A little art in the making…' : 'Make a little art';
  if (!value) $('brush-cursor').hidden = true;
}

async function paint(replay = false) {
  if (!source || busy) return;
  const generation = ++paintGeneration;
  const options = replay && lastSettings ? { ...lastSettings } : settings();
  lastSettings = { ...options };
  hasPainting = false;
  setView('painting');
  setBusy(true);
  $('loading-message').hidden = true;
  $('painting-meta').textContent = `${styleNames[options.style]} · Broad strokes to little details`;
  let lastPhase = '';
  try {
    const result = await painter.paint(source, {
      ...options,
      onProgress(progress, phase, position) {
        if (generation !== paintGeneration) return;
        const percent = Math.round(progress * 100);
        $('progress-fill').style.width = `${percent}%`;
        $('progress-track').setAttribute('aria-valuenow', String(percent));
        if (phase !== lastPhase) {
          $('painting-status').textContent = `${phase}${progress < 1 ? '…' : ''}`;
          lastPhase = phase;
        }
        const brush = $('brush-cursor');
        brush.hidden = !position || activeView !== 'painting';
        if (position) {
          brush.style.left = `${position.x * 100}%`;
          brush.style.top = `${position.y * 100}%`;
        }
      }
    });
    if (generation !== paintGeneration) return;
    if (result) {
      hasPainting = true;
      $('painting-meta').textContent = `${styleNames[options.style]} · ${result.strokes.toLocaleString()} brushstrokes · ${result.seconds.toFixed(1)} seconds`;
      $('painting-status').textContent = 'A moment, made into art.';
    }
  } catch (error) {
    console.error('Painting failed:', error);
    toast('The brush hit a snag. Try a smaller photo or paint again.');
    $('painting-status').textContent = 'Let’s give that another try.';
  } finally {
    if (generation === paintGeneration) setBusy(false);
  }
}

async function loadImage(url, name, { revoke = false, sample = false } = {}) {
  const generation = ++loadGeneration;
  ++paintGeneration;
  painter.cancel();
  setBusy(true);
  $('painting-status').textContent = 'Opening your moment…';
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (generation !== loadGeneration) return;
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Empty image');
    // Bound both dimensions and pixel count for predictable mobile memory use.
    const ratio = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    source = document.createElement('canvas');
    source.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    source.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = source.getContext('2d', { willReadFrequently: true });
    context.fillStyle = '#f4efe2';
    context.fillRect(0, 0, source.width, source.height);
    context.drawImage(image, 0, 0, source.width, source.height);
    original.width = source.width;
    original.height = source.height;
    original.getContext('2d').drawImage(source, 0, 0);
    imageName = name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 70) || 'my-moment';
    $('loading-message').hidden = true;
    const preview = $('upload-preview');
    const crop = Math.min(source.width, source.height);
    preview.getContext('2d').drawImage(source, (source.width - crop) / 2, (source.height - crop) / 2, crop, crop, 0, 0, preview.width, preview.height);
    preview.hidden = false;
    $('upload-glyph').setAttribute('hidden', '');
    $('upload-ready').hidden = sample;
    $('upload-zone').classList.toggle('has-photo', !sample);
    $('upload-zone').querySelector('strong').firstChild.textContent = sample ? 'Open a photo ' : 'Choose another ';
    $('photo-filename').textContent = sample ? 'Alpine afternoon · sample' : name;
    $('photo-filename').title = sample ? 'Alpine afternoon · sample' : name;
    $('photo-status').textContent = sample ? 'SAMPLE PHOTO' : 'PHOTO READY';
    fitArtwork();
    setBusy(false);
    await paint();
  } catch (error) {
    if (generation !== loadGeneration) return;
    console.error('Image loading failed:', error);
    toast('That photo couldn’t be opened. Try a JPG, PNG, WebP, or another image your browser supports.');
    $('loading-message').hidden = true;
    $('painting-status').textContent = source ? 'Your canvas is ready for another try.' : 'Open a photo to get started.';
    setBusy(false);
  } finally {
    if (revoke) URL.revokeObjectURL(url);
  }
}

function openFile(file) {
  if (!file) return;
  if (file.type && !file.type.startsWith('image/')) {
    toast('Pick an image to paint — a JPG, PNG, or WebP works beautifully.');
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    toast('That photo is a little large. Choose an image under 50 MB.');
    return;
  }
  void loadImage(URL.createObjectURL(file), file.name, { revoke: true });
}

$('photo-input').addEventListener('change', event => {
  openFile(event.target.files[0]);
  event.target.value = '';
});
$('upload-zone').addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); $('photo-input').click(); }
});
let dragDepth = 0;
const dropZone = $('upload-zone');
dropZone.addEventListener('dragenter', event => { event.preventDefault(); dragDepth++; dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
dropZone.addEventListener('dragleave', event => { event.preventDefault(); if (--dragDepth <= 0) dropZone.classList.remove('drag-over'); });
dropZone.addEventListener('drop', event => { event.preventDefault(); dragDepth = 0; dropZone.classList.remove('drag-over'); openFile(event.dataTransfer.files[0]); });
// Prevent the browser from navigating away when a file misses the drop target.
window.addEventListener('dragover', event => event.preventDefault());
window.addEventListener('drop', event => event.preventDefault());
$('demo-button').addEventListener('click', () => void loadImage('assets/alpine-afternoon.png', 'alpine-afternoon', { sample: true }));
$('paint-button').addEventListener('click', () => void paint());
$('replay-button').addEventListener('click', () => void paint(true));
$('painting-view').addEventListener('click', () => setView('painting'));
$('original-view').addEventListener('click', () => setView('original'));
document.querySelectorAll('input[name="style"]').forEach(input => input.addEventListener('change', () => {
  $('style-description').textContent = descriptions[input.value];
}));
$('detail').addEventListener('input', event => {
  const value = Number(event.target.value);
  $('detail-value').textContent = value < 34 ? 'Expressive' : value > 66 ? 'Detailed' : 'Balanced';
  event.target.style.setProperty('--range', `${value}%`);
});

$('download-button').addEventListener('click', () => {
  if (busy || !hasPainting) return;
  const style = lastSettings?.style || settings().style;
  painting.toBlob(blob => {
    if (!blob) return toast('The painting couldn’t be saved. Please try again.');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${imageName}-${style}-brushwork.png`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }, 'image/png');
});
const dialog = $('about-dialog');
$('about-button').addEventListener('click', () => dialog.showModal());
$('close-about').addEventListener('click', () => dialog.close());
$('back-to-studio').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });

void loadImage('assets/alpine-afternoon.png', 'alpine-afternoon', { sample: true });
